from decimal import Decimal

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.validators import MinValueValidator
from django.db import models

from apps.common.basemodel import BaseModel


class Payment(BaseModel):
    """
    Central payment table for all payable documents.

    Linked via GenericForeignKey to: CustomerInvoice, SupplierBill, Expense, PayrollRecord.
    """

    PAYMENT_TYPES = [
        ('RECEIPT', 'Receipt'),
        ('PAYMENT', 'Payment'),
    ]
    PAYMENT_METHODS = [
        ('CASH', 'Cash'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('CHEQUE', 'Cheque'),
        ('CREDIT_CARD', 'Credit Card'),
        ('CREDIT', 'Supplier Credit'),
        ('WALLET', 'Digital Wallet'),
        ('OTHER', 'Other'),
    ]
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('CONFIRMED', 'Confirmed'),
        ('CANCELLED', 'Cancelled'),
    ]

    payment_type = models.CharField(max_length=10, choices=PAYMENT_TYPES)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='BANK_TRANSFER')
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
    )
    payment_date = models.DateField()
    reference_number = models.CharField(max_length=100, blank=True)

    content_type = models.ForeignKey(
    ContentType,
    on_delete=models.CASCADE,
    null=True,
    blank=True,
)
    object_id = models.PositiveIntegerField(
    null=True,
    blank=True,
)
    payable = GenericForeignKey('content_type', 'object_id')

    bank_account = models.ForeignKey('BankAccount', on_delete=models.PROTECT, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    journal_entry = models.OneToOneField('JournalEntry', on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'finance_payments'
        ordering = ['-payment_date']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['payment_type', 'payment_date']),
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'{self.get_payment_type_display()} {self.amount} ({self.status})'
