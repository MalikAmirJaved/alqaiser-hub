# apps/permissions/views_extended.py
# ─────────────────────────────────────────────────────────────────────────────
# Additional API views required by the Permission Management UI:
#
#   GET  /api/permissions/modules/?user_id=<id>   → ModulesTreeView (extended)
#   GET  /api/permissions/users/<id>/roles/        → UserRolesView
#   POST /api/permissions/users/<id>/assign-role/  → AssignRoleView
#   DEL  /api/permissions/users/<id>/remove-role/<role_id>/ → RemoveRoleView
#   GET  /api/permissions/users/<id>/overrides/    → UserOverridesView
#   DEL  /api/permissions/users/<id>/overrides/<ov_id>/ → OverrideDetailView
#   POST /api/permissions/users/<id>/bulk-override/ → BulkOverrideView
#   GET  /api/permissions/roles/                   → RoleListView
#
# Wire these in urls.py (see bottom of file).
# ─────────────────────────────────────────────────────────────────────────────

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import (
    Module, Permission, UserRole, RolePermission, UserPermission, Role,
    PermissionAuditLog,
)
from .services import PermissionService

User = get_user_model()


# ─────────────────────────────────────────────────────────────────────────────
# Helper: resolve user scoped to current admin's company
# ─────────────────────────────────────────────────────────────────────────────

def _get_company_user(request, user_id: int):
    """Return a User that belongs to the request user's company, or 404."""
    return get_object_or_404(
        User,
        id=user_id,
        company=request.user.company,
        is_deleted=False,
    )


def _compute_granted_ids(user) -> set:
    """Return the set of granted permission IDs for a user (same logic as views.py)."""
    role_ids = UserRole.objects.filter(user=user).values_list("role_id", flat=True)
    role_perm_ids = set(
        RolePermission.objects.filter(role_id__in=role_ids, granted=True)
        .values_list("permission_id", flat=True)
    )
    user_overrides = {up.permission_id: up.granted for up in UserPermission.objects.filter(user=user)}
    granted_ids = set()
    for pid in role_perm_ids:
        if user_overrides.get(pid, True):
            granted_ids.add(pid)
    for pid, granted in user_overrides.items():
        if granted:
            granted_ids.add(pid)
    return granted_ids


# ─────────────────────────────────────────────────────────────────────────────
# Modules tree — accepts optional ?user_id= query param (admin viewing another user)
# ─────────────────────────────────────────────────────────────────────────────

class ModulesTreeView(APIView):
    """
    GET /api/permissions/modules/
    GET /api/permissions/modules/?user_id=42

    Returns nested module → resource → action tree with granted flags.
    Without user_id, uses the requesting user (as before).
    With user_id, resolves that user (company-scoped) — admin only.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        uid = request.query_params.get("user_id")
        if uid:
            # Company admin viewing another user
            target_user = _get_company_user(request, int(uid))
        else:
            target_user = request.user

        if target_user.is_superuser:
            granted_codes = set(Permission.objects.values_list("code", flat=True))
        else:
            granted_ids = _compute_granted_ids(target_user)
            granted_codes = set(
                Permission.objects.filter(id__in=granted_ids).values_list("code", flat=True)
            )

        modules = Module.objects.filter(is_active=True).prefetch_related(
            "resources__permissions__action"
        )

        data = []
        for module in modules:
            resources = []
            for resource in module.resources.filter(is_active=True):
                actions_list = [
                    {
                        "code": perm.action.code,
                        "name": perm.action.name,
                        "granted": perm.code in granted_codes,
                    }
                    for perm in resource.permissions.all()
                ]
                if actions_list:
                    resources.append({
                        "code": resource.code,
                        "name": resource.name,
                        "actions": actions_list,
                    })
            if resources:
                data.append({
                    "code": module.code,
                    "name": module.name,
                    "resources": resources,
                })

        return Response(data)


# ─────────────────────────────────────────────────────────────────────────────
# Roles
# ─────────────────────────────────────────────────────────────────────────────

class RoleListView(APIView):
    """GET /api/permissions/roles/ — list all roles with permission count."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roles = Role.objects.all().order_by("name")
        data = [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "is_system": r.is_system,
                "permission_count": r.permissions.filter(granted=True).count(),
            }
            for r in roles
        ]
        return Response(data)


