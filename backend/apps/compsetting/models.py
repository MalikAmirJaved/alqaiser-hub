import uuid
from django.db import models
from apps.organization.models import Company


class CompanySettings(models.Model):
    """Core company settings - one per company"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    company = models.OneToOneField(
        Company,
        on_delete=models.CASCADE,
        related_name='settings'
    )

    # Financial
    currency = models.CharField(max_length=10, default="USD")
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    tax_id = models.CharField(max_length=100, blank=True, null=True)
    
    # Time & Location
    timezone = models.CharField(max_length=50, default="UTC")
    
    # Leave Year Configuration
    leave_year_type = models.CharField(
        max_length=20,
        choices=[("CALENDAR", "Calendar"), ("FISCAL", "Fiscal")],
        default="CALENDAR",
    )
    fiscal_year_start = models.PositiveSmallIntegerField(default=1)
    
    # Leave Policies
    leave_during_probation = models.BooleanField(default=False)
    allow_carry_forward = models.BooleanField(default=False)
    
    # Status
    is_setup_completed = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Company Settings"
        verbose_name_plural = "Company Settings"

    def __str__(self):
        return f"Settings for {self.company.name}"


class WorkingDay(models.Model):
    """Individual working days for a company"""
    id = models.BigAutoField(primary_key=True)
    settings = models.ForeignKey(
        CompanySettings,
        on_delete=models.CASCADE,
        related_name='working_days'
    )
    
    DAY_CHOICES = [
        ("MONDAY", "Monday"),
        ("TUESDAY", "Tuesday"),
        ("WEDNESDAY", "Wednesday"),
        ("THURSDAY", "Thursday"),
        ("FRIDAY", "Friday"),
        ("SATURDAY", "Saturday"),
        ("SUNDAY", "Sunday"),
    ]
    
    day = models.CharField(max_length=10, choices=DAY_CHOICES)
    is_working = models.BooleanField(default=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    
    class Meta:
        unique_together = [('settings', 'day')]
        ordering = ['order']
        verbose_name = "Working Day"
        verbose_name_plural = "Working Days"
        indexes = [
            models.Index(fields=['settings', 'is_working']),
        ]

    
    def __str__(self):
        return f"{self.get_day_display()} - {'Working' if self.is_working else 'Off'}"


class PublicHoliday(models.Model):
    """Public holidays for a company"""
    id = models.BigAutoField(primary_key=True)
    settings = models.ForeignKey(
        CompanySettings,
        on_delete=models.CASCADE,
        related_name='public_holidays'
    )
    
    name = models.CharField(max_length=255)
    date = models.DateField()
    is_recurring_yearly = models.BooleanField(default=False)
    description = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [('settings', 'date', 'name')]
        ordering = ['date']
        verbose_name = "Public Holiday"
        verbose_name_plural = "Public Holidays"
        indexes = [
            models.Index(fields=['settings', 'date']),
        ]

    
    def __str__(self):
        return f"{self.name} - {self.date}"


class LeaveType(models.Model):
    """Leave types configuration for a company"""
    id = models.BigAutoField(primary_key=True)
    settings = models.ForeignKey(
        CompanySettings,
        on_delete=models.CASCADE,
        related_name='leave_types'
    )
    
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True, null=True)
    is_paid = models.BooleanField(default=True)
    default_days_per_year = models.PositiveIntegerField(default=0)
    max_carry_forward_days = models.PositiveIntegerField(default=0)
    requires_approval = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [('settings', 'code')]
        ordering = ['order']
        verbose_name = "Leave Type"
        verbose_name_plural = "Leave Types"
        indexes = [
            models.Index(fields=['settings', 'is_active']),
        ]

    
    def __str__(self):
        return f"{self.name} ({'Paid' if self.is_paid else 'Unpaid'})"