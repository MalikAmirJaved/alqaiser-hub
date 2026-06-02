# apps/inventory/serializers/variant_image.py
from rest_framework import serializers
from apps.inventory.models import VariantImage

class VariantImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = VariantImage
        fields = ['id', 'image_url', 'sort_order', 'is_primary']