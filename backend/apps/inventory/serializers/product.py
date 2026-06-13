# apps/inventory/serializers/product.py
from rest_framework import serializers
from apps.inventory.models import (
    Product, ProductVariant, ProductAttribute, Tag, ProductTag, Inventory, Warehouse
)

class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = [
            'id', 'sku', 'barcode', 'attribute_combination',
            'cost_price', 'selling_price', 'special_price',
            'main_image', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class ProductAttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductAttribute
        fields = ['id', 'attribute_name', 'attribute_value', 'attribute_group', 'is_filterable', 'display_order']

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug', 'color', 'description', 'is_active']

class InventorySerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    available_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Inventory
        fields = [
            'id', 'warehouse', 'warehouse_name', 'stock_quantity', 'reserved_quantity',
            'available_quantity', 'reorder_point', 'reorder_quantity', 'max_stock_level',
            'lead_time_days', 'shelf_life_days', 'location_bin', 'last_counted_at'
        ]

class ProductSerializer(serializers.ModelSerializer):
    variants = ProductVariantSerializer(many=True, read_only=True)
    attributes = ProductAttributeSerializer(many=True, read_only=True)
    tags = serializers.SerializerMethodField()
    inventory = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'barcode', 'name', 'short_description', 'description',
            'category_id', 'brand_id', 'product_type', 'unit_of_measure',
            'cost_price', 'selling_price', 'special_price', 'special_price_from',
            'special_price_to', 'msrp', 'tax_class', 'tax_rate',
            'main_image', 'gallery_images', 'video_url', 'status',
            'created_at', 'updated_at', 'variants', 'attributes', 'tags', 'inventory'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_tags(self, obj):
        tags = Tag.objects.filter(producttag__product=obj)
        return TagSerializer(tags, many=True).data

    def get_inventory(self, obj):
        inventory_qs = Inventory.objects.filter(product=obj).select_related('warehouse')
        return InventorySerializer(inventory_qs, many=True).data