from django.db import models
from apps.common.basemodel import BaseModel

class StockTransfer(BaseModel):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('PENDING', 'Pending'),
        ('IN_TRANSIT', 'In Transit'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    transfer_number = models.CharField(max_length=50, unique=True)
    variant = models.ForeignKey('ProductVariant', on_delete=models.PROTECT)
    source_warehouse = models.ForeignKey('Warehouse', on_delete=models.PROTECT, related_name='transfers_out')
    destination_warehouse = models.ForeignKey('Warehouse', on_delete=models.PROTECT, related_name='transfers_in')
    quantity = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    notes = models.TextField(blank=True)

    # Optional: planned transfer date, actual completion date
    planned_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'inventory_transfers'
        indexes = [
            models.Index(fields=['transfer_number']),
            models.Index(fields=['status']),
            models.Index(fields=['source_warehouse', 'status']),
            models.Index(fields=['destination_warehouse', 'status']),
        ]

    def __str__(self):
        return f"{self.transfer_number} - {self.variant.sku} ({self.quantity})"