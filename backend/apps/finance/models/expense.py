from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.common.basemodel import BaseModel
from apps.finance.services.payable import PayableModelMixin


class Expense(PayableModelMixin, BaseModel):
    EXPENSE_CATEGORIES = [
        ('RENT', 'Rent'),
        ('UTILITIES', 'Utilities'),
        ('SALARIES', 'Salaries'),
        ('OFFICE_SUPPLIES', 'Office Supplies'),
        ('TRAVEL', 'Travel'),
        ('MARKETING', 'Marketing'),
        ('SOFTWARE', 'Software'),
        ('MAINTENANCE', 'Maintenance'),
        ('INSURANCE', 'Insurance'),
        ('TAXES', 'Taxes'),
        ('OTHER', 'Other'),
    ]

    expense_number = models.CharField(max_length=50, unique=True)
    category = models.CharField(max_length=50, choices=EXPENSE_CATEGORIES)
    expense_date = models.DateField()
    amount = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    description = models.TextField()
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'finance_expenses'
        ordering = ['-expense_date']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['category']),
            models.Index(fields=['expense_date']),
        ]

    def __str__(self):
        return f'{self.expense_number} - {self.category}: {self.amount}'

    @property
    def paid(self):
        return self.payment_status == 'PAID'
