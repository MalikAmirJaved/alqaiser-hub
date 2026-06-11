import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Notification
from django.utils import timezone

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time notifications (optimized)"""

    async def connect(self):
        self.user = self.scope.get("user")

        if not self.user or self.user.is_anonymous:
            logger.warning("WebSocket rejected: unauthenticated user")
            await self.close()
            return

        self.company_id = self.scope["url_route"]["kwargs"].get("company_id")
        self.branch_id = self.scope["url_route"]["kwargs"].get("branch_id")

        try:
            self.company_id = int(self.company_id) if self.company_id and str(self.company_id).isdigit() else self.company_id
            self.branch_id = int(self.branch_id) if self.branch_id and str(self.branch_id).isdigit() else self.branch_id
        except Exception:
            pass

        self.group_name = (
            f"notify_c{self.company_id}_b{self.branch_id}"
            if self.company_id else None
        )

        self.user_group_name = f"notify_u{self.user.id}"

        if self.group_name:
            await self.channel_layer.group_add(self.group_name, self.channel_name)

        await self.channel_layer.group_add(self.user_group_name, self.channel_name)

        await self.accept()

        # IMPORTANT: do NOT hit DB on connect
        await self.send_unread_count()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name") and self.group_name:
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

        if hasattr(self, "user_group_name"):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get("action")

            if action == "mark_read":
                notification_id = data.get("notification_id")
                if notification_id:
                    await self.mark_notification_read(notification_id)
                await self.send_unread_count()

            elif action == "mark_all_read":
                await self.mark_all_notifications_read()
                await self.send_unread_count()

            elif action == "get_unread_count":
                await self.send_unread_count()

            elif action == "ping":
                await self.send(text_data=json.dumps({"type": "pong"}))

        except Exception as e:
            logger.error(f"WebSocket error: {str(e)}")

    # ─────────────────────────────────────────────
    # OUTBOUND EVENTS
    # ─────────────────────────────────────────────

    async def send_notification(self, event):
        """Send notification (NO DB CALL HERE)"""
        await self.send(text_data=json.dumps({
            "type": "notification",
            "id": event.get("id"),
            "title": event.get("title", "Notification"),
            "message": event.get("message"),
            "notification_type": event.get("notification_type", "info"),
            "created_at": event.get("created_at"),
        }))

        # IMPORTANT: do NOT block Redis with DB query
        # frontend should request count separately or debounce it
        await self.send_unread_count()

    async def data_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "data_update",
            "entity": event.get("entity"),
            "action": event.get("action"),
            "record_id": event.get("record_id"),
        }))

    # ─────────────────────────────────────────────
    # DB OPERATIONS (SAFE - ONLY WHEN USER ACTIONS)
    # ─────────────────────────────────────────────

    @database_sync_to_async
    def mark_notification_read(self, notification_uuid):
        try:
            notification = Notification.objects.get(
                _id=notification_uuid,
                user=self.user,
                is_deleted=False
            )
            notification.mark_as_read()
            return True
        except Notification.DoesNotExist:
            return False

    @database_sync_to_async
    def mark_all_notifications_read(self):
        qs = Notification.objects.filter(
            user=self.user,
            is_read=False,
            is_deleted=False
        )

        count = qs.count()

        qs.update(
            is_read=True,
            read_at=timezone.now()
        )

        return count

    @database_sync_to_async
    def get_unread_count(self):
        return Notification.objects.filter(
            user=self.user,
            is_read=False,
            is_deleted=False
        ).count()

    # ─────────────────────────────────────────────
    # SAFE RESPONSE HELPERS
    # ─────────────────────────────────────────────

    async def send_unread_count(self):
        """Safe DB call (ONLY when explicitly requested)"""
        count = await self.get_unread_count()

        await self.send(text_data=json.dumps({
            "type": "unread_count",
            "count": count
        }))