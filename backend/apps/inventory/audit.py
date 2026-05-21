import logging
from concurrent.futures import ThreadPoolExecutor
from django.forms.models import model_to_dict
from django.db import models as django_models
from .models import AuditLog, AuditFieldChange
from apps.common.middleware import get_current_request

# Thread pool for async logging (prevents blocking main transaction)
_executor = ThreadPoolExecutor(max_workers=4)
logger = logging.getLogger(__name__)


def _value_to_str(value):
    """
    Convert any Python value to a plain string for relational storage.
    Handles Django model instances, UUIDs, dates, decimals, etc.
    """
    if value is None:
        return None
    
    # Handle Django model instances
    if hasattr(value, '_id'):
        return str(value._id)
    if hasattr(value, 'pk'):
        return str(value.pk)
    
    # Handle UUID objects
    if hasattr(value, 'hex'):
        return str(value)
    
    # Handle datetime/date objects
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    
    # Handle decimal.Decimal
    if hasattr(value, 'quantize'):
        return str(value)
    
    # Handle lists and dicts - for pure relational, we skip complex types
    # If you need to audit these, normalize them into separate tables
    if isinstance(value, (list, dict)):
        # Return a placeholder or None - these fields won't be audited
        # Alternatively, you could JSON stringify but that breaks pure relational
        return None
    
    # Default: convert to string
    return str(value)


def _collect_field_changes(old_dict, new_dict):
    """
    Compare two model dicts and return list of changes.
    Returns: list of (field_name, old_value_str, new_value_str)
    """
    changes = []
    all_keys = set(old_dict.keys()) | set(new_dict.keys())
    
    for key in all_keys:
        old_val = old_dict.get(key)
        new_val = new_dict.get(key)
        
        # Skip if values are equal
        if old_val == new_val:
            continue
        
        # Skip internal Django fields
        if key.startswith('_'):
            continue
        
        old_str = _value_to_str(old_val)
        new_str = _value_to_str(new_val)
        
        # Skip if both are None (means we couldn't serialize)
        if old_str is None and new_str is None:
            continue
        
        changes.append((key, old_str, new_str))
    
    return changes


def _create_audit_log_sync(
    user_id, action, entity_type, entity_id,
    field_changes, source_module,
    company_id, branch_id,
    reference_id, ip_address, user_agent
):
    """
    Synchronous database insert - runs in thread pool.
    Creates audit header and all field change records.
    """
    try:
        # Create audit header
        audit_log = AuditLog.objects.create(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            source_module=source_module,
            company_id=company_id,
            branch_id=branch_id,
            reference_id=reference_id,
            ip_address=ip_address,
            user_agent=user_agent or '',
        )
        
        # Create field change records (one per changed field)
        field_change_objects = [
            AuditFieldChange(
                audit_log=audit_log,
                field_name=field_name,
                old_value=old_val,
                new_value=new_val
            )
            for field_name, old_val, new_val in field_changes
        ]
        
        # Bulk create for better performance
        if field_change_objects:
            AuditFieldChange.objects.bulk_create(field_change_objects)
        
    except Exception as e:
        logger.error(f"Audit log creation failed for {action} on {entity_type} {entity_id}: {e}", exc_info=True)


