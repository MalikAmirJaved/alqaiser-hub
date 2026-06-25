from unittest.mock import MagicMock
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied

from apps.permissions.models import (
    Module, Resource, Action, Permission, Role,
    RolePermission, UserRole, UserPermission, PermissionAuditLog,
)
from apps.permissions.services import PermissionService
from apps.permissions.checks import check_permission, require_permission, build_permission_code

User = get_user_model()


class ModuleModelTest(TestCase):
    def test_create_module(self):
        m = Module.objects.create(code='HR', name='Human Resources')
        self.assertEqual(str(m), 'HR')
        self.assertTrue(m.is_active)

    def test_unique_code(self):
        Module.objects.create(code='HR', name='Human Resources')
        with self.assertRaises(Exception):
            Module.objects.create(code='HR', name='Duplicate')


class ResourceModelTest(TestCase):
    def setUp(self):
        self.module = Module.objects.create(code='HR', name='HR')

    def test_create_resource(self):
        r = Resource.objects.create(module=self.module, code='employee', name='Employee')
        self.assertEqual(str(r), 'HR:employee')

    def test_unique_together(self):
        Resource.objects.create(module=self.module, code='employee', name='Employee')
        with self.assertRaises(Exception):
            Resource.objects.create(module=self.module, code='employee', name='Duplicate')


class ActionModelTest(TestCase):
    def test_create_action(self):
        a = Action.objects.create(code='create', name='Create')
        self.assertEqual(str(a), 'create')

    def test_unique_code(self):
        Action.objects.create(code='view', name='View')
        with self.assertRaises(Exception):
            Action.objects.create(code='view', name='Duplicate')


class PermissionModelTest(TestCase):
    def setUp(self):
        self.module = Module.objects.create(code='HR', name='HR')
        self.resource = Resource.objects.create(module=self.module, code='employee', name='Employee')
        self.action = Action.objects.create(code='create', name='Create')

    def test_create_permission(self):
        p = Permission.objects.create(resource=self.resource, action=self.action, code='HR:employee:create')
        self.assertEqual(str(p), 'HR:employee:create')

    def test_unique_together(self):
        Permission.objects.create(resource=self.resource, action=self.action, code='HR:employee:create')
        with self.assertRaises(Exception):
            Permission.objects.create(resource=self.resource, action=self.action, code='HR:employee:create:dup')


class RoleModelTest(TestCase):
    def test_create_role(self):
        r = Role.objects.create(name='Admin', description='Administrator')
        self.assertEqual(str(r), 'Admin')

    def test_is_system_default(self):
        r = Role.objects.create(name='Test')
        self.assertFalse(r.is_system)


class RolePermissionModelTest(TestCase):
    def setUp(self):
        self.role = Role.objects.create(name='Admin')
        self.module = Module.objects.create(code='HR', name='HR')
        self.resource = Resource.objects.create(module=self.module, code='employee', name='Employee')
        self.action = Action.objects.create(code='create', name='Create')
        self.permission = Permission.objects.create(resource=self.resource, action=self.action, code='HR:employee:create')

    def test_create_role_permission(self):
        rp = RolePermission.objects.create(role=self.role, permission=self.permission, granted=True)
        self.assertTrue(rp.granted)

    def test_unique_together(self):
        RolePermission.objects.create(role=self.role, permission=self.permission)
        with self.assertRaises(Exception):
            RolePermission.objects.create(role=self.role, permission=self.permission)


class UserRoleModelTest(TestCase):
    def setUp(self):
        self.role = Role.objects.create(name='Staff')
        self.user = User.objects.create_user(username='u1', email='u1@t.com', password='pass')

    def test_create_user_role(self):
        ur = UserRole.objects.create(user=self.user, role=self.role)
        self.assertEqual(ur.user, self.user)

    def test_unique_together(self):
        UserRole.objects.create(user=self.user, role=self.role)
        with self.assertRaises(Exception):
            UserRole.objects.create(user=self.user, role=self.role)


class UserPermissionModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u2', email='u2@t.com', password='pass')
        self.module = Module.objects.create(code='HR', name='HR')
        self.resource = Resource.objects.create(module=self.module, code='employee', name='Employee')
        self.action = Action.objects.create(code='view', name='View')
        self.permission = Permission.objects.create(resource=self.resource, action=self.action, code='HR:employee:view')

    def test_create_override(self):
        up = UserPermission.objects.create(user=self.user, permission=self.permission, granted=True)
        self.assertTrue(up.granted)

    def test_unique_together(self):
        UserPermission.objects.create(user=self.user, permission=self.permission, granted=True)
        with self.assertRaises(Exception):
            UserPermission.objects.create(user=self.user, permission=self.permission, granted=False)


class PermissionAuditLogTest(TestCase):
    def test_create_audit_log(self):
        user = User.objects.create_user(username='aud', email='aud@t.com', password='pass')
        log = PermissionAuditLog.objects.create(user=user, action='grant')
        self.assertEqual(log.action, 'grant')


class BuildPermissionCodeTest(TestCase):
    def test_builds_correctly(self):
        code = build_permission_code('HR', 'employee', 'create')
        self.assertEqual(code, 'HR:employee:create')

    def test_uppercases_module(self):
        code = build_permission_code('hr', 'employee', 'view')
        self.assertEqual(code, 'HR:employee:view')


class PermissionServiceTest(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='svc', email='svc@t.com', password='pass')
        self.superuser = User.objects.create_superuser(username='sup', email='sup@t.com', password='pass')
        self.module = Module.objects.create(code='HR', name='HR')
        self.resource = Resource.objects.create(module=self.module, code='employee', name='Employee')
        self.action = Action.objects.create(code='create', name='Create')
        self.permission = Permission.objects.create(
            resource=self.resource, action=self.action, code='HR:employee:create'
        )

    def test_superuser_always_has_permission(self):
        self.assertTrue(PermissionService.user_has_permission(self.superuser, 'HR:employee:create'))

    def test_anonymous_returns_false(self):
        anon = MagicMock()
        anon.is_authenticated = False
        self.assertFalse(PermissionService.user_has_permission(anon, 'HR:employee:create'))

    def test_role_granted_permission(self):
        role = Role.objects.create(name='Admin')
        RolePermission.objects.create(role=role, permission=self.permission, granted=True)
        UserRole.objects.create(user=self.user, role=role)
        self.assertTrue(PermissionService.user_has_permission(self.user, 'HR:employee:create'))

    def test_no_permission_returns_false(self):
        self.assertFalse(PermissionService.user_has_permission(self.user, 'HR:employee:create'))

    def test_user_override_grant(self):
        UserPermission.objects.create(user=self.user, permission=self.permission, granted=True)
        self.assertTrue(PermissionService.user_has_permission(self.user, 'HR:employee:create'))

    def test_user_override_deny_overrides_role(self):
        role = Role.objects.create(name='Staff')
        RolePermission.objects.create(role=role, permission=self.permission, granted=True)
        UserRole.objects.create(user=self.user, role=role)
        UserPermission.objects.create(user=self.user, permission=self.permission, granted=False)
        self.assertFalse(PermissionService.user_has_permission(self.user, 'HR:employee:create'))


class CheckPermissionTest(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='chk', email='chk@t.com', password='pass')
        self.superuser = User.objects.create_superuser(username='chkadmin', email='chkadm@t.com', password='pass')
        self.module = Module.objects.create(code='HR', name='HR')
        self.resource = Resource.objects.create(module=self.module, code='employee', name='Employee')
        self.action = Action.objects.create(code='view', name='View')
        self.permission = Permission.objects.create(
            resource=self.resource, action=self.action, code='HR:employee:view'
        )

    def test_check_permission_returns_bool(self):
        self.assertFalse(check_permission(self.user, 'HR', 'employee', 'view'))
        self.assertTrue(check_permission(self.superuser, 'HR', 'employee', 'view'))

    def test_require_permission_raises(self):
        with self.assertRaises(DRFPermissionDenied):
            require_permission(self.user, 'HR', 'employee', 'view')

    def test_require_permission_passes_for_superuser(self):
        require_permission(self.superuser, 'HR', 'employee', 'view')
