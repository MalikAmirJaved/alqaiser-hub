from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.common.basemodel import BaseModel
from apps.finance.services.payable import PayableModelMixin


class CustomerInvoice(PayableModelMixin, BaseModel):
    invoice_number = models.CharField(max_length=50, unique=True)
    customer = models.ForeignKey(
        'inventory.Customer',
        on_delete=models.PROTECT,
        related_name='invoices',
        null=True,
        blank=True,
    )
    sales_order = models.ForeignKey('inventory.SalesOrder', on_delete=models.CASCADE, null=True, blank=True)
    invoice_date = models.DateField()
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal('0.00'))])
    status = models.CharField(
        max_length=20,
        choices=[
            ('DRAFT', 'Draft'),
            ('CANCELLED', 'Cancelled'),
        ],
        default='DRAFT',
    )
    payment_method = models.CharField(
        max_length=20,
        choices=[
            ('CASH', 'Cash'),
            ('BANK_TRANSFER', 'Bank Transfer'),
            ('CHEQUE', 'Cheque'),
            ('CREDIT_CARD', 'Credit Card'),
            ('CREDIT', 'Credit/On Account'),
            ('OTHER', 'Other'),
        ],
        default='CREDIT',
    )
    bank_account = models.ForeignKey(
        'BankAccount',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_invoices',
    )
    journal_entry = models.OneToOneField('JournalEntry', on_delete=models.SET_NULL, null=True, blank=True)
    source = models.CharField(
        max_length=20,
        choices=[
            ('FINANCE', 'Finance'),
            ('SALES_POS', 'Sales POS'),
            ('SALES_AGENT', 'Sales Agent'),
            ('SALES_QUOTE', 'Sales Quote'),
        ],
        default='FINANCE',
        db_index=True,
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'finance_customer_invoices'
        ordering = ['-invoice_date']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['customer']),
            models.Index(fields=['status']),
            models.Index(fields=['due_date']),
        ]


class CustomerInvoiceLine(BaseModel):
    customer_invoice = models.ForeignKey(
        'CustomerInvoice',
        on_delete=models.CASCADE,
        related_name='lines',
    )
    variant = models.ForeignKey(
        'inventory.ProductVariant',
        on_delete=models.PROTECT,
        related_name='invoice_lines',
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=4)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'finance_customer_invoice_lines'
        indexes = [
            models.Index(fields=['customer_invoice']),
            models.Index(fields=['variant']),
            models.Index(fields=['company_id', 'branch_id']),
        ]

    @property
    def subtotal(self):
        return self.quantity * self.unit_price

    @property
    def line_total(self):
        return self.subtotal - self.discount_amount
