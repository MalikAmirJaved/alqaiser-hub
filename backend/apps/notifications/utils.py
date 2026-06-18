# apps/notifications/utils.py
import logging
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.db import transaction

logger = logging.getLogger(__name__)


def broadcast_data_update(company_id, branch_id, entity, action=None, record_id=None):
    """
    Send a WebSocket 'data_update' message to the company/branch group.
    - company_id, branch_id: can be None or integer.
    - entity: string identifier used by frontend (e.g., 'employee', 'product').
    - action: 'create', 'update', 'delete' (optional)
    - record_id: integer PK or UUID (will be stringified)
    """
    if company_id is None:
        logger.warning(f"broadcast_data_update called without company_id for entity {entity}")
        return

    channel_layer = get_channel_layer()
    group_name = f"notify_c{company_id}_b{branch_id}" if branch_id else f"notify_c{company_id}_bNone"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'data_update',
            'entity': entity,
            'action': action,
            'record_id': str(record_id) if record_id else None,
        }
    )


# ─────────────────────────────────────────────
# USER NOTIFICATIONS (DB + WebSocket push)
# ─────────────────────────────────────────────

def send_user_notification(user_id, title, message, notification_type="info",
                           company_id=None, branch_id=None, created_by_id=None):
    """
    Create a Notification DB record for a specific user and push it
    via WebSocket to that user's personal group (notify_u{id}).

    Returns the created Notification instance (or None if user_id is missing).
    """
    from .models import Notification

    if not user_id:
        logger.warning("send_user_notification called without user_id")
        return None

    try:
        notification = Notification.objects.create(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            company_id=company_id,
            branch_id=branch_id,
            created_by_id=created_by_id,
        )
    except Exception as e:
        logger.error(f"Failed to create notification: {e}", exc_info=True)
        return None

    _send_ws_notification(
        group=f"notify_u{user_id}",
        notif_id=str(notification._id),
        title=title,
        message=message,
        notification_type=notification_type,
        created_at=notification.created_at,
    )

    return notification


def broadcast_notification(company_id, branch_id, title, message,
                           notification_type="info", created_by_id=None,
                           exclude_user_id=None):
    """
    Create a broadcast Notification (user=NULL, company-wide) and push it
    via WebSocket to the company/branch group (notify_c{id}_b{id}).

    Returns the created Notification instance (or None if company_id is missing).
    """
    from .models import Notification

    if company_id is None:
        logger.warning(f"broadcast_notification called without company_id: {title}")
        return None

    try:
        notification = Notification.objects.create(
            user=None,
            title=title,
            message=message,
            notification_type=notification_type,
            company_id=company_id,
            branch_id=branch_id,
            created_by_id=created_by_id,
        )
    except Exception as e:
        logger.error(f"Failed to create broadcast notification: {e}", exc_info=True)
        return None

    group_name = f"notify_c{company_id}_b{branch_id}" if branch_id else f"notify_c{company_id}_bNone"
    _send_ws_notification(
        group=group_name,
        notif_id=str(notification._id),
        title=title,
        message=message,
        notification_type=notification_type,
        created_at=notification.created_at,
    )

    return notification


def _send_ws_notification(group, notif_id, title, message, notification_type,
                          created_at):
    """Low-level helper to push a 'notification' event to a channel layer group."""
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            logger.warning("Channel layer not available, skipping WS push")
            return

        async_to_sync(channel_layer.group_send)(
            group,
            {
                'type': 'send_notification',
                'id': notif_id,
                'title': title,
                'message': message,
                'notification_type': notification_type,
                'created_at': created_at.isoformat() if created_at else None,
            }
        )
    except Exception as e:
        logger.error(f"Failed to send WS notification to {group}: {e}", exc_info=True)


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def get_company_branch(instance):
    """Extract company_id and branch_id from a model instance using common field names."""
    company_id = getattr(instance, 'company_id', None)
    branch_id = getattr(instance, 'branch_id', None)

    meta = getattr(instance, '_meta', None)

    # If the instance itself is a Company, its own id IS the company_id
    if company_id is None and meta and meta.model_name == 'company' and hasattr(instance, 'id'):
        company_id = instance.id

    # If the instance itself is a Branch, its own id IS the branch_id
    if branch_id is None and meta and meta.model_name == 'branch' and hasattr(instance, 'id'):
        branch_id = instance.id

    # Fallback for models that have a FK to Company/Branch but not direct ID fields
    if company_id is None and hasattr(instance, 'company'):
        company_id = getattr(instance.company, 'id', None)
    if branch_id is None and hasattr(instance, 'branch'):
        branch_id = getattr(instance.branch, 'id', None)

    return company_id, branch_id


def entity_display_name(entity):
    """Convert snake_case entity key to a human-readable name."""
    return entity.replace('_', ' ').title()