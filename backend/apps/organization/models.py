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

    currency_code = models.CharField(max_length=10, default="USD")
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Changed from CharField to JSONField to store arrays
    working_days = models.JSONField(default=list)      # e.g. ["Monday", "Tuesday", ...]
    weekends = models.JSONField(default=list)           # e.g. ["Sunday"]
    leave_year_type = models.CharField(
        max_length=20,
        choices=[("CALENDAR", "Calendar"), ("FISCAL", "Fiscal")],
        default="CALENDAR",
    )
    public_holidays = models.JSONField(default=list)    # list of {"date": "...", "name": "..."}

    tax_id = models.CharField(max_length=100, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


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