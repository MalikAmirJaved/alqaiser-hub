# apps/organization/models.py
import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from apps.common.basemodel import BaseModel


class Company(models.Model):
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=100, unique=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100)
    phone = models.CharField(max_length=30, blank=True, null=True)
    email = models.EmailField(unique=True)
    tax_id = models.CharField(max_length=100, blank=True, null=True)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['short_name']),
            models.Index(fields=['is_deleted']),
        ]


class Branch(models.Model):
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="branches")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100)
    phone = models.CharField(max_length=30, blank=True, null=True)
    email = models.EmailField(unique=True)
    currency_code = models.CharField(max_length=10, default="USD")
    tax_id = models.CharField(max_length=100, blank=True, null=True)
    is_hq = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="branches_created"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="branches_updated"
    )


class User(AbstractUser):
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=50, default="staff")
    full_name = models.CharField(max_length=255, blank=True, null=True)

    # Department as ForeignKey to Department (string reference)
    department = models.ForeignKey(
        'organization.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    # Designation as ForeignKey to compsetting.Designation (string reference)
    designation = models.ForeignKey(
        'compsetting.Designation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )

    phone_number = models.CharField(max_length=30, blank=True, null=True)

    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, null=True, blank=True, related_name="users"
    )
    branch = models.ForeignKey(
        Branch, on_delete=models.CASCADE, null=True, blank=True, related_name="users"
    )
    employee_id = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=20, default="active")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_users"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="updated_users"
    )
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="deleted_users"
    )
    is_deleted = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['is_deleted']),
            models.Index(fields=['company', 'branch']),
        ]

    def __str__(self):
        return self.username


class UserCompanyContext(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='context')
    current_company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, related_name='active_users')
    current_branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, related_name='active_users')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Company Context"
        verbose_name_plural = "User Company Contexts"

    def __str__(self):
        return f"{self.user.username} - {self.current_company.name if self.current_company else 'No Company'}"


class Department(BaseModel):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'organization_departments'
        ordering = ['name']
        unique_together = [['company_id', 'code']]
        indexes = [
            models.Index(fields=['company_id', 'is_deleted']),
            models.Index(fields=['code']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"