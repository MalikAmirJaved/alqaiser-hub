from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from apps.common.basemodel import BaseModel

class Expense(BaseModel):
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
    paid = models.BooleanField(default=False)
    payment_date = models.DateField(null=True, blank=True)
    payment_method = models.CharField(max_length=20, blank=True)
    reference_number = models.CharField(max_length=100, blank=True)
    journal_entry = models.OneToOneField('JournalEntry', on_delete=models.SET_NULL, null=True, blank=True)
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
        return f"{self.expense_number} - {self.category}: {self.amount}"