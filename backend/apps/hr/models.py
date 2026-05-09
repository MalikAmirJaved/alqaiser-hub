# apps/hr/models.py
import uuid
from django.db import models
from django.conf import settings as django_settings
from apps.organization.models import Company, Branch

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


class ShiftTemplate(TimeStampedModel):
    """Shift templates for defining working patterns"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company & Branch
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='shift_templates'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shift_templates'
    )
    
    # Core Fields
    name = models.CharField(max_length=100)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=60)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_shift_templates'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_shift_templates'
    )
    
    class Meta:
        verbose_name = "Shift Template"
        verbose_name_plural = "Shift Templates"
        ordering = ['name']
        unique_together = [('company', 'name')]
        indexes = [
            models.Index(fields=['company', 'is_deleted']),
            models.Index(fields=['branch']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.start_time} - {self.end_time})"
    
    @property
    def working_hours(self):
        """Calculate working hours excluding break"""
        from datetime import datetime, timedelta
        start = datetime.combine(datetime.today(), self.start_time)
        end = datetime.combine(datetime.today(), self.end_time)
        
        # Handle overnight shifts
        if end <= start:
            end += timedelta(days=1)
        
        total_minutes = (end - start).total_seconds() / 60
        return round((total_minutes - self.break_minutes) / 60, 2)
    

class Asset(TimeStampedModel):
    """HR Assets - hardware, equipment, devices"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company & Branch
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='hr_assets'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hr_assets'
    )
    
    # Core Fields
    name = models.CharField(max_length=255)
    brand = models.CharField(max_length=100, blank=True, null=True)
    model = models.CharField(max_length=100, blank=True, null=True)
    serial_number = models.CharField(max_length=100, blank=True, null=True, unique=True)
    description = models.TextField(blank=True, null=True)
    
    # Purchase Information
    purchase_date = models.DateField(null=True, blank=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    warranty_until = models.DateField(null=True, blank=True)
    vendor = models.CharField(max_length=255, blank=True, null=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_assigned = models.BooleanField(default=False)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_hr_assets'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_hr_assets'
    )
    
    class Meta:
        verbose_name = "Asset"
        verbose_name_plural = "Assets"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'is_deleted']),
            models.Index(fields=['branch']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['is_assigned']),
            models.Index(fields=['vendor']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.brand or 'No Brand'})"
    
    @property
    def warranty_status(self):
        """Check if warranty is active"""
        if not self.warranty_until:
            return None
        from datetime import date
        return self.warranty_until >= date.today()



class AssetCategory(TimeStampedModel):
    """Asset Categories/Kits - bundle multiple assets together"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company & Branch
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='asset_categories'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asset_categories'
    )
    
    # Core Fields
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    # Assets in this category
    assets = models.ManyToManyField(
        Asset,
        related_name='categories',
        blank=True
    )
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_asset_categories'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_asset_categories'
    )
    
    class Meta:
        verbose_name = "Asset Category"
        verbose_name_plural = "Asset Categories"
        ordering = ['name']
        unique_together = [('company', 'name')]
        indexes = [
            models.Index(fields=['company', 'is_deleted']),
            models.Index(fields=['branch']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.assets.count()} assets)"
    
    def get_asset_ids(self):
        """Return list of asset IDs in this category"""
        return list(self.assets.values_list('id', flat=True))
