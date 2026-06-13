import json
from channels.generic.websocket import AsyncWebsocketConsumer

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        
        # Require authentication
        if not self.user.is_authenticated:
            await self.close()
            return
            
        self.company_id = self.scope['url_route']['kwargs']['company_id']
        self.branch_id = self.scope['url_route']['kwargs']['branch_id']
        
        # We define a group for company+branch
        self.group_name = f"notify_c{self.company_id}_b{self.branch_id}"
        
        # Join company-branch group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        # Also create a personal group for the user to receive targeted notifications
        self.user_group_name = f"notify_u{self.user.id}"
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave groups
        if hasattr(self, 'group_name'):
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
        # We mainly send notifications from server to client,
        # but if needed, we can handle incoming messages here.
        pass
        
    async def send_notification(self, event):
        message = event['message']
        notification_type = event.get('type', 'info')
        title = event.get('title', 'Notification')
        created_at = event.get('created_at', None)

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message,
            'type': notification_type,
            'title': title,
            'created_at': created_at,
        }))

    async def data_update(self, event):
        """Handle data update messages to trigger cache invalidation on frontend"""
        await self.send(text_data=json.dumps({
            'type': 'data_update',
            'entity': event['entity'],       # e.g., 'assets', 'employees'
            'action': event.get('action'),   # 'create', 'update', 'delete' (optional)
            'record_id': event.get('record_id'),  # optional, for granular invalidation
        }))

