# ============================================================
# File: backend/apps/inventory/models/sales.py
# ============================================================
import uuid
from django.db import models
from django.conf import settings
from apps.common.basemodel import BaseModel
from apps.inventory.models.customer import Customer


class SalesOrder(BaseModel):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),           # No reservation
        ('DRAFT', 'Draft'),               # Stock reserved
        ('COMPLETE', 'Complete'),         # Stock deducted
        ('CANCELLED', 'Cancelled'),
    ]

    order_number = models.CharField(max_length=50, unique=True)
    customer = models.ForeignKey(
        Customer, on_delete=models.PROTECT,
        related_name='sales_orders', null=True, blank=True
    )
    warehouse = models.ForeignKey(
        'Warehouse', on_delete=models.PROTECT,
        related_name='sales_orders',
        help_text="Source warehouse for stock deduction"
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES,
        default='PENDING', db_index=True
    )
    order_date = models.DateField(null=True, blank=True)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'sales_orders'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['customer']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return self.order_number


class SalesOrderLine(BaseModel):
    LINE_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('COMPLETE', 'Complete'),
        ('CANCELLED', 'Cancelled'),
    ]

    sales_order = models.ForeignKey(
        SalesOrder, on_delete=models.CASCADE, related_name='lines'
    )
    variant = models.ForeignKey(
        'ProductVariant', on_delete=models.PROTECT, related_name='sales_lines'
    )
    quantity_ordered = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=4)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    status = models.CharField(
        max_length=20, choices=LINE_STATUS_CHOICES, default='PENDING'
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'sales_order_lines'
        indexes = [
            models.Index(fields=['sales_order']),
            models.Index(fields=['variant']),
            models.Index(fields=['company_id', 'branch_id']),
        ]

    @property
    def line_total(self):
        return self.quantity_ordered * self.unit_price


class SalesReturn(BaseModel):
    return_number = models.CharField(max_length=50, unique=True)
    sales_order = models.ForeignKey(
        SalesOrder, on_delete=models.PROTECT, related_name='returns'
    )
    warehouse = models.ForeignKey(
        'Warehouse', on_delete=models.PROTECT,
        related_name='returns',
        help_text="Warehouse receiving returned goods"
    )
    return_date = models.DateTimeField()
    status = models.CharField(max_length=20, default='COMPLETED')
    reason = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='returns_created'
    )

    class Meta:
        db_table = 'sales_returns'
        indexes = [
            models.Index(fields=['sales_order']),
            models.Index(fields=['company_id', 'branch_id']),
        ]

    def __str__(self):
        return self.return_number


class SalesReturnLine(BaseModel):
    sales_return = models.ForeignKey(
        SalesReturn, on_delete=models.CASCADE, related_name='lines'
    )
    sales_order_line = models.ForeignKey(
        SalesOrderLine, on_delete=models.PROTECT, related_name='return_lines'
    )
    quantity_returned = models.PositiveIntegerField()
    restock = models.BooleanField(
        default=True, help_text="If True, quantity is added back to stock"
    )
    unit_cost = models.DecimalField(
        max_digits=12, decimal_places=4,
        help_text="Cost at which item is returned to inventory"
    )
    reason = models.TextField(blank=True)

    class Meta:
        db_table = 'sales_return_lines'
        indexes = [
            models.Index(fields=['sales_return']),
            models.Index(fields=['sales_order_line']),
        ]