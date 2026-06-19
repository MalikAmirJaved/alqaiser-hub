from django.db import models
from apps.common.basemodel import BaseModel

class VariantImage(BaseModel):
    variant = models.ForeignKey('ProductVariant', on_delete=models.CASCADE, related_name='variant_images')
    image_url = models.CharField(max_length=500)
    image_url_thumb = models.CharField(max_length=500, blank=True, null=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = 'inventory_variant_images'
        ordering = ['sort_order']
        indexes = [
            models.Index(fields=['variant', 'is_primary']),
        ]