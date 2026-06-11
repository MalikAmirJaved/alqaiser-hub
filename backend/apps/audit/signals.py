# apps/audit/signals.py
import json
import uuid
from datetime import date, datetime
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from .models import AuditLog

def _serialize_for_json(obj):
    """Recursively convert non-JSON-serializable objects to strings."""
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    # Django model instance -> convert to string representation (avoid storing whole object)
    if hasattr(obj, '_meta') and hasattr(obj, 'pk'):
        return str(obj.pk) if obj.pk is not None else str(obj)
    if isinstance(obj, dict):
        return {k: _serialize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_serialize_for_json(i) for i in obj]
    return obj


def _has_uuid_field(instance):
    """Check if the model has a UUID field named '_id' that is a UUID instance."""
    if not hasattr(instance, '_id'):
        return False
    # _id can be a UUIDField (value is UUID) or could be a string; check type
    return isinstance(instance._id, uuid.UUID)


@receiver(post_save)
def audit_create_update(sender, instance, created, **kwargs):
    """Log creation or update of any model that has a UUID _id field."""
    # Skip models without a UUID _id field
    if not _has_uuid_field(instance):
        return

    # Skip audit logs themselves
    if sender.__name__ == 'AuditLog':
        return

    # Skip Django internal apps
    if sender._meta.app_label in ['admin', 'auth', 'contenttypes', 'sessions']:
        return

    # Skip the Migration model
    if sender.__name__ == 'Migration':
        return

    # Try to get request from the instance (if attached by middleware)
    request = getattr(instance, '_request', None)

    user = getattr(request, 'user', None) if request else None
    ip = None
    user_agent = None
    if request:
        ip = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:255]

    # Build changes dict
    changes = {}
    if not created:
        try:
            old_instance = sender.objects.get(pk=instance.pk)
            for field in instance._meta.fields:
                old_val = getattr(old_instance, field.name)
                new_val = getattr(instance, field.name)
                if old_val != new_val:
                    changes[field.name] = {
                        'old': _serialize_for_json(old_val),
                        'new': _serialize_for_json(new_val)
                    }
        except sender.DoesNotExist:
            pass
    else:
        for field in instance._meta.fields:
            val = getattr(instance, field.name)
            if val is not None:
                changes[field.name] = _serialize_for_json(val)

    if not changes and created:
        changes['action'] = 'created'

    changes_serialized = _serialize_for_json(changes)

    module = sender._meta.app_label

    # record_id is the UUID string
    record_id = str(instance._id)

    audit_data = {
        'model_name': sender.__name__,
        'record_id': record_id,
        'action': 'CREATE' if created else 'UPDATE',
        'changes': changes_serialized,
        'user': user,
        'ip_address': ip,
        'user_agent': user_agent,
        'module': module,
    }
    # Add company_id if the instance has it (BaseModel includes it)
    if hasattr(instance, 'company_id') and instance.company_id:
        audit_data['company_id'] = instance.company_id
    elif hasattr(instance, 'company') and instance.company and hasattr(instance.company, 'id'):
        audit_data['company_id'] = instance.company.id

    AuditLog.objects.create(**audit_data)


@receiver(pre_delete)
def audit_delete(sender, instance, **kwargs):
    """Log deletion for models that have a UUID _id field."""
    if not _has_uuid_field(instance):
        return

    if sender.__name__ == 'AuditLog':
        return
    if sender._meta.app_label in ['admin', 'auth', 'contenttypes', 'sessions']:
        return
    if sender.__name__ == 'Migration':
        return

    request = getattr(instance, '_request', None)
    user = getattr(request, 'user', None) if request else None
    ip = None
    user_agent = None
    if request:
        ip = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:255]

    data = {}
    for field in instance._meta.fields:
        val = getattr(instance, field.name)
        if val is not None:
            data[field.name] = _serialize_for_json(val)

    module = sender._meta.app_label
    record_id = str(instance._id)

    audit_data = {
        'model_name': sender.__name__,
        'record_id': record_id,
        'action': 'DELETE',
        'changes': data,
        'user': user,
        'ip_address': ip,
        'user_agent': user_agent,
        'module': module,
    }
    if hasattr(instance, 'company_id') and instance.company_id:
        audit_data['company_id'] = instance.company_id
    elif hasattr(instance, 'company') and instance.company and hasattr(instance.company, 'id'):
        audit_data['company_id'] = instance.company.id

    AuditLog.objects.create(**audit_data)