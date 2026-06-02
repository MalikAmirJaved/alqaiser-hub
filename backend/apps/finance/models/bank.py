from decimal import Decimal
from django.db import models
from apps.common.basemodel import BaseModel

class BankAccount(BaseModel):
    account_name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=50)
    bank_name = models.CharField(max_length=100)
    opening_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    current_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    currency = models.CharField(max_length=3, default='USD')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'finance_bank_accounts'
        ordering = ['account_name']
        unique_together = [['company_id', 'branch_id', 'account_number']]
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.bank_name} - {self.account_name}"


class BankTransaction(BaseModel):
    TRANSACTION_TYPES = [
        ('DEPOSIT', 'Deposit'),
        ('WITHDRAWAL', 'Withdrawal'),
        ('FEE', 'Fee'),
        ('INTEREST', 'Interest'),
    ]
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='transactions')
    transaction_date = models.DateField()
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    description = models.CharField(max_length=255, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    reconciled = models.BooleanField(default=False)
    reconciled_with_payment = models.ForeignKey('Payment', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'finance_bank_transactions'
        ordering = ['-transaction_date']
        indexes = [
            models.Index(fields=['bank_account', 'reconciled']),
            models.Index(fields=['transaction_date']),
        ]