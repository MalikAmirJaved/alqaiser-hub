import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser


class Company(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=100, unique=True)

    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)

    phone = models.CharField(max_length=30, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)

    currency_code = models.CharField(max_length=10, default="USD")
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    working_days = models.CharField(max_length=255, default="Mon-Fri")
    weekends = models.CharField(max_length=255, default="Sat-Sun")
    leave_year_type = models.CharField(max_length=50, default="calendar")

    public_holidays = models.JSONField(default=list)

    tax_id = models.CharField(max_length=100, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Branch(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="branches")

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


class User(AbstractUser):
    role = models.CharField(max_length=50, default="staff")

    full_name = models.CharField(max_length=255, blank=True, null=True)

    company = models.ForeignKey(Company, on_delete=models.CASCADE, null=True, blank=True)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, null=True, blank=True)

    employee_id = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=20, default="active")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)