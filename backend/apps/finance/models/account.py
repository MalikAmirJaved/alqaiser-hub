from django.db import models
from apps.common.basemodel import BaseModel

class Account(BaseModel):
    ACCOUNT_TYPES = [
        ('ASSET', 'Asset'),
        ('LIABILITY', 'Liability'),
        ('EQUITY', 'Equity'),
        ('INCOME', 'Income'),
        ('EXPENSE', 'Expense'),
    ]
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'finance_accounts'
        ordering = ['code']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['account_type']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"