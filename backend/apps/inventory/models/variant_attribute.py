from django.db import models
from apps.common.basemodel import BaseModel

class VariantAttribute(BaseModel):
    variant = models.ForeignKey('ProductVariant', on_delete=models.CASCADE, related_name='variant_attributes', null=True, blank=True)
    attribute_key = models.CharField(max_length=100)
    attribute_value = models.CharField(max_length=255)

    class Meta:
        db_table = 'inventory_variant_attributes'
        unique_together = [['variant', 'attribute_key']]
        constraints = [
            models.UniqueConstraint(
                fields=['company_id', 'branch_id', 'attribute_key', 'attribute_value'],
                condition=models.Q(variant__isnull=True),
                name='unique_catalog_attribute'
            ),
        ]
        indexes = [
            models.Index(fields=['attribute_key', 'attribute_value']),
        ]