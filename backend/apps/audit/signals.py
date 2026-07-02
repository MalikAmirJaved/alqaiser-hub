# apps/audit/signals.py
import uuid
from datetime import date, datetime
from decimal import Decimal
from django.db.models.signals import pre_save, post_save, pre_delete
from django.dispatch import receiver
from .models import AuditLog, AuditLogChange
from apps.common.middleware import get_current_request


def _value_to_str(value):
    """Convert any Python value to a plain string for relational storage."""
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if hasattr(value, '_id'):
        return str(value._id)
    if hasattr(value, 'pk'):
        return str(value.pk)
    if isinstance(value, (list, dict)):
        return None
    return str(value)


def _has_uuid_field(instance):
    """Check if the model has a UUID field named '_id' that is a UUID instance."""
    if not hasattr(instance, '_id'):
        return False
    return isinstance(instance._id, uuid.UUID)


def _should_skip(sender):
    return (
        sender.__name__ in ('AuditLog', 'AuditLogChange')
        or sender._meta.app_label in ['admin', 'auth', 'contenttypes', 'sessions']
        or sender.__name__ == 'Migration'
    )


@receiver(pre_save)
def audit_pre_save(sender, instance, **kwargs):
    """Capture old field values before update so post_save can detect changes."""
    if not _has_uuid_field(instance):
        return
    if _should_skip(sender):
        return
    if not instance.pk:
        return

    try:
        old = sender.objects.get(pk=instance.pk)
        old_values = {}
        for field in instance._meta.fields:
            field_name = field.name
            if field_name.startswith('_'):
                continue
            old_values[field_name] = getattr(old, field_name)
        instance._old_values = old_values
    except sender.DoesNotExist:
        pass


def _get_field_changes(instance, created):
    """Collect field changes as list of (field_name, old_value, new_value) tuples."""
    changes = []
    if not created:
        old_values = getattr(instance, '_old_values', None)
        if old_values is not None:
            for field in instance._meta.fields:
                field_name = field.name
                if field_name.startswith('_'):
                    continue
                old_val = old_values.get(field_name)
                new_val = getattr(instance, field_name)
                if old_val != new_val:
                    old_str = _value_to_str(old_val)
                    new_str = _value_to_str(new_val)
                    if old_str is not None or new_str is not None:
                        changes.append((field_name, old_str, new_str))
        else:
            try:
                old_instance = instance.__class__.objects.get(pk=instance.pk)
                for field in instance._meta.fields:
                    field_name = field.name
                    if field_name.startswith('_'):
                        continue
                    old_val = getattr(old_instance, field_name)
                    new_val = getattr(instance, field_name)
                    if old_val != new_val:
                        old_str = _value_to_str(old_val)
                        new_str = _value_to_str(new_val)
                        if old_str is not None or new_str is not None:
                            changes.append((field_name, old_str, new_str))
            except instance.__class__.DoesNotExist:
                pass
    else:
        for field in instance._meta.fields:
            field_name = field.name
            if field_name.startswith('_'):
                continue
            val = getattr(instance, field_name)
            if val is not None:
                val_str = _value_to_str(val)
                if val_str is not None:
                    changes.append((field_name, None, val_str))
    return changes


@receiver(post_save)
def audit_create_update(sender, instance, created, **kwargs):
    """Log creation or update of any model that has a UUID _id field."""
    if not _has_uuid_field(instance):
        return

    if _should_skip(sender):
        return

    request = get_current_request()

    user = getattr(request, 'user', None) if request else None
    ip = None
    user_agent = None
    if request:
        ip = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:255]

    field_changes = _get_field_changes(instance, created)

    module = sender._meta.app_label
    record_id = str(instance._id)

    audit_data = {
        'model_name': sender.__name__,
        'record_id': record_id,
        'action': 'CREATE' if created else 'UPDATE',
        'user': user,
        'ip_address': ip,
        'user_agent': user_agent,
        'module': module,
    }
    if hasattr(instance, 'company_id') and instance.company_id:
        audit_data['company_id'] = instance.company_id
    elif hasattr(instance, 'company') and instance.company and hasattr(instance.company, 'id'):
        audit_data['company_id'] = instance.company.id

    if hasattr(instance, 'branch_id') and instance.branch_id:
        audit_data['branch_id'] = instance.branch_id

    if not field_changes and not created:
        return

    audit_log = AuditLog.objects.create(**audit_data)

    change_objects = [
        AuditLogChange(
            audit_log=audit_log,
            field_name=field_name,
            old_value=old_val,
            new_value=new_val,
            company_id=audit_data.get('company_id'),
            branch_id=audit_data.get('branch_id'),
        )
        for field_name, old_val, new_val in field_changes
    ]
    if change_objects:
        AuditLogChange.objects.bulk_create(change_objects)


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

    request = get_current_request()
    user = getattr(request, 'user', None) if request else None
    ip = None
    user_agent = None
    if request:
        ip = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:255]

    module = sender._meta.app_label
    record_id = str(instance._id)

    audit_data = {
        'model_name': sender.__name__,
        'record_id': record_id,
        'action': 'DELETE',
        'user': user,
        'ip_address': ip,
        'user_agent': user_agent,
        'module': module,
    }
    if hasattr(instance, 'company_id') and instance.company_id:
        audit_data['company_id'] = instance.company_id
    elif hasattr(instance, 'company') and instance.company and hasattr(instance.company, 'id'):
        audit_data['company_id'] = instance.company.id

    if hasattr(instance, 'branch_id') and instance.branch_id:
        audit_data['branch_id'] = instance.branch_id

    audit_log = AuditLog.objects.create(**audit_data)

    change_objects = []
    for field in instance._meta.fields:
        field_name = field.name
        if field_name.startswith('_'):
            continue
        val = getattr(instance, field_name)
        val_str = _value_to_str(val)
        if val_str is not None:
            change_objects.append(
                AuditLogChange(
                    audit_log=audit_log,
                    field_name=field_name,
                    old_value=val_str,
                    new_value=None,
                    company_id=audit_data.get('company_id'),
                    branch_id=audit_data.get('branch_id'),
                )
            )
    if change_objects:
        AuditLogChange.objects.bulk_create(change_objects)