from django.db import models
from apps.common.basemodel import BaseModel

class ProductVariant(BaseModel):
    product = models.ForeignKey('Product', on_delete=models.CASCADE, related_name='variants')
    sku = models.CharField(max_length=100)
    barcode = models.CharField(max_length=100, blank=True)
    qr_code = models.CharField(max_length=200, blank=True)

    buying_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)

    min_stock_level = models.PositiveIntegerField(default=0)
    max_stock_level = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'inventory_product_variants'
        unique_together = [['company_id', 'branch_id', 'sku']]
        indexes = [
            models.Index(fields=['sku']),
            models.Index(fields=['barcode']),
        ]

    def __str__(self):
        return f"{self.sku} - {self.product.product_name}"