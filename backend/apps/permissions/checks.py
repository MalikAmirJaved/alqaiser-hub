"""
Permission check helpers aligned with seed format: MODULE:resource:action
"""
from __future__ import annotations

from typing import Union

from django.contrib.auth import get_user_model
from rest_framework.exceptions import PermissionDenied

from .services import PermissionService

User = get_user_model()


def build_permission_code(module: str, resource: str, action: str) -> str:
    """Build canonical permission code, e.g. INVENTORY:product:create."""
    return f"{module.upper()}:{resource.lower()}:{action.lower()}"


def check_permission(user, module: str, resource: str, action: str) -> bool:
    """
    Return True if the user may perform action on resource within module.

    Example:
        check_permission(request.user, 'INVENTORY', 'product', 'create')
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    code = build_permission_code(module, resource, action)
    return PermissionService.user_has_permission(user, code)


def check_permission_by_user_id(
    user_id: int,
    module: str,
    resource: str,
    action: str,
) -> bool:
    """Same as check_permission but accepts a user primary key."""
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return False
    return check_permission(user, module, resource, action)


def require_permission(user, module: str, resource: str, action: str) -> None:
    """Raise DRF PermissionDenied when the user lacks the permission."""
    if check_permission(user, module, resource, action):
        return
    code = build_permission_code(module, resource, action)
    raise PermissionDenied(
        detail={
            'error': 'You do not have permission to perform this action.',
            'permission': code,
            'module': module.upper(),
            'resource': resource.lower(),
            'action': action.lower(),
        }
    )
