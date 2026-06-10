import uuid
from django.db.models.signals import post_save, pre_delete, pre_save
from django.dispatch import receiver
from django.forms.models import model_to_dict
from .models import AuditLog
from apps.common.middleware import get_current_request

# Store previous state for updates
_previous_state = {}

def get_model_module(model):
    """Map model class to module name."""
    app_label = model._meta.app_label
    if app_label.startswith('apps.'):
        return app_label.split('.')[1]  # e.g., 'hr', 'inventory', 'organization'
    return app_label

def get_audited_models():
    """Return a set of model classes that should be audited (skip AuditLog itself)."""
    from django.apps import apps
    from .models import AuditLog
    audited = set()
    for model in apps.get_models():
        if hasattr(model, '_id') and hasattr(model, 'is_deleted'):
            if model != AuditLog:          # ← skip the audit log model
                audited.add(model)
    return audited

def convert_to_serializable(value):
    """Convert UUID to string for JSON serialization."""
    if isinstance(value, uuid.UUID):
        return str(value)
    return value

@receiver(pre_save)
def capture_previous_state(sender, instance, **kwargs):
    """Store old state before update for audited models."""
    if sender not in get_audited_models():
        return
    if instance.pk:
        try:
            old = sender.objects.get(pk=instance.pk)
            _previous_state[(sender, instance.pk)] = model_to_dict(old)
        except sender.DoesNotExist:
            pass

@receiver(post_save)
def audit_create_update(sender, instance, created, **kwargs):
    if sender not in get_audited_models():
        return

    request = get_current_request()
    user = None
    ip = None
    ua = None
    if request and hasattr(request, 'user') and request.user.is_authenticated:
        user = request.user
        ip = request.META.get('REMOTE_ADDR')
        ua = request.META.get('HTTP_USER_AGENT', '')[:500]

    key = (sender, instance.pk)
    old_state = _previous_state.pop(key, None)

    changes = {}
    if created:
        action = 'CREATE'
        new_dict = model_to_dict(instance)
        for field, new_val in new_dict.items():
            if field not in ['id', '_id', 'created_at', 'updated_at', 'is_deleted']:
                changes[field] = {'old': None, 'new': convert_to_serializable(new_val)}
    elif old_state:
        action = 'UPDATE'
        new_dict = model_to_dict(instance)
        for field, old_val in old_state.items():
            new_val = new_dict.get(field)
            if old_val != new_val:
                changes[field] = {
                    'old': convert_to_serializable(old_val),
                    'new': convert_to_serializable(new_val)
                }
    else:
        return

    if changes:
        AuditLog.objects.create(
            user=user,
            action=action,
            model_name=sender._meta.model_name,
            record_id=instance._id,
            module=get_model_module(sender),
            changes=changes,
            ip_address=ip,
            user_agent=ua,
            company_id=getattr(instance, 'company_id', None),
            branch_id=getattr(instance, 'branch_id', None),
        )

@receiver(pre_delete)
def audit_delete(sender, instance, **kwargs):
    if sender not in get_audited_models():
        return

    request = get_current_request()
    user = None
    ip = None
    ua = None
    if request and hasattr(request, 'user') and request.user.is_authenticated:
        user = request.user
        ip = request.META.get('REMOTE_ADDR')
        ua = request.META.get('HTTP_USER_AGENT', '')[:500]

    old_dict = model_to_dict(instance)
    changes = {}
    for field, old_val in old_dict.items():
        if field not in ['id', '_id', 'created_at', 'updated_at', 'is_deleted']:
            changes[field] = {'old': convert_to_serializable(old_val), 'new': None}

    AuditLog.objects.create(
        user=user,
        action='DELETE',
        model_name=sender._meta.model_name,
        record_id=instance._id,
        module=get_model_module(sender),
        changes=changes,
        ip_address=ip,
        user_agent=ua,
        company_id=getattr(instance, 'company_id', None),
        branch_id=getattr(instance, 'branch_id', None),
    )