def log_change(
    instance,
    action,           # 'CREATE', 'UPDATE', 'DELETE'
    user_id=None,
    before_state=None,
    after_state=None,
    source_module='inventory',
    company_id=None,
    branch_id=None,
    reference_id=None,
    request=None,
):
    """
    Main entry point for audit logging.
    
    Priority order for metadata:
    1. Explicitly passed parameters
    2. From request.user (if request provided)
    3. From instance attributes
    """
    if request is None:
        request = get_current_request()

    # Determine user_id
    if not user_id:
        if request and hasattr(request, 'user') and request.user and request.user.is_authenticated:
            user_id = request.user.id
        elif hasattr(instance, 'updated_by_id') and instance.updated_by_id:
            user_id = instance.updated_by_id
        elif hasattr(instance, 'created_by_id') and instance.created_by_id:
            user_id = instance.created_by_id

    # Determine company_id
    if company_id is None:
        if request and hasattr(request, 'user') and request.user and request.user.is_authenticated:
            company_id = getattr(request.user, 'company_id', None)
        elif hasattr(instance, 'company_id'):
            company_id = instance.company_id

    # Determine branch_id
    if branch_id is None:
        if request and hasattr(request, 'user') and request.user and request.user.is_authenticated:
            branch_id = getattr(request.user, 'branch_id', None)
        elif hasattr(instance, 'branch_id'):
            branch_id = instance.branch_id

    # Determine entity info
    entity_type = instance._meta.model_name
    entity_id = getattr(instance, '_id', None) or instance.pk
    
    if not entity_id:
        logger.warning(f"Cannot audit {action} on {entity_type}: no entity_id")
        return

    # Extract request metadata
    ip_address = None
    user_agent = None
    if request:
        ip_address = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]  # Limit length

    # Compute field changes based on action type
    field_changes = []
    
    try:
        if action == 'CREATE':
            # For CREATE: all fields are new, old_value = None
            target = after_state or instance
            after_dict = target if isinstance(target, dict) else model_to_dict(target)
            for field_name, value in after_dict.items():
                if not field_name.startswith('_'):
                    val_str = _value_to_str(value)
                    if val_str is not None:
                        field_changes.append((field_name, None, val_str))
        
        elif action == 'UPDATE':
            # For UPDATE: only changed fields
            if before_state and after_state:

                # before_state may already be dict from pre_save signal
                if isinstance(before_state, dict):
                    before_dict = before_state
                else:
                    before_dict = model_to_dict(before_state)

                # after_state is usually model instance
                if isinstance(after_state, dict):
                    after_dict = after_state
                else:
                    after_dict = model_to_dict(after_state)

                field_changes = _collect_field_changes(before_dict, after_dict)

            else:
                logger.warning(
                    f"UPDATE audit for {entity_type} {entity_id} missing before/after state"
                )
                return
        
        elif action == 'DELETE':
            # For DELETE: all final values, new_value = None
            target = before_state or instance
            before_dict = target if isinstance(target, dict) else model_to_dict(target)
            for field_name, value in before_dict.items():
                if not field_name.startswith('_'):
                    val_str = _value_to_str(value)
                    if val_str is not None:
                        field_changes.append((field_name, val_str, None))
        
        else:
            # Bulk actions handled separately
            logger.warning(f"Unknown action type: {action}")
            return
        
        # Don't create audit log if no fields changed (for UPDATE)
        if action == 'UPDATE' and not field_changes:
            return
        
        # Offload to thread pool (non-blocking)
        _executor.submit(
            _create_audit_log_sync,
            user_id, action, entity_type, entity_id,
            field_changes, source_module,
            company_id, branch_id,
            reference_id, ip_address, user_agent
        )
        
    except Exception as e:
        logger.error(f"Failed to prepare audit log for {action} on {entity_type}: {e}", exc_info=True)


def log_bulk_action(
    action,
    entity_type,
    entity_ids,
    user_id=None,
    details=None,
    company_id=None,
    branch_id=None,
    request=None,
    source_module='inventory',
):
    """
    Log bulk actions (e.g., bulk delete, bulk update, bulk status change).
    
    Args:
        action: 'BULK_CREATE', 'BULK_UPDATE', or 'BULK_DELETE'
        entity_type: Model name (e.g., 'product', 'variant')
        entity_ids: List of UUIDs affected
        user_id: Optional user ID (falls back to request.user)
        details: Optional dict with additional info (e.g., {'status': 'archived'})
        company_id, branch_id: For multi-tenant isolation
        request: HTTP request object (extracts user, IP, user_agent)
        source_module: Module name
    """
    if request is None:
        request = get_current_request()

    # Determine user_id
    if not user_id and request and hasattr(request, 'user') and request.user:
        user_id = request.user.id
    
    # Determine company/branch from request
    if company_id is None and request and hasattr(request, 'user') and request.user:
        company_id = getattr(request.user, 'company_id', None)
        branch_id = getattr(request.user, 'branch_id', None)
    
    # Extract request metadata
    ip_address = None
    user_agent = None
    if request:
        ip_address = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
    
    # For bulk actions, we store summary in field changes as special fields
    field_changes = []
    
    # Store summary of bulk operation
    field_changes.append(('_bulk_action', None, action))
    field_changes.append(('_entity_ids', None, ','.join(str(eid) for eid in entity_ids[:100])))  # Limit for very large batches
    field_changes.append(('_total_count', None, str(len(entity_ids))))
    
    if details:
        for key, value in details.items():
            field_changes.append((f'_detail_{key}', None, str(value)))
    
    # Use a placeholder entity_id (None for bulk actions)
    # We'll use a hash of the action as reference
    import hashlib
    reference = hashlib.md5(f"{action}_{entity_type}_{user_id}_{company_id}".encode()).hexdigest()
    
    _executor.submit(
        _create_audit_log_sync,
        user_id, action, entity_type, reference,
        field_changes, source_module,
        company_id, branch_id,
        None, ip_address, user_agent
    )