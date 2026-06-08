from django.db import models
from django.core.validators import MinValueValidator
from apps.common.basemodel import BaseModel

class ForecastConfiguration(BaseModel):
    """Global or per‑item forecasting settings"""
    SCOPE_CHOICES = [
        ('GLOBAL', 'Global Defaults'),
        ('VARIANT', 'Per Product Variant'),
        ('CATEGORY', 'Per Category'),
    ]
    METHOD_CHOICES = [
        ('MOVING_AVERAGE', 'Moving Average'),
        ('EXPONENTIAL_SMOOTHING', 'Exponential Smoothing'),
        ('LINEAR_REGRESSION', 'Linear Regression'),
    ]
    scope_type = models.CharField(max_length=20, choices=SCOPE_CHOICES, default='GLOBAL')
    scope_id = models.UUIDField(null=True, blank=True)  # variant_id or category_id
    method = models.CharField(max_length=30, choices=METHOD_CHOICES, default='MOVING_AVERAGE')
    window_days = models.PositiveIntegerField(default=30, help_text="Number of historical days to consider")
    forecast_horizon_days = models.PositiveIntegerField(default=30)
    smoothing_factor = models.FloatField(default=0.3, validators=[MinValueValidator(0.0)], help_text="For exponential smoothing (alpha)")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'forecast_configurations'
        unique_together = [['company_id', 'scope_type', 'scope_id']]

class SalesForecast(BaseModel):
    """Predicted sales quantity for a variant over a future period"""
    variant = models.ForeignKey('inventory.ProductVariant', on_delete=models.CASCADE)
    forecast_date = models.DateField()   # the day being forecasted
    predicted_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    lower_bound = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    upper_bound = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    confidence = models.FloatField(default=0.95)
    method_used = models.CharField(max_length=50)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'forecast_sales'
        ordering = ['-forecast_date']
        indexes = [
            models.Index(fields=['variant', 'forecast_date']),
            models.Index(fields=['company_id', 'forecast_date']),
        ]

class StockForecast(BaseModel):
    """Predicted stock levels based on demand forecast & pending orders"""
    variant = models.ForeignKey('inventory.ProductVariant', on_delete=models.CASCADE)
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE)
    forecast_date = models.DateField()
    projected_closing_stock = models.DecimalField(max_digits=12, decimal_places=2)
    required_purchase_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'forecast_stock'
        unique_together = [['variant', 'warehouse', 'forecast_date']]