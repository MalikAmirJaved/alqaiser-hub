from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from apps.common.basemodel import BaseModel
from apps.common.document_appearance import (
    DOCUMENT_TEMPLATE_CHOICES,
    default_document_typography,
)

class Quote(BaseModel):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('SENT', 'Sent'),
        ('VIEWED', 'Viewed'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CONVERTED', 'Converted to Invoice'),
    ]
    quote_number = models.CharField(max_length=50, unique=True)
    lead = models.ForeignKey(
        'Lead',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotes'
    )
    customer = models.ForeignKey(
        'inventory.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotes'
    )
    date = models.DateField()
    expiration_date = models.DateField(null=True, blank=True)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    source = models.CharField(max_length=20, choices=[
        ('SALES_DESKTOP', 'Sales Desktop'),
        ('SALES_POS', 'Sales POS'),
        ('SALES_AGENT', 'Sales Agent'),
    ], default='SALES_DESKTOP', db_index=True)
    overall_discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    overall_tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    template_slug = models.CharField(max_length=30, choices=DOCUMENT_TEMPLATE_CHOICES, default='modern')
    accent_color = models.CharField(max_length=7, blank=True, default='')
    typography = models.JSONField(default=default_document_typography)
    notes = models.TextField(blank=True)
    converted_invoice = models.ForeignKey(
        'finance.CustomerInvoice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_quotes',
    )

    class Meta:
        db_table = 'sales_quotes'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return self.quote_number


class QuoteLine(BaseModel):
    quote = models.ForeignKey(
        Quote,
        on_delete=models.CASCADE,
        related_name='lines'
    )
    variant = models.ForeignKey(
        'inventory.ProductVariant',
        on_delete=models.PROTECT,
        related_name='quote_lines',
        null=True,
        blank=True,
    )
    is_manual_entry = models.BooleanField(default=False)
    manual_variant_name = models.CharField(max_length=200, blank=True)
    manual_variant_sku = models.CharField(max_length=100, blank=True)
    vendor = models.ForeignKey(
        'inventory.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quote_lines',
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=12, decimal_places=4)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    description = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'sales_quote_lines'
        indexes = [
            models.Index(fields=['quote']),
            models.Index(fields=['variant']),
            models.Index(fields=['vendor']),
            models.Index(fields=['is_manual_entry']),
            models.Index(fields=['company_id', 'branch_id']),
        ]

    @property
    def subtotal(self):
        return self.quantity * self.unit_price

    @property
    def line_total(self):
        """Net line amount + per-line tax (matches the document total)."""
        from apps.common.totals import line_tax
        return self.subtotal - self.discount_amount + line_tax(
            self.quantity, self.unit_price, self.tax_rate
        )
