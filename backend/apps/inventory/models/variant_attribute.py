from django.db import models
from apps.common.basemodel import BaseModel

class VariantAttribute(BaseModel):
    variant = models.ForeignKey('ProductVariant', on_delete=models.CASCADE, related_name='variant_attributes')
    attribute_key = models.CharField(max_length=100)
    attribute_value = models.CharField(max_length=255)

    class Meta:
        db_table = 'inventory_variant_attributes'
        unique_together = [['variant', 'attribute_key']]
        indexes = [
            models.Index(fields=['attribute_key', 'attribute_value']),
        ]