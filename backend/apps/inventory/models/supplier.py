from decimal import Decimal

from django.db import models
from apps.common.basemodel import BaseModel


class Supplier(BaseModel):
    PARTNER_TYPES = [
        ('supplier', 'Supplier'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('suspended', 'Suspended'),
    ]

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    contact_person = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address_line = models.TextField(blank=True)
    country = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    partner_type = models.CharField(max_length=20, choices=PARTNER_TYPES, default='supplier')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text="Running net balance owed to this supplier")
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text="Credit amount (surplus paid) with this supplier")

    class Meta:
        db_table = 'suppliers_partner'
        unique_together = [['company_id', 'branch_id', 'code']]
        ordering = ['name']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['partner_type']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"


class SupplierHistory(BaseModel):
    TRANSACTION_TYPES = [
        ('PURCHASE', 'Purchase'),
        ('PURCHASE_REVERSAL', 'Purchase Reversal'),
        ('PAYMENT', 'Payment'),
        ('CREDIT_NOTE', 'Credit Note'),
        ('INVOICE_ADJUSTMENT', 'Invoice Adjustment'),
        ('CREDIT_APPLIED', 'Credit Applied'),
    ]

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='history')
    transaction_type = models.CharField(max_length=50, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    balance_after = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit_after = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    reference_type = models.CharField(max_length=50, blank=True,
        help_text="e.g. supplier_bill, payment, customer_invoice")
    reference_id = models.UUIDField(null=True, blank=True,
        help_text="UUID of the referenced document")
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'inventory_supplier_history'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['supplier']),
            models.Index(fields=['transaction_type']),
        ]

    def __str__(self):
        return f"{self.supplier.code} - {self.transaction_type}: {self.amount}"