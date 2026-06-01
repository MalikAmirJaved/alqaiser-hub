# apps/notifications/signals.py
import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db import transaction
from .registry import get_registered_models
from .utils import broadcast_data_update, get_company_branch

logger = logging.getLogger(__name__)


@receiver(post_save)
def broadcast_model_save(sender, instance, created, **kwargs):
    """Broadcast 'create' or 'update' for registered models."""
    registry = get_registered_models()
    if sender not in registry:
        return

    entity = registry[sender]
    action = 'create' if created else 'update'
    company_id, branch_id = get_company_branch(instance)

    # Send after transaction commit to avoid sending before DB flush
    transaction.on_commit(
        lambda: broadcast_data_update(company_id, branch_id, entity, action, instance.pk)
    )


@receiver(post_delete)
def broadcast_model_delete(sender, instance, **kwargs):
    """Broadcast 'delete' for registered models."""
    registry = get_registered_models()
    if sender not in registry:
        return

    entity = registry[sender]
    company_id, branch_id = get_company_branch(instance)

    transaction.on_commit(
        lambda: broadcast_data_update(company_id, branch_id, entity, 'delete', instance.pk)
    )