# apps/notifications/signals.py
import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db import transaction
from .registry import get_registered_models
from .utils import broadcast_data_update, broadcast_notification, get_company_branch, entity_display_name

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
        lambda e=entity, c=company_id, b=branch_id, a=action, pk=instance.pk:
        broadcast_data_update(c, b, e, a, pk)
    )

    # For new records — create a notification too (skip updates to avoid noise)
    if created and company_id:
        name = entity_display_name(entity)
        transaction.on_commit(
            lambda c=company_id, b=branch_id, n=name:
            broadcast_notification(
                company_id=c,
                branch_id=b,
                title=f"New {n}",
                message=f"A new {n.lower()} has been created.",
                notification_type="info",
            )
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
        lambda e=entity, c=company_id, b=branch_id, pk=instance.pk:
        broadcast_data_update(c, b, e, 'delete', pk)
    )

    # Notify deletion
    if company_id:
        name = entity_display_name(entity)
        transaction.on_commit(
            lambda c=company_id, b=branch_id, n=name:
            broadcast_notification(
                company_id=c,
                branch_id=b,
                title=f"{n} Deleted",
                message=f"A {n.lower()} has been deleted.",
                notification_type="warning",
            )
        )