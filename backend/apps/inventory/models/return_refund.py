from decimal import Decimal
from django.db import models
from django.conf import settings
from apps.common.basemodel import BaseModel


class ReturnRefund(BaseModel):
    """
    Unified return & refund record for CustomerInvoice (finance) and
    SalesOrder (POS/inventory) documents.

    Each return can partially or fully refund a paid document, restock
    inventory, and optionally reverse supplier bills for manual lines.
    """
    RETURN_TYPES = [
        ('INVOICE', 'Customer Invoice'),
        ('POS', 'POS Sale'),
    ]
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    return_number = models.CharField(max_length=50, unique=True)
    return_type = models.CharField(max_length=10, choices=RETURN_TYPES)
    document_id = models.UUIDField(
        help_text="UUID (_id) of the source CustomerInvoice or SalesOrder"
    )
    document_number = models.CharField(
        max_length=50, blank=True,
        help_text="Human-readable document number (invoice_number or order_number)"
    )

    customer = models.ForeignKey(
        'inventory.Customer',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='return_refunds',
    )
    warehouse = models.ForeignKey(
        'inventory.Warehouse',
        on_delete=models.PROTECT,
        related_name='return_refunds',
        help_text="Warehouse receiving returned goods",
    )
    return_date = models.DateTimeField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='DRAFT'
    )
    total_refund_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00')
    )
    reason = models.TextField(blank=True)

    # Refund tracking
    refund_payment_id = models.UUIDField(
        null=True, blank=True,
        help_text="UUID of the refund payment created (if refunded to original method)"
    )

    # Completion tracking
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='completed_returns',
    )

    class Meta:
        db_table = 'return_refunds'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['return_type', 'document_id']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.return_number} ({self.get_return_type_display()})"


class ReturnRefundLine(BaseModel):
    """
    One line of a return — corresponds to a line on the original document.
    """
    return_refund = models.ForeignKey(
        ReturnRefund,
        on_delete=models.CASCADE,
        related_name='lines',
    )
    # The original document's line _id (CustomerInvoiceLine._id or SalesOrderLine._id)
    source_line_id = models.UUIDField(
        help_text="UUID of the original document line"
    )

    # Variant info (null for manual entry lines)
    variant = models.ForeignKey(
        'inventory.ProductVariant',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='return_lines',
    )
    is_manual_entry = models.BooleanField(default=False)
    manual_variant_name = models.CharField(max_length=200, blank=True)
    manual_variant_sku = models.CharField(max_length=100, blank=True)

    # Supplier info (for manual entry lines with a vendor)
    vendor = models.ForeignKey(
        'inventory.Supplier',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='return_lines',
    )

    # Quantities & pricing
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=4)
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))

    # Actions
    restock = models.BooleanField(
        default=True,
        help_text="If True, quantity is added back to inventory",
    )
    return_to_supplier = models.BooleanField(
        default=False,
        help_text="If True, reverse the supplier bill/bill line for this item",
    )
    disposition_action = models.CharField(
        max_length=30,
        blank=True,
        choices=[
            ('GO_TO_PRODUCT', 'Go to Product'),
            ('RETURN_TO_SUPPLIER', 'Return to Supplier'),
        ],
        help_text='Manual line disposition (keeps stock vs return to vendor)',
    )
    product_qty = models.PositiveIntegerField(
        default=0,
        help_text='Quantity added back to product/inventory',
    )
    damage_qty = models.PositiveIntegerField(
        default=0,
        help_text='Quantity marked as damaged (not restocked)',
    )
    damage_reason = models.TextField(
        blank=True,
        help_text='Required when damage_qty > 0',
    )

    reason = models.TextField(blank=True)

    class Meta:
        db_table = 'return_refund_lines'
        indexes = [
            models.Index(fields=['return_refund']),
            models.Index(fields=['source_line_id']),
            models.Index(fields=['variant']),
            models.Index(fields=['company_id', 'branch_id']),
        ]
