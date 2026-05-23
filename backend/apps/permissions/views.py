from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Module, Resource, Action, Permission, RolePermission, UserPermission
from .services import PermissionService

class UserPermissionsView(APIView):
    """Return list of permission codes for the current user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # For performance, we can pre-fetch all permissions the user has
        # But for simplicity, we'll query directly using the service
        # Better: preload all permissions for the user using a single query
        # We'll implement a fast method in PermissionService
        all_perms = Permission.objects.values_list('code', flat=True)
        user_perms = []
        for perm_code in all_perms:
            if PermissionService.user_has_permission(request.user, perm_code):
                user_perms.append(perm_code)
        return Response(user_perms)


class ModulesTreeView(APIView):
    """Return nested structure of modules -> resources -> actions (with granted flags)"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        modules = Module.objects.filter(is_active=True).prefetch_related('resources__permissions__action')
        data = []
        for module in modules:
            resources = []
            for resource in module.resources.filter(is_active=True):
                actions = []
                for perm in resource.permissions.all():
                    action = perm.action
                    granted = PermissionService.user_has_permission(request.user, perm.code)
                    actions.append({
                        'code': action.code,
                        'name': action.name,
                        'granted': granted
                    })
                resources.append({
                    'code': resource.code,
                    'name': resource.name,
                    'actions': actions
                })
            data.append({
                'code': module.code,
                'name': module.name,
                'resources': resources
            })
        return Response(data)