# apps/inventory/serializers/variant.py
from rest_framework import serializers
from apps.inventory.models import ProductVariant, VariantAttribute


class VariantDetailSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    product_id = serializers.UUIDField(source='product._id', read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    category_id = serializers.UUIDField(source='product.category._id', read_only=True, allow_null=True)
    brand_id = serializers.UUIDField(source='product.brand._id', read_only=True, allow_null=True)
    unit = serializers.CharField(source='product.unit', read_only=True)
    is_active = serializers.BooleanField(source='product.is_active', read_only=True)
    attributes = serializers.SerializerMethodField()
    total_stock = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'sku', 'variant_title', 'barcode',
            'selling_price',
            'min_stock_level', 'max_stock_level',
            'is_deleted', 'attributes',
            'product_id', 'product_name', 'category_id', 'brand_id', 'unit', 'is_active',
            'total_stock',
            'created_at', 'updated_at'
        ]

    def get_attributes(self, obj):
        qs = obj.variant_attributes.filter(is_deleted=False)
        return [
            {
                'key': attr.attribute_key,
                'value': attr.attribute_value,
            }
            for attr in qs
        ]

class VariantPOSSerializer(serializers.ModelSerializer):
    """Lightweight serializer for POS – excludes heavy relations"""
    id = serializers.UUIDField(source='_id', read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    category_id = serializers.UUIDField(source='product.category._id', read_only=True, allow_null=True)
    brand_id = serializers.UUIDField(source='product.brand._id', read_only=True, allow_null=True)
    unit = serializers.CharField(source='product.unit', read_only=True)
    is_active = serializers.BooleanField(source='product.is_active', read_only=True)
    
    class Meta:
        model = ProductVariant
        fields = [
            'id', 'sku', 'barcode', 'selling_price',
            'min_stock_level', 'product_name', 'category_id', 'brand_id',
            'unit', 'is_active', 'created_at', 'updated_at'
        ]
