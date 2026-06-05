from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from apps.common.basemodel import BaseModel

class Payment(BaseModel):
    PAYMENT_TYPES = [
        ('RECEIPT', 'Receipt'),
        ('PAYMENT', 'Payment'),
    ]
    PAYMENT_METHODS = [
        ('CASH', 'Cash'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('CHEQUE', 'Cheque'),
        ('CREDIT_CARD', 'Credit Card'),
        ('OTHER', 'Other'),
    ]
    payment_type = models.CharField(max_length=10, choices=PAYMENT_TYPES)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='BANK_TRANSFER')
    amount = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    payment_date = models.DateField()
    reference_number = models.CharField(max_length=100, blank=True)
    supplier_bill = models.ForeignKey('SupplierBill', on_delete=models.CASCADE, null=True, blank=True, related_name='payments')
    customer_invoice = models.ForeignKey('CustomerInvoice', on_delete=models.CASCADE, null=True, blank=True, related_name='payments')
    bank_account = models.ForeignKey('BankAccount', on_delete=models.PROTECT, null=True, blank=True)
    status = models.CharField(max_length=20, choices=[
        ('DRAFT', 'Draft'),
        ('CONFIRMED', 'Confirmed'),
        ('CANCELLED', 'Cancelled'),
    ], default='DRAFT')
    journal_entry = models.OneToOneField('JournalEntry', on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'finance_payments'
        ordering = ['-payment_date']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['payment_type', 'payment_date']),
            models.Index(fields=['supplier_bill']),
            models.Index(fields=['customer_invoice']),
        ]