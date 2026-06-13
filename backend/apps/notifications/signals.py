from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notification

@receiver(post_save, sender=Notification)
def send_notification_on_save(sender, instance, created, **kwargs):
    if created:
        channel_layer = get_channel_layer()
        event = {
            'type': 'send_notification',
            'message': instance.message,
            'title': instance.title,
            'notification_type': instance.notification_type,
            'created_at': instance.created_at.isoformat() if instance.created_at else None,
        }
        
        if instance.user:
            # Send to specific user
            group_name = f"notify_u{instance.user.id}"
            async_to_sync(channel_layer.group_send)(group_name, event)
        elif instance.company_id and instance.branch_id:
            # Send to specific branch
            group_name = f"notify_c{instance.company_id}_b{instance.branch_id}"
            async_to_sync(channel_layer.group_send)(group_name, event)
