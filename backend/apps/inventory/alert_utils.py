import logging
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Alert

logger = logging.getLogger(__name__)


def create_alert(company_id, branch_id, alert_type, severity, title, message,
                 entity_type=None, entity_id=None, target_user_id=None):
    """
    Create an alert in DB and broadcast via WebSocket.
    """
    alert = Alert.objects.create(
        company_id=company_id,
        branch_id=branch_id,
        type=alert_type,
        severity=severity,
        title=title,
        message=message,
        entity_type=entity_type or '',
        entity_id=entity_id,
        target_user_id=target_user_id,
    )
    # Broadcast to appropriate group (best-effort; never roll back the alert)
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return alert

        group_name = f"alerts_c{company_id}"
        if branch_id:
            group_name += f"_b{branch_id}"
        if target_user_id:
            group_name += f"_u{target_user_id}"

        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'alert_message',
                'alert': {
                    'id': str(alert._id),
                    'type': alert.type,
                    'severity': alert.severity,
                    'title': alert.title,
                    'message': alert.message,
                    'created_at': alert.created_at.isoformat(),
                    'is_read': alert.is_read,
                }
            }
        )
    except Exception as e:
        logger.error(f"Failed to broadcast alert {alert._id}: {e}", exc_info=True)

    return alert