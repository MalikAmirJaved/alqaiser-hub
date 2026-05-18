# apps/notifications/consumers.py
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from .models import Notification
from django.utils import timezone

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time notifications with UUID support"""
    
    async def connect(self):
        self.user = self.scope["user"]
        
        if not self.user or self.user.is_anonymous:
            logger.warning("WebSocket connection rejected: user not authenticated")
            await self.close()
            return
        
        # Get company_id and branch_id from URL (as UUIDs or strings)
        self.company_id = self.scope['url_route']['kwargs'].get('company_id')
        self.branch_id = self.scope['url_route']['kwargs'].get('branch_id')
        
        # Convert string IDs to integers if needed (for backward compatibility)
        try:
            self.company_id = int(self.company_id) if self.company_id and self.company_id.isdigit() else self.company_id
            self.branch_id = int(self.branch_id) if self.branch_id and self.branch_id.isdigit() else self.branch_id
        except (ValueError, AttributeError):
            pass
        
        # Company-branch group for broadcast notifications
        self.group_name = f"notify_c{self.company_id}_b{self.branch_id}" if self.company_id else None
        
        # Personal group for user-specific notifications
        self.user_group_name = f"notify_u{self.user.id}"
        
        # Join groups
        if self.group_name:
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
        
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send initial unread count
        await self.send_unread_count()
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if hasattr(self, 'group_name') and self.group_name:
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
        
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )
        
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            action = data.get('action')
            
            if action == 'mark_read':
                notification_id = data.get('notification_id')
                await self.mark_notification_read(notification_id)
            elif action == 'mark_all_read':
                await self.mark_all_notifications_read()
            elif action == 'get_unread_count':
                await self.send_unread_count()
            elif action == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {text_data}")
        except Exception as e:
            logger.error(f"Error processing WebSocket message: {str(e)}")
    
    async def send_notification(self, event):
        """Send notification to client"""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'id': event.get('id'),
            'message': event.get('message'),
            'title': event.get('title', 'Notification'),
            'notification_type': event.get('notification_type', 'info'),
            'created_at': event.get('created_at'),
        }))
        
        # Send updated unread count after new notification
        await self.send_unread_count()
    
    async def data_update(self, event):
        """Send data update to trigger cache invalidation on frontend"""
        await self.send(text_data=json.dumps({
            'type': 'data_update',
            'entity': event.get('entity'),
            'action': event.get('action'),
            'record_id': event.get('record_id'),
        }))
    
    @database_sync_to_async
    def mark_notification_read(self, notification_uuid):
        """Mark a notification as read"""
        try:
            notification = Notification.objects.get(_id=notification_uuid, user=self.user, is_deleted=False)
            notification.mark_as_read()
            return True
        except Notification.DoesNotExist:
            return False
    
    @database_sync_to_async
    def mark_all_notifications_read(self):
        """Mark all user notifications as read"""
        count = Notification.objects.filter(
            user=self.user,
            is_read=False,
            is_deleted=False
        ).count()
        
        Notification.objects.filter(
            user=self.user,
            is_read=False,
            is_deleted=False
        ).update(is_read=True, read_at=timezone.now())
        
        return count
    
    @database_sync_to_async
    def get_unread_count(self):
        """Get unread notification count"""
        return Notification.objects.filter(
            user=self.user,
            is_read=False,
            is_deleted=False
        ).count()
    
    async def send_unread_count(self):
        """Send unread notification count to client"""
        count = await self.get_unread_count()
        await self.send(text_data=json.dumps({
            'type': 'unread_count',
            'count': count
        }))