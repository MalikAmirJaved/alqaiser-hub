from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from apps.permissions.mixins import PermissionRequiredMixin
from .models import Module, Permission, UserRole, RolePermission, UserPermission

class UserPermissionsView(APIView):
    """Return list of permission codes for the current user (optimised)"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.is_superuser:
            all_codes = Permission.objects.values_list('code', flat=True)
            return Response(list(all_codes))

        # 1. Get user's roles
        role_ids = UserRole.objects.filter(user=user).values_list('role_id', flat=True)

        # 2. Get all granted permissions from roles
        role_perms = set(RolePermission.objects.filter(role_id__in=role_ids, granted=True)
                         .values_list('permission_id', flat=True))

        # 3. User overrides (grant/deny)
        user_overrides = UserPermission.objects.filter(user=user)
        overrides = {up.permission_id: up.granted for up in user_overrides}

        # Apply overrides
        granted_ids = set()
        for pid in role_perms:
            granted = overrides.get(pid, True)
            if granted:
                granted_ids.add(pid)
        # Also add explicitly granted overrides that were not in roles
        for pid, granted in overrides.items():
            if granted:
                granted_ids.add(pid)

        # Fetch permission codes
        perms = Permission.objects.filter(id__in=granted_ids).values_list('code', flat=True)
        return Response(list(perms))


class ModulesTreeView(APIView):
    """Return nested structure of modules → resources → actions with granted flags"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        modules = Module.objects.filter(is_active=True).prefetch_related('resources__permissions__action')

        # Pre‑compute user's granted permissions (as a set of codes)
        if user.is_superuser:
            granted_codes = set(Permission.objects.values_list('code', flat=True))
        else:
            # Same batch logic as above, but we only need codes
            role_ids = UserRole.objects.filter(user=user).values_list('role_id', flat=True)
            role_perm_ids = set(RolePermission.objects.filter(role_id__in=role_ids, granted=True)
                                .values_list('permission_id', flat=True))
            user_overrides = UserPermission.objects.filter(user=user)
            overrides = {up.permission_id: up.granted for up in user_overrides}
            granted_ids = set()
            for pid in role_perm_ids:
                if overrides.get(pid, True):
                    granted_ids.add(pid)
            for pid, granted in overrides.items():
                if granted:
                    granted_ids.add(pid)
            granted_codes = set(Permission.objects.filter(id__in=granted_ids).values_list('code', flat=True))

        data = []
        for module in modules:
            resources = []
            for resource in module.resources.filter(is_active=True):
                actions_list = []
                for perm in resource.permissions.all():
                    actions_list.append({
                        'code': perm.action.code,
                        'name': perm.action.name,
                        'granted': perm.code in granted_codes
                    })
                if actions_list:  # only include resources that have at least one action
                    resources.append({
                        'code': resource.code,
                        'name': resource.name,
                        'actions': actions_list
                    })
            if resources:
                data.append({
                    'code': module.code,
                    'name': module.name,
                    'resources': resources
                })
        return Response(data)