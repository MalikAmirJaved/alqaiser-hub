import uuid
from django.db import models
from apps.organization.models import Company


class CompanySettings(models.Model):
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    company = models.OneToOneField(
        Company,
        on_delete=models.CASCADE,
        related_name='settings'
    )

    currency = models.CharField(max_length=10, default="USD")
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    tax_id = models.CharField(max_length=100, blank=True, null=True)
    timezone = models.CharField(max_length=50, default="UTC")

    leave_year_type = models.CharField(
        max_length=20,
        choices=[("CALENDAR", "Calendar"), ("FISCAL", "Fiscal")],
        default="CALENDAR",
    )

    # Fiscal year start month (1=January ... 12=December)
    fiscal_year_start = models.PositiveSmallIntegerField(default=1)

    public_holidays = models.JSONField(default=list)   # [{"date": "...", "name": "..."}]
    working_days = models.JSONField(default=list)      # ["Monday", "Tuesday", ...]
    weekends = models.JSONField(default=list)          # ["Saturday", "Sunday"]

    is_setup_completed = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Company Settings"
        verbose_name_plural = "Company Settings"

    def __str__(self):
        return f"Settings for {self.company.name}"