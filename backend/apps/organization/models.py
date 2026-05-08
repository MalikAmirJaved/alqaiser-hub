import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser


# -----------------------------
# COMPANY MODEL
# -----------------------------
class Company(models.Model):
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=100, unique=True)

    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)

    phone = models.CharField(max_length=30, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    
    tax_id = models.CharField(max_length=100, blank=True, null=True)
    is_deleted = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Add soft delete manager
        indexes = [
            models.Index(fields=['short_name']),
            models.Index(fields=['is_deleted']),
        ]



# -----------------------------
# BRANCH MODEL
# -----------------------------
class Branch(models.Model):
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="branches"
    )

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)

    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)

    phone = models.CharField(max_length=30, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)

    currency_code = models.CharField(max_length=10, default="USD")
    tax_id = models.CharField(max_length=100, blank=True, null=True)

    is_hq = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


# -----------------------------
# USER MODEL
# -----------------------------
class User(AbstractUser):
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    role = models.CharField(max_length=50, default="staff")
    full_name = models.CharField(max_length=255, blank=True, null=True)

    # New fields from your spec
    department = models.CharField(max_length=100, blank=True, null=True)
    designation = models.CharField(max_length=100, blank=True, null=True)

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="users"
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="users"
    )

    employee_id = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=20, default="active")

    # Who created this user (self-reference)
    created_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_users"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Django's is_staff, is_superuser, etc. remain from AbstractUser.
    # They are not shown in your list but are required for auth.



class UserCompanyContext(models.Model):
    """Tracks which company and branch a user is currently working with"""
    id = models.BigAutoField(primary_key=True)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='context'
    )
    current_company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        null=True,
        related_name='active_users'
    )
    current_branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        related_name='active_users'
    )
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User Company Context"
        verbose_name_plural = "User Company Contexts"
    
    def __str__(self):
        return f"{self.user.username} - {self.current_company.name if self.current_company else 'No Company'}"


class Module(models.Model):
    """System modules (HR, INVENTORY, FINANCE, SETTINGS, etc.)"""
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)
    icon = models.CharField(max_length=50, blank=True, null=True)
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['order', 'name']
    
    def __str__(self):
        return self.name


class Feature(models.Model):
    """Features within a module (Employee Management, Payroll, etc.)"""
    id = models.BigAutoField(primary_key=True)
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='features')
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    route_path = models.CharField(max_length=200, blank=True, null=True)
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = [['module', 'code']]
        ordering = ['module__order', 'order', 'name']
    
    def __str__(self):
        return f"{self.module.name} - {self.name}"


class RolePermission(models.Model):
    """Permissions assigned to roles"""
    id = models.BigAutoField(primary_key=True)
    role = models.CharField(max_length=50)  # COMPANY_ADMIN, BRANCH_ADMIN, MANAGER, STAFF
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='role_permissions')
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE, related_name='role_permissions')
    
    can_view = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_update = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [['role', 'module', 'feature']]
    
    def __str__(self):
        return f"{self.role} - {self.module.name}/{self.feature.name}"


class UserPermission(models.Model):
    """Custom permissions for specific users (override role permissions)"""
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='custom_permissions')
    module = models.ForeignKey(Module, on_delete=models.CASCADE)
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE)
    
    can_view = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_update = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_permissions')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [['user', 'module', 'feature']]
    
    def __str__(self):
        return f"{self.user.username} - {self.module.name}/{self.feature.name}"
