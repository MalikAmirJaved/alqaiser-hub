# consumers/permission_consumer.py
# ─────────────────────────────────────────────────────────────────────────────
# Django Channels WebSocket consumer for real-time permission change broadcasts.
#
# Setup:
#   pip install channels channels-redis
#
#   settings.py:
#     INSTALLED_APPS += ["channels"]
#     ASGI_APPLICATION = "yourproject.asgi.application"
#     CHANNEL_LAYERS = {
#         "default": {
#             "BACKEND": "channels_redis.core.RedisChannelLayer",
#             "CONFIG": {"hosts": [("127.0.0.1", 6379)]},
#         }
#     }
#
#   asgi.py:
#     from channels.routing import ProtocolTypeRouter, URLRouter
#     from channels.auth import AuthMiddlewareStack
#     from django.urls import path
#     from consumers.permission_consumer import PermissionConsumer
#
#     application = ProtocolTypeRouter({
#         "http": get_asgi_application(),
#         "websocket": AuthMiddlewareStack(
#             URLRouter([
#                 path("ws/permissions/", PermissionConsumer.as_asgi()),
#             ])
#         ),
#     })
# ─────────────────────────────────────────────────────────────────────────────

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import async_to_sync   # ✅ Fix: use async_to_sync instead of manual event loop

logger = logging.getLogger(__name__)

# All authenticated clients join this group so they receive broadcasts
PERMISSION_GROUP = "permissions_global"


class PermissionConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer that:
    - Authenticates the connecting user (requires AuthMiddlewareStack)
    - Joins the global permission broadcast group
    - Receives push messages and forwards them to the client
    - Provides a helper class method `broadcast_change` to be called from
      signals or service layer after any permission mutation.
    """

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.user_id = user.id
        # Every user joins the global group; filtering happens client-side
        await self.channel_layer.group_add(PERMISSION_GROUP, self.channel_name)
        # Also join a user-specific group for targeted messages
        await self.channel_layer.group_add(f"user_permissions_{user.id}", self.channel_name)
        await self.accept()
        logger.debug(f"PermissionConsumer: user {user.id} connected")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(PERMISSION_GROUP, self.channel_name)
        if hasattr(self, "user_id"):
            await self.channel_layer.group_discard(
                f"user_permissions_{self.user_id}", self.channel_name
            )

    # ── Handlers for messages forwarded from the channel layer ──────────────

    async def permission_changed(self, event):
        """Broadcast: a specific user's direct permissions changed."""
        await self.send(text_data=json.dumps({
            "type": "permission_changed",
            "user_id": event["user_id"],
        }))

    async def role_changed(self, event):
        """Broadcast: a role was assigned to / removed from a user."""
        await self.send(text_data=json.dumps({
            "type": "role_changed",
            "user_id": event["user_id"],
        }))

    async def self_permission_changed(self, event):
        """
        Sent only to the affected user's own WebSocket connection.
        Triggers the frontend to reload its Redux permission store.
        """
        await self.send(text_data=json.dumps({
            "type": "self_permission_changed",
        }))

    # ── Class-level broadcast helpers (called from signals.py) ───────────────

    @classmethod
    async def _send_group(cls, channel_layer, group: str, message: dict):
        await channel_layer.group_send(group, message)

    @classmethod
    def broadcast_permission_changed(cls, channel_layer, user_id: int):
        """
        Call after UserPermission create/update/delete for `user_id`.

        Usage (from a signal or service):
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            from consumers.permission_consumer import PermissionConsumer

            async_to_sync(PermissionConsumer.broadcast_permission_changed)(
                get_channel_layer(), user.id
            )
        """
        async def _broadcast():
            await channel_layer.group_send(
                PERMISSION_GROUP,
                {"type": "permission_changed", "user_id": user_id},
            )
            # Also push self_permission_changed directly to the affected user
            await channel_layer.group_send(
                f"user_permissions_{user_id}",
                {"type": "self_permission_changed"},
            )
        async_to_sync(_broadcast)()

    @classmethod
    def broadcast_role_changed(cls, channel_layer, user_id: int):
        """Call after UserRole create/delete for `user_id`."""
        async def _broadcast():
            await channel_layer.group_send(
                PERMISSION_GROUP,
                {"type": "role_changed", "user_id": user_id},
            )
            await channel_layer.group_send(
                f"user_permissions_{user_id}",
                {"type": "self_permission_changed"},
            )
        async_to_sync(_broadcast)()