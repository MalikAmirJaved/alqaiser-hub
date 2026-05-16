from rest_framework import serializers
from django.db import models
from apps.inventory.models import (
    Product, ProductVariant, StockItem, Category, Brand,
    VariantAttribute, VariantImage
)
from apps.inventory.serializers.variant_attribute import VariantAttributeSerializer
from apps.inventory.serializers.variant_image import VariantImageSerializer


class ProductVariantSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    variant_attributes = VariantAttributeSerializer(many=True, read_only=True)
    variant_images = VariantImageSerializer(many=True, read_only=True)
    
    attributes = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )
    images = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )
    
    total_stock = serializers.SerializerMethodField()
    stock_by_warehouse = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'sku', 'barcode', 'qr_code', 'buying_price', 'selling_price',
            'min_stock_level', 'max_stock_level', 'is_deleted',
            'variant_attributes', 'variant_images',
            'attributes', 'images',
            'total_stock', 'stock_by_warehouse',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_stock(self, obj):
        return obj.stock_items.aggregate(total=models.Sum('quantity_on_hand'))['total'] or 0

    def get_stock_by_warehouse(self, obj):
        return [
            {
                'warehouse_id': str(s.warehouse._id),
                'warehouse_name': s.warehouse.warehouse_name,
                'quantity_on_hand': s.quantity_on_hand,
                'quantity_reserved': s.quantity_reserved
            }
            for s in obj.stock_items.select_related('warehouse')
        ]

    def _create_attributes(self, variant, attributes_data, company_id, branch_id):
        for attr in attributes_data:
            VariantAttribute.objects.create(
                variant=variant,
                company_id=company_id,
                branch_id=branch_id,
                attribute_key=attr.get('key', ''),
                attribute_value=attr.get('value', '')
            )

    def _create_images(self, variant, images_data, company_id, branch_id):
        for idx, url in enumerate(images_data):
            VariantImage.objects.create(
                variant=variant,
                company_id=company_id,
                branch_id=branch_id,
                image_url=url,
                sort_order=idx,
                is_primary=(idx == 0)
            )

    def create(self, validated_data):
        attributes_data = validated_data.pop('attributes', [])
        images_data = validated_data.pop('images', [])
        company_id = validated_data.get('company_id')
        branch_id = validated_data.get('branch_id')

        variant = ProductVariant.objects.create(**validated_data)

        if attributes_data:
            self._create_attributes(variant, attributes_data, company_id, branch_id)
        if images_data:
            self._create_images(variant, images_data, company_id, branch_id)

        return variant

    def update(self, instance, validated_data):
        attributes_data = validated_data.pop('attributes', None)
        images_data = validated_data.pop('images', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if attributes_data is not None:
            instance.variant_attributes.all().delete()
            self._create_attributes(
                instance, attributes_data,
                instance.company_id, instance.branch_id
            )

        if images_data is not None:
            instance.variant_images.all().delete()
            self._create_images(
                instance, images_data,
                instance.company_id, instance.branch_id
            )

        return instance


class ProductSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    category_id = serializers.UUIDField(source='category._id', read_only=True, allow_null=True)
    brand_id    = serializers.UUIDField(source='brand._id',    read_only=True, allow_null=True)

    class Meta:
        model = Product
        fields = [
            'id', 'product_name', 'description', 'category_id', 'brand_id',
            'unit', 'storage_requirement', 'tax_rate', 'status', 'is_active',
            'variants', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']