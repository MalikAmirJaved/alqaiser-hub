from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import UserPermission, RolePermission, UserRole
from .services import PermissionService

@receiver([post_save, post_delete], sender=UserPermission)
def invalidate_user_permission_cache(sender, instance, **kwargs):
    PermissionService.invalidate_user_cache(instance.user)

@receiver([post_save, post_delete], sender=UserRole)
def invalidate_user_role_cache(sender, instance, **kwargs):
    PermissionService.invalidate_user_cache(instance.user)

@receiver([post_save, post_delete], sender=RolePermission)
def invalidate_role_permission_cache(sender, instance, **kwargs):
    # Invalidate all users having that role
    for user_role in UserRole.objects.filter(role=instance.role):
        PermissionService.invalidate_user_cache(user_role.user)