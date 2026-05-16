# apps/notifications/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging
from .models import Notification

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Notification)
def send_notification_on_save(sender, instance, created, **kwargs):
    """Send WebSocket notification when a new notification is created"""
    if not created:
        return
    
    channel_layer = get_channel_layer()
    
    event = {
        'type': 'send_notification',
        'id': str(instance._id),  # Send UUID as string
        'message': instance.message,
        'title': instance.title,
        'notification_type': instance.notification_type,
        'created_at': instance.created_at.isoformat() if instance.created_at else None,
    }
    
    try:
        if instance.user:
            # Send to specific user's personal group
            group_name = f"notify_u{instance.user.id}"
            async_to_sync(channel_layer.group_send)(group_name, event)
            logger.debug(f"Notification sent to user group: {group_name}")
            
        elif instance.company_id and instance.branch_id:
            # Send to company-branch group
            group_name = f"notify_c{instance.company_id}_b{instance.branch_id}"
            async_to_sync(channel_layer.group_send)(group_name, event)
            logger.debug(f"Notification sent to branch group: {group_name}")
            
        elif instance.company_id:
            # Send to company-wide group (no branch)
            group_name = f"notify_c{instance.company_id}_bNone"
            async_to_sync(channel_layer.group_send)(group_name, event)
            logger.debug(f"Notification sent to company group: {group_name}")
            
    except Exception as e:
        logger.error(f"Failed to send WebSocket notification: {str(e)}")


@receiver(post_save, sender=Notification)
def send_notification_to_admins(sender, instance, created, **kwargs):
    """Send critical notifications to all admins in the company"""
    if not created or instance.notification_type not in ['warning', 'error']:
        return
    
    from apps.organization.models import User
    
    channel_layer = get_channel_layer()
    
    # Get all admins in the company
    admins = User.objects.filter(
        company_id=instance.company_id,
        role__in=['COMPANY_ADMIN', 'SUPER_ADMIN'],
        is_active=True
    )
    
    for admin in admins:
        event = {
            'type': 'send_notification',
            'id': str(instance._id),
            'message': f"[ADMIN] {instance.message}",
            'title': f"[CRITICAL] {instance.title}",
            'notification_type': instance.notification_type,
            'created_at': instance.created_at.isoformat() if instance.created_at else None,
        }
        
        group_name = f"notify_u{admin.id}"
        
        try:
            async_to_sync(channel_layer.group_send)(group_name, event)
        except Exception as e:
            logger.error(f"Failed to send admin notification: {str(e)}")