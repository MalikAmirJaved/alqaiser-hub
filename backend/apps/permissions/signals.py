# apps/permissions/signals.py
# ─────────────────────────────────────────────────────────────────────────────
# Django signals that:
#   1. Invalidate the Redis permission cache (existing behaviour)
#   2. Broadcast a WebSocket push to connected clients via Django Channels
# ─────────────────────────────────────────────────────────────────────────────

import logging
from asgiref.sync import async_to_sync
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import UserPermission, RolePermission, UserRole
from .services import PermissionService

logger = logging.getLogger(__name__)


def _get_channel_layer():
    """Lazily import channel layer to avoid issues in environments without Channels."""
    try:
        from channels.layers import get_channel_layer
        return get_channel_layer()
    except ImportError:
        return None


def _broadcast_permission(user_id: int):
    channel_layer = _get_channel_layer()
    if channel_layer is None:
        return
    try:
        from consumers.permission_consumer import PermissionConsumer
        PermissionConsumer.broadcast_permission_changed(channel_layer, user_id)
    except Exception as exc:
        logger.warning(f"Could not broadcast permission change for user {user_id}: {exc}")


def _broadcast_role(user_id: int):
    channel_layer = _get_channel_layer()
    if channel_layer is None:
        return
    try:
        from consumers.permission_consumer import PermissionConsumer
        PermissionConsumer.broadcast_role_changed(channel_layer, user_id)
    except Exception as exc:
        logger.warning(f"Could not broadcast role change for user {user_id}: {exc}")


# ── UserPermission signals ───────────────────────────────────────────────────

@receiver([post_save, post_delete], sender=UserPermission)
def invalidate_user_permission_cache(sender, instance, **kwargs):
    PermissionService.invalidate_user_cache(instance.user)
    _broadcast_permission(instance.user_id)


# ── UserRole signals ─────────────────────────────────────────────────────────

@receiver([post_save, post_delete], sender=UserRole)
def invalidate_user_role_cache(sender, instance, **kwargs):
    PermissionService.invalidate_user_cache(instance.user)
    _broadcast_role(instance.user_id)


# ── RolePermission signals ───────────────────────────────────────────────────

@receiver([post_save, post_delete], sender=RolePermission)
def invalidate_role_permission_cache(sender, instance, **kwargs):
    """
    When a role's permissions change, all users holding that role must be
    notified — both cache-busted and pushed via WebSocket.
    """
    affected_user_ids = list(
        UserRole.objects.filter(role=instance.role).values_list("user_id", flat=True)
    )

    for user_role in UserRole.objects.filter(role=instance.role).select_related("user"):
        PermissionService.invalidate_user_cache(user_role.user)

    for uid in affected_user_ids:
        _broadcast_permission(uid)