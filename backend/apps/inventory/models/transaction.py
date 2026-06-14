from django.db import models
from apps.common.basemodel import BaseModel

class InventoryTransaction(BaseModel):
    TRANSACTION_TYPES = [
        ('PURCHASE_RECEIPT', 'Purchase Receipt'),
        ('SALE_SHIPMENT', 'Sale Shipment'),
        ('RETURN_IN', 'Return In'),
        ('RETURN_OUT', 'Return Out'),
        ('ADJUSTMENT', 'Adjustment'),
        ('DAMAGE', 'Damage'),
        ('ADD_STOCK', 'Add Stock'),
        ('TRANSFER_IN', 'Transfer In'),
        ('TRANSFER_OUT', 'Transfer Out'),
        ('STOCK_TAKE', 'Stock Take'),
        ('INITIAL', 'Initial Stock'),
    ]

    transaction_id = models.UUIDField(db_index=True)
    variant = models.ForeignKey('ProductVariant', on_delete=models.PROTECT)
    warehouse = models.ForeignKey('Warehouse', on_delete=models.PROTECT)
    quantity_change = models.IntegerField()
    quantity_before = models.PositiveIntegerField()
    quantity_after = models.PositiveIntegerField()
    unit_cost = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    transaction_type = models.CharField(max_length=30, choices=TRANSACTION_TYPES)
    source_document_type = models.CharField(max_length=30, blank=True)
    source_document_id = models.UUIDField(null=True, blank=True)
    source_line_id = models.UUIDField(null=True, blank=True)
    reason_code = models.CharField(max_length=50, blank=True)
    reason_text = models.TextField(blank=True)

    class Meta:
        db_table = 'inventory_transactions'
        indexes = [
            models.Index(fields=['transaction_id']),
            models.Index(fields=['variant', 'warehouse', '-created_at']),
            models.Index(fields=['created_at']),
        ]