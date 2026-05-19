# apps/inventory/serializers/variant.py
from rest_framework import serializers
from apps.inventory.models import ProductVariant


class VariantDetailSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    product_id = serializers.UUIDField(source='product._id', read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    category_id = serializers.UUIDField(source='product.category._id', read_only=True, allow_null=True)
    brand_id = serializers.UUIDField(source='product.brand._id', read_only=True, allow_null=True)
    unit = serializers.CharField(source='product.unit', read_only=True)
    is_active = serializers.BooleanField(source='product.is_active', read_only=True)

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'sku', 'barcode', 'qr_code',
            'buying_price', 'selling_price',
            'min_stock_level', 'max_stock_level',
            'is_deleted',
            'product_id', 'product_name', 'category_id', 'brand_id', 'unit', 'is_active',
            'created_at', 'updated_at'
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
            'id', 'sku', 'barcode', 'selling_price', 'buying_price',
            'min_stock_level', 'product_name', 'category_id', 'brand_id',
            'unit', 'is_active', 'created_at', 'updated_at'
        ]
