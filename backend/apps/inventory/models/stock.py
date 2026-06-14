from django.db import models
from apps.common.basemodel import BaseModel

class StockItem(BaseModel):
    variant = models.ForeignKey('ProductVariant', on_delete=models.CASCADE, related_name='stock_items')
    warehouse = models.ForeignKey('Warehouse', on_delete=models.CASCADE)
    quantity_on_hand = models.PositiveIntegerField(default=0)
    quantity_reserved = models.PositiveIntegerField(default=0)
    version = models.PositiveIntegerField(default=0)
    bin_location = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = 'inventory_stock_items'
        unique_together = [['variant', 'warehouse']]
        indexes = [
            models.Index(fields=['variant', 'warehouse']),
        ]

    @property
    def quantity_available(self):
        return self.quantity_on_hand - self.quantity_reserved