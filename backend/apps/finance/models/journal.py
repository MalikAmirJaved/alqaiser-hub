from decimal import Decimal
from django.db import models
from apps.common.basemodel import BaseModel

class JournalEntry(BaseModel):
    entry_number = models.CharField(max_length=50, unique=True)
    date = models.DateField()
    description = models.TextField(blank=True)
    is_posted = models.BooleanField(default=True)
    reference_type = models.CharField(max_length=50, blank=True)
    reference_id = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = 'finance_journal_entries'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['entry_number']),
            models.Index(fields=['date']),
            models.Index(fields=['reference_type', 'reference_id']),
        ]

    def __str__(self):
        return f"{self.entry_number} - {self.date}"


class JournalLine(BaseModel):
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account = models.ForeignKey('Account', on_delete=models.PROTECT)
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    inventory_transaction_id = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = 'finance_journal_lines'
        indexes = [
            models.Index(fields=['journal_entry']),
            models.Index(fields=['account']),
            models.Index(fields=['company_id', 'branch_id']),
        ]

    def __str__(self):
        return f"{self.journal_entry.entry_number} - {self.account.code} {'DR' if self.debit else 'CR'}"