import uuid
from django.db import models
from django.conf import settings
from apps.organization.models import Company, Branch
from django.conf import settings as django_settings  # Add this at the top of the file


class TimeStampedModel(models.Model):
    """Abstract base model with timestamp fields"""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_deleted'
    )

    class Meta:
        abstract = True


class CompanySettings(TimeStampedModel):
    """Core company settings - one per company"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    # Company & Branch relationships
    company = models.OneToOneField(
        Company,
        on_delete=models.CASCADE,
        related_name='settings'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='settings'
    )

    # Financial
    currency = models.CharField(max_length=10, default="USD")
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    tax_id = models.CharField(max_length=100, blank=True, null=True)
    
    # Time & Location
    timezone = models.CharField(max_length=50, default="UTC")

    allow_carry_forward = models.BooleanField(default=False)
    max_carry_forward_days = models.PositiveIntegerField(default=0)
    
    # Working Hours
    default_start_time = models.TimeField(default="09:00")
    default_end_time = models.TimeField(default="18:00")
    working_hours_per_day = models.DecimalField(
        max_digits=4, 
        decimal_places=2, 
        default=8.00
    )
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_company_settings'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_company_settings'
    )

    class Meta:
        verbose_name = "Company Settings"
        verbose_name_plural = "Company Settings"
        indexes = [
            models.Index(fields=['company', 'is_deleted']),
            models.Index(fields=['branch']),
        ]

    def __str__(self):
        return f"Settings for {self.company.name}"


class WorkingDay(TimeStampedModel):
    """Individual working days for a company"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    settings = models.ForeignKey(
        CompanySettings,
        on_delete=models.CASCADE,
        related_name='working_days'
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='working_days'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='working_days'
    )
    
    DAY_CHOICES = [
        (0, "Monday"),
        (1, "Tuesday"),
        (2, "Wednesday"),
        (3, "Thursday"),
        (4, "Friday"),
        (5, "Saturday"),
        (6, "Sunday"),
    ]
    
    day = models.PositiveSmallIntegerField(choices=DAY_CHOICES)
    is_working = models.BooleanField(default=True)
    start_time = models.TimeField(default="09:00")
    end_time = models.TimeField(default="18:00")
    is_half_day = models.BooleanField(default=False)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_working_days'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_working_days'
    )
    
    class Meta:
        unique_together = [('settings', 'day')]
        ordering = ['day']
        indexes = [
            models.Index(fields=['settings', 'is_working']),
            models.Index(fields=['company', 'is_deleted']),
        ]
        verbose_name = "Working Day"
        verbose_name_plural = "Working Days"
    
    def __str__(self):
        return f"{self.get_day_display()} - {'Working' if self.is_working else 'Off'}"


class PublicHoliday(TimeStampedModel):
    """Public holidays for a company"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    settings = models.ForeignKey(
        CompanySettings,
        on_delete=models.CASCADE,
        related_name='public_holidays'
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='public_holidays'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='public_holidays'
    )
    
    name = models.CharField(max_length=255)
    date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_recurring_yearly = models.BooleanField(default=False)
    is_half_day = models.BooleanField(default=False)
    description = models.TextField(blank=True, null=True)
    holiday_type = models.CharField(
        max_length=50,
        choices=[
            ('NATIONAL', 'National'),
            ('RELIGIOUS', 'Religious'),
            ('COMPANY', 'Company Specific'),
            ('REGIONAL', 'Regional'),
        ],
        default='NATIONAL'
    )
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_holidays'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_holidays'
    )
    
    class Meta:
        unique_together = [('settings', 'date', 'name')]
        ordering = ['date']
        indexes = [
            models.Index(fields=['settings', 'date']),
            models.Index(fields=['company', 'date']),
            models.Index(fields=['is_deleted', 'date']),
        ]
        verbose_name = "Public Holiday"
        verbose_name_plural = "Public Holidays"
    
    def __str__(self):
        return f"{self.name} - {self.date}"


class CompanySettingHistory(TimeStampedModel):
    """Track all changes to company settings for audit"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    settings = models.ForeignKey(
        CompanySettings,
        on_delete=models.CASCADE,
        related_name='history'
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='settings_history'
    )
    
    field_name = models.CharField(max_length=100)
    old_value = models.TextField(null=True, blank=True)
    new_value = models.TextField(null=True, blank=True)
    changed_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='settings_changes'
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['settings', '-created_at']),
            models.Index(fields=['company', 'field_name']),
        ]
        verbose_name = "Setting History"
        verbose_name_plural = "Setting Histories"

class Designation(TimeStampedModel):
    """Employee designations / job titles"""

    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    # Relations
    settings = models.ForeignKey(
        CompanySettings,
        on_delete=models.CASCADE,
        related_name='designations'
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='designations'
    )

    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='designations'
    )

    # Core Fields
    name = models.CharField(max_length=150)

    department = models.CharField(
        max_length=150,
        null=True,
        blank=True
    )

    pay_grade = models.CharField(
        max_length=50,
        null=True,
        blank=True
    )

    description = models.TextField(
        null=True,
        blank=True
    )

    is_active = models.BooleanField(default=True)

    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_designations'
    )

    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_designations'
    )

    class Meta:
        verbose_name = "Designation"
        verbose_name_plural = "Designations"

        ordering = ['pay_grade', 'name']

        unique_together = [('company', 'name')]

        indexes = [
            models.Index(fields=['company', 'is_deleted']),
            models.Index(fields=['branch']),
            models.Index(fields=['department']),
            models.Index(fields=['pay_grade']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.name} - {self.department or 'General'}"