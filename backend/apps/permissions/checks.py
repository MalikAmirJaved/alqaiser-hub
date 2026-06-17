"""
apps/permissions/checks.py

Lightweight permission-check helpers.
All checks delegate to PermissionService (which is cache-backed).

Code format:  MODULE:resource:action   e.g. "HR:employee:activate"
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework.exceptions import PermissionDenied

from .services import PermissionService

User = get_user_model()


def build_permission_code(module: str, resource: str, action: str) -> str:
    """Build canonical permission code, e.g. "HR:employee:activate"."""
    return f"{module.upper()}:{resource.lower()}:{action.lower()}"


def check_permission(user, module: str, resource: str, action: str) -> bool:
    """
    Return True if *user* may perform *action* on *resource* within *module*.

    Examples:
        check_permission(request.user, "HR", "employee", "activate")
        check_permission(request.user, "INVENTORY", "purchase_order", "receive_goods")
        check_permission(request.user, "HR", "compensation", "view_loan")
    """
    if user is None or not getattr(user, "is_authenticated", False):
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
            "error":    "You do not have permission to perform this action.",
            "permission": code,
            "module":   module.upper(),
            "resource": resource.lower(),
            "action":   action.lower(),
        }
    )


def check_permission_code(user, perm_code: str) -> bool:
    """
    Direct code-based check (skip the builder step).

    Example:
        check_permission_code(request.user, "HR:compensation:view_loan")
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    return PermissionService.user_has_permission(user, perm_code)