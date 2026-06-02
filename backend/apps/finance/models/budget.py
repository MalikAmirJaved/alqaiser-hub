from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from apps.common.basemodel import BaseModel

class Budget(BaseModel):
    PERIOD_TYPES = [
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('YEARLY', 'Yearly'),
    ]
    
    account = models.ForeignKey('Account', on_delete=models.CASCADE, related_name='budgets')
    period_type = models.CharField(max_length=20, choices=PERIOD_TYPES)
    year = models.IntegerField()
    month = models.IntegerField(null=True, blank=True)   # 1-12 for monthly
    quarter = models.IntegerField(null=True, blank=True) # 1-4 for quarterly
    amount = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal('0.00'))])
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'finance_budgets'
        ordering = ['-year', 'account__code']
        unique_together = [['account', 'period_type', 'year', 'month', 'quarter', 'company_id', 'branch_id']]
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['account', 'year']),
        ]

    def __str__(self):
        period = f"{self.year}"
        if self.period_type == 'MONTHLY' and self.month:
            period = f"{self.year}-{self.month:02d}"
        elif self.period_type == 'QUARTERLY' and self.quarter:
            period = f"{self.year} Q{self.quarter}"
        return f"{self.account.code} - {self.account.name}: {period} = {self.amount}"