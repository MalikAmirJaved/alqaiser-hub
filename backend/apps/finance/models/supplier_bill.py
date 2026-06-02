from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from apps.common.basemodel import BaseModel

class SupplierBill(BaseModel):
    bill_number = models.CharField(max_length=50, unique=True)
    supplier = models.ForeignKey('inventory.Supplier', on_delete=models.PROTECT, related_name='bills')
    purchase_order = models.ForeignKey('inventory.PurchaseOrder', on_delete=models.CASCADE, null=True, blank=True)
    bill_date = models.DateField()
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal('0.00'))])
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=20, choices=[
        ('DRAFT', 'Draft'),
        ('POSTED', 'Posted'),
        ('PAID', 'Paid'),
        ('PARTIAL', 'Partially Paid'),
        ('CANCELLED', 'Cancelled'),
    ], default='DRAFT')
    journal_entry = models.OneToOneField('JournalEntry', on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'finance_supplier_bills'
        ordering = ['-bill_date']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['supplier']),
            models.Index(fields=['status']),
            models.Index(fields=['due_date']),
        ]

    @property
    def outstanding(self):
        return self.amount - self.paid_amount