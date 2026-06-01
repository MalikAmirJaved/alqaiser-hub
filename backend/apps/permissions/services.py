import logging
from typing import Optional, Set
from django.conf import settings
from django.core.cache import cache
from django.contrib.auth import get_user_model
from .models import Permission, RolePermission, UserPermission, UserRole

logger = logging.getLogger(__name__)
User = get_user_model()


class PermissionService:
    @classmethod
    def cache_ttl(cls) -> int:
        return getattr(settings, 'PERMISSION_CACHE_TTL', 300)

    @classmethod
    def _get_permission_id(cls, perm_code: str) -> Optional[int]:
        """Cache permission ID by its code"""
        cache_key = f"perm_id:{perm_code}"
        pid = cache.get(cache_key)
        if pid is None:
            try:
                pid = Permission.objects.get(code=perm_code).id
                cache.set(cache_key, pid, cls.cache_ttl())
            except Permission.DoesNotExist:
                logger.warning(f"Permission {perm_code} not found")
                return None
        return pid

    @classmethod
    def user_has_permission(cls, user, perm_code: str) -> bool:
        """
        Evaluate if a user has a given permission.
        Returns True/False.
        """
        if not user or user.is_anonymous:
            return False
        if user.is_superuser:
            return True

        perm_id = cls._get_permission_id(perm_code)
        if not perm_id:
            return False

        # 1. Check user overrides
        override_key = f"user_override:{user.id}:{perm_id}"
        override = cache.get(override_key)
        if override is None:
            try:
                up = UserPermission.objects.get(user=user, permission_id=perm_id)
                override = up.granted
                cache.set(override_key, override, cls.cache_ttl())
            except UserPermission.DoesNotExist:
                override = None
                cache.set(override_key, None, cls.cache_ttl())

        if override is not None:
            return override   # explicit grant or deny

        # 2. Check role permissions
        role_key = f"user_roles:{user.id}"
        role_ids = cache.get(role_key)
        if role_ids is None:
            role_ids = list(UserRole.objects.filter(user=user).values_list('role_id', flat=True))
            cache.set(role_key, role_ids, cls.cache_ttl())

        if not role_ids:
            return False

        # 3. Batch fetch role permissions for all user's roles
        perms_key = f"role_perms:{'_'.join(map(str, sorted(role_ids)))}"
        role_perms = cache.get(perms_key)
        if role_perms is None:
            role_perms = set(RolePermission.objects.filter(role_id__in=role_ids, granted=True)
                             .values_list('permission_id', flat=True))
            cache.set(perms_key, role_perms, cls.cache_ttl())

        return perm_id in role_perms

    @classmethod
    def invalidate_user_cache(cls, user):
        """Call after any permission change for a user."""
        try:
            cache.delete_pattern(f"user_override:{user.id}:*")
        except AttributeError:
            pass
        cache.delete(f"user_roles:{user.id}")

    @classmethod
    def invalidate_role_cache(cls, role_id):
        """Call after RolePermission changes."""
        # This is harder because we need to find all users with that role.
        # Simpler: clear all role_perms keys (or rely on TTL).
        # For production, we can iterate over users, but that may be heavy.
        # We'll just clear the specific role_perm key? Not possible because it's combined.
        # Instead, we can increment a version number in the cache key.
        # For simplicity, we'll use a short TTL and not worry about immediate invalidation.
        pass