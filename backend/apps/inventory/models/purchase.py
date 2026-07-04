import uuid
from django.db import models
from apps.common.basemodel import BaseModel
from django.conf import settings


class PurchaseOrder(BaseModel):
    """
    Header of a purchase order sent to a supplier.
    No JSON fields – all normalised PostgreSQL columns.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('CONFIRMED', 'Confirmed'),
        ('PARTIALLY_RECEIVED', 'Partially Received'),
        ('FULLY_RECEIVED', 'Fully Received'),
        ('CANCELLED', 'Cancelled'),
    ]
    INVENTORY_TYPES = [
        ('FOR_SALE', 'For Sale (Inventory)'),
        ('OFFICE_INVENTORY', 'Office Inventory (Asset)'),
    ]

    inventory_type = models.CharField(
        max_length=20,
        choices=INVENTORY_TYPES,
        default='FOR_SALE',
        help_text="Type of inventory: for resale or office assets"
    )

    order_number = models.CharField(max_length=50, unique=True)
    supplier = models.ForeignKey(
        'Supplier',
        on_delete=models.PROTECT,
        related_name='purchase_orders'
    )
    warehouse = models.ForeignKey(
        'Warehouse',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='purchase_orders',
        help_text="Destination warehouse for received goods (not required for office inventory)"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        db_index=True
    )
    order_date = models.DateField(null=True, blank=True)
    expected_delivery_date = models.DateField(null=True, blank=True)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'purchase_orders'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['supplier']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return self.order_number


class PurchaseOrderLine(BaseModel):
    """
    One line of a purchase order.
    For FOR_SALE: variant must be set, asset = null
    For OFFICE_INVENTORY: asset must be set, variant = null
    """
    LINE_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PARTIALLY_RECEIVED', 'Partially Received'),
        ('FULLY_RECEIVED', 'Fully Received'),
        ('CANCELLED', 'Cancelled'),
    ]

    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name='lines'
    )
    variant = models.ForeignKey(
        'ProductVariant',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='purchase_lines'
    )
    asset = models.ForeignKey(
        'hr.Asset',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='purchase_lines'
    )
    quantity_ordered = models.PositiveIntegerField()
    quantity_received = models.PositiveIntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=LINE_STATUS_CHOICES, default='PENDING')
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'purchase_order_lines'
        indexes = [
            models.Index(fields=['purchase_order']),
            models.Index(fields=['variant']),
            models.Index(fields=['asset']),
            models.Index(fields=['company_id', 'branch_id']),
        ]

    def clean(self):
        from apps.inventory.models import PurchaseOrder
        if self.purchase_order_id:
            po = self.purchase_order
            if po.inventory_type == 'FOR_SALE' and not self.variant:
                raise models.ValidationError("For sale orders require a product variant")
            if po.inventory_type == 'OFFICE_INVENTORY' and not self.asset:
                raise models.ValidationError("Office inventory orders require an HR asset")
            if po.inventory_type == 'FOR_SALE' and self.asset:
                raise models.ValidationError("For sale orders cannot have an asset")
            if po.inventory_type == 'OFFICE_INVENTORY' and self.variant:
                raise models.ValidationError("Office inventory orders cannot have a product variant")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def line_total(self):
        return self.quantity_ordered * self.unit_cost

class GoodsReceipt(BaseModel):
    """
    Records the physical receipt of goods against a purchase order.
    """
    STATUS_CHOICES = [
        ('COMPLETED', 'Completed'),
        ('PARTIALLY_RETURNED', 'Partially Returned'),
    ]

    receipt_number = models.CharField(max_length=50, unique=True)
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.PROTECT,
        related_name='goods_receipts'
    )
    received_date = models.DateTimeField()
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,               # or your custom user model
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='goods_receipts'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='COMPLETED'
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'goods_receipts'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['purchase_order']),
            models.Index(fields=['company_id', 'branch_id']),
        ]

    def __str__(self):
        return self.receipt_number


class GoodsReceiptLine(BaseModel):
    """
    Each line of a goods receipt, recording how many units were actually received.
    """
    goods_receipt = models.ForeignKey(
        GoodsReceipt,
        on_delete=models.CASCADE,
        related_name='lines'
    )
    purchase_order_line = models.ForeignKey(
        PurchaseOrderLine,
        on_delete=models.PROTECT,
        related_name='receipt_lines'
    )
    quantity_received = models.PositiveIntegerField()
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    accepted = models.BooleanField(default=True)

    class Meta:
        db_table = 'goods_receipt_lines'
        indexes = [
            models.Index(fields=['goods_receipt']),
            models.Index(fields=['purchase_order_line']),
        ]