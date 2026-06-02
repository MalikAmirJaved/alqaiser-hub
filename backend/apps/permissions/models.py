from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator

class Module(models.Model):
    """Top-level business modules (HR, Inventory, Finance, etc.)"""
    id = models.SmallAutoField(primary_key=True)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    ordering = models.SmallIntegerField(default=0)

    class Meta:
        ordering = ['ordering', 'name']

    def __str__(self):
        return self.code


class Resource(models.Model):
    """Features/entities within a module (Employee, LeaveRequest, Product)"""
    id = models.AutoField(primary_key=True)
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='resources')
    code = models.CharField(max_length=100)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [['module', 'code']]

    def __str__(self):
        return f"{self.module.code}:{self.code}"


class Action(models.Model):
    """Atomic actions (create, view, update, delete, export, approve, reject, etc.)"""
    id = models.SmallAutoField(primary_key=True)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=50)

    def __str__(self):
        return self.code


class Permission(models.Model):
    """Atomic permission = module:resource:action"""
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name='permissions')
    action = models.ForeignKey(Action, on_delete=models.CASCADE, related_name='permissions')
    code = models.CharField(max_length=150, unique=True, db_index=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['resource', 'action']]

    def __str__(self):
        return self.code


class Role(models.Model):
    """User roles (Admin, HR Manager, Inventory Viewer, etc.)"""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)  # system roles cannot be deleted
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class RolePermission(models.Model):
    """Which permissions are granted to a role"""
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='roles')
    granted = models.BooleanField(default=True)  # True = granted, False = explicit deny
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['role', 'permission']]


class UserRole(models.Model):
    """Which roles a user has (many-to-many)"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='users')
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['user', 'role']]


class UserPermission(models.Model):
    """User-specific overrides (grant/deny) that bypass role permissions"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='custom_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='user_overrides')
    granted = models.BooleanField()   # True = grant, False = deny
    granted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='granted_permissions')
    expires_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['user', 'permission']]


class PermissionAuditLog(models.Model):
    """Audit trail for all permission changes"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='permission_audits')
    action = models.CharField(max_length=20)   # grant, revoke, role_assigned, role_removed, override_added, etc.
    target_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='targeted_audits')
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    permission = models.ForeignKey(Permission, on_delete=models.SET_NULL, null=True, blank=True)
    old_value = models.BooleanField(null=True, blank=True)
    new_value = models.BooleanField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'target_user']),
            models.Index(fields=['created_at']),
        ]


class ABACCondition(models.Model):
    """Future ABAC extension: dynamic rules attached to a permission"""
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='abac_conditions')
    attribute_path = models.CharField(max_length=200)   # e.g., 'employee.department_id'
    operator = models.CharField(max_length=20)          # '=', 'in', '>', '<', 'contains'
    value_json = models.TextField()                     # JSON list of allowed values
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['permission', 'attribute_path']]