# ─────────────────────────────────────────────────────────────────────────────
# User ↔ Role management
# ─────────────────────────────────────────────────────────────────────────────

class UserRolesView(APIView):
    """GET /api/permissions/users/<id>/roles/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id: int):
        target = _get_company_user(request, user_id)
        roles = UserRole.objects.filter(user=target).select_related("role")
        data = [
            {
                "id": ur.id,
                "role": {
                    "id": ur.role.id,
                    "name": ur.role.name,
                    "description": ur.role.description,
                    "is_system": ur.role.is_system,
                },
                "assigned_at": ur.assigned_at,
            }
            for ur in roles
        ]
        return Response(data)


class AssignRoleView(APIView):
    """POST /api/permissions/users/<id>/assign-role/ { role_id }"""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id: int):
        target = _get_company_user(request, user_id)
        role_id = request.data.get("role_id")
        if not role_id:
            return Response({"error": "role_id required"}, status=400)

        role = get_object_or_404(Role, id=role_id)
        ur, created = UserRole.objects.get_or_create(user=target, role=role)
        if not created:
            return Response({"detail": "Role already assigned"}, status=200)

        # Audit
        PermissionAuditLog.objects.create(
            user=request.user,
            action="role_assigned",
            target_user=target,
            role=role,
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        PermissionService.invalidate_user_cache(target)
        return Response({"detail": "Role assigned"}, status=201)


class RemoveRoleView(APIView):
    """DELETE /api/permissions/users/<id>/remove-role/<role_id>/"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id: int, role_id: int):
        target = _get_company_user(request, user_id)
        role = get_object_or_404(Role, id=role_id)

        if role.is_system:
            return Response({"error": "System roles cannot be removed"}, status=403)

        deleted, _ = UserRole.objects.filter(user=target, role=role).delete()
        if not deleted:
            return Response({"error": "Role not assigned"}, status=404)

        PermissionAuditLog.objects.create(
            user=request.user,
            action="role_removed",
            target_user=target,
            role=role,
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        PermissionService.invalidate_user_cache(target)
        return Response(status=204)


# ─────────────────────────────────────────────────────────────────────────────
# User overrides
# ─────────────────────────────────────────────────────────────────────────────

class UserOverridesView(APIView):
    """GET /api/permissions/users/<id>/overrides/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id: int):
        target = _get_company_user(request, user_id)
        overrides = UserPermission.objects.filter(user=target).select_related(
            "permission", "granted_by"
        )
        data = [
            {
                "id": ov.id,
                "permission": {
                    "id": ov.permission.id,
                    "code": ov.permission.code,
                    "description": ov.permission.description,
                },
                "granted": ov.granted,
                "reason": ov.reason,
                "expires_at": ov.expires_at,
                "created_at": ov.created_at,
                "granted_by": (
                    {"id": ov.granted_by.id, "username": ov.granted_by.username}
                    if ov.granted_by
                    else None
                ),
            }
            for ov in overrides
        ]
        return Response(data)


class OverrideDetailView(APIView):
    """DELETE /api/permissions/users/<id>/overrides/<ov_id>/"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id: int, override_id: int):
        target = _get_company_user(request, user_id)
        override = get_object_or_404(UserPermission, id=override_id, user=target)
        override.delete()

        PermissionAuditLog.objects.create(
            user=request.user,
            action="override_removed",
            target_user=target,
            permission=override.permission,
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        PermissionService.invalidate_user_cache(target)
        return Response(status=204)


# ─────────────────────────────────────────────────────────────────────────────
# Bulk override — the main mutation from the UI
# ─────────────────────────────────────────────────────────────────────────────

class BulkOverrideView(APIView):
    """
    POST /api/permissions/users/<id>/bulk-override/
    Body: { permissions: [{ permission_code, granted, reason? }] }

    For each entry:
      - If the resulting grant state matches the user's role-inherited state,
        remove any existing override (keep it clean).
      - Otherwise, upsert a UserPermission override.
      
    Performance optimization: Disables individual WebSocket broadcasts during
    the bulk operation and sends a single broadcast at the end.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id: int):
        from .signals import disable_permission_broadcasts, enable_permission_broadcasts, _broadcast_permission
        
        target = _get_company_user(request, user_id)
        items = request.data.get("permissions", [])
        if not items:
            return Response({"error": "permissions list is required"}, status=400)

        # Pre-fetch role-inherited grants so we can decide whether to keep/remove overrides
        role_ids = UserRole.objects.filter(user=target).values_list("role_id", flat=True)
        role_perm_ids = set(
            RolePermission.objects.filter(role_id__in=role_ids, granted=True)
            .values_list("permission_id", flat=True)
        )

        errors = []
        processed = 0

        # Disable individual WebSocket broadcasts during bulk operation
        disable_permission_broadcasts()
        
        try:
            for item in items:
                code = item.get("permission_code")
                granted = item.get("granted")
                reason = item.get("reason", "")

                if code is None or granted is None:
                    errors.append(f"Invalid entry: {item}")
                    continue

                try:
                    perm = Permission.objects.get(code=code)
                except Permission.DoesNotExist:
                    errors.append(f"Permission not found: {code}")
                    continue

                # Determine role-inherited state (True = granted via role, False = denied)
                inherited = perm.id in role_perm_ids

                if granted == inherited:
                    # No override needed — remove any existing one
                    UserPermission.objects.filter(user=target, permission=perm).delete()
                else:
                    # Upsert override
                    obj, created = UserPermission.objects.update_or_create(
                        user=target,
                        permission=perm,
                        defaults={
                            "granted": granted,
                            "granted_by": request.user,
                            "reason": reason,
                        },
                    )
                    PermissionAuditLog.objects.create(
                        user=request.user,
                        action="override_added" if created else "override_updated",
                        target_user=target,
                        permission=perm,
                        old_value=not granted if not created else None,
                        new_value=granted,
                        ip_address=request.META.get("REMOTE_ADDR"),
                    )

                processed += 1
        finally:
            # Re-enable broadcasts
            enable_permission_broadcasts()

        # Invalidate cache and send a single broadcast after all changes
        PermissionService.invalidate_user_cache(target)
        _broadcast_permission(target.id)

        response = {"processed": processed}
        if errors:
            response["errors"] = errors
        return Response(response, status=200 if not errors else 207)

# ─────────────────────────────────────────────────────────────────────────────
# urls.py addition
# ─────────────────────────────────────────────────────────────────────────────
#
# from django.urls import path
# from .views import UserPermissionsView
# from .views_extended import (
#     ModulesTreeView, RoleListView,
#     UserRolesView, AssignRoleView, RemoveRoleView,
#     UserOverridesView, OverrideDetailView, BulkOverrideView,
# )
#
# urlpatterns = [
#     path("me/",                                  UserPermissionsView.as_view()),
#     path("modules/",                             ModulesTreeView.as_view()),
#     path("roles/",                               RoleListView.as_view()),
#     path("users/<int:user_id>/roles/",           UserRolesView.as_view()),
#     path("users/<int:user_id>/assign-role/",     AssignRoleView.as_view()),
#     path("users/<int:user_id>/remove-role/<int:role_id>/", RemoveRoleView.as_view()),
#     path("users/<int:user_id>/overrides/",       UserOverridesView.as_view()),
#     path("users/<int:user_id>/overrides/<int:override_id>/", OverrideDetailView.as_view()),
#     path("users/<int:user_id>/bulk-override/",   BulkOverrideView.as_view()),
# ]