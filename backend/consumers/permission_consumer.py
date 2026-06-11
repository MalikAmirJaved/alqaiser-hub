import json
import logging

from asgiref.sync import async_to_sync
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

PERMISSION_GROUP = "permissions_global"


class PermissionConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time permission updates.
    """

    async def connect(self):
        user = self.scope.get("user")

        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.user_id = user.id

        # Join global permission group
        await self.channel_layer.group_add(
            PERMISSION_GROUP,
            self.channel_name
        )

        # Join user-specific group
        await self.channel_layer.group_add(
            f"user_permissions_{user.id}",
            self.channel_name
        )

        await self.accept()
        logger.debug(f"PermissionConsumer connected: user={user.id}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            PERMISSION_GROUP,
            self.channel_name
        )

        if hasattr(self, "user_id"):
            await self.channel_layer.group_discard(
                f"user_permissions_{self.user_id}",
                self.channel_name
            )

    # ─────────────────────────────────────────────
    # Event handlers from channel layer
    # ─────────────────────────────────────────────

    async def permission_changed(self, event):
        await self.send(text_data=json.dumps({
            "type": "permission_changed",
            "user_id": event.get("user_id"),
        }))

    async def role_changed(self, event):
        await self.send(text_data=json.dumps({
            "type": "role_changed",
            "user_id": event.get("user_id"),
        }))

    async def self_permission_changed(self, event):
        await self.send(text_data=json.dumps({
            "type": "self_permission_changed",
        }))

    # ─────────────────────────────────────────────
    # Broadcasting helpers
    # ─────────────────────────────────────────────

    @classmethod
    def broadcast_permission_changed(cls, channel_layer, user_id: int):
        async def _send():
            await channel_layer.group_send(
                PERMISSION_GROUP,
                {
                    "type": "permission_changed",
                    "user_id": user_id,
                },
            )
            await channel_layer.group_send(
                f"user_permissions_{user_id}",
                {
                    "type": "self_permission_changed",
                },
            )

        async_to_sync(_send)()

    @classmethod
    def broadcast_role_changed(cls, channel_layer, user_id: int):
        async def _send():
            await channel_layer.group_send(
                PERMISSION_GROUP,
                {
                    "type": "role_changed",
                    "user_id": user_id,
                },
            )
            await channel_layer.group_send(
                f"user_permissions_{user_id}",
                {
                    "type": "self_permission_changed",
                },
            )

        async_to_sync(_send)()