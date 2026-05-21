from rest_framework import serializers
from apps.inventory.models import ProductVariant

class BarcodeSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    product_id = serializers.UUIDField(source='product._id', read_only=True)

    class Meta:
        model = ProductVariant
        fields = ['id', 'sku', 'barcode', 'product_name', 'product_id', 'created_at']
        read_only_fields = fields