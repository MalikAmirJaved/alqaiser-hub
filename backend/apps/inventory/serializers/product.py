from rest_framework import serializers
from django.utils.text import slugify
from django.db.models import Q
from apps.inventory.models import (
    Product, ProductVariant, ProductAttribute, Tag, TagGroup, ProductTag
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


class TagGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = TagGroup
        fields = ['id', 'name', 'slug', 'description']


class TagSerializer(serializers.ModelSerializer):
    group = TagGroupSerializer(read_only=True)
    group_id = serializers.PrimaryKeyRelatedField(
        source='group', queryset=TagGroup.objects.all(), write_only=True, required=False
    )

    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug', 'color', 'description', 'is_active', 'group', 'group_id']


class ProductSerializer(serializers.ModelSerializer):
    variants = ProductVariantSerializer(many=True, required=False)
    attributes = ProductAttributeSerializer(many=True, required=False)
    tags = serializers.SerializerMethodField()
    # Accept tags as a list of strings or objects with name/group
    tag_input = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'barcode', 'name', 'short_description', 'description',
            'category_id', 'brand_id', 'product_type', 'unit_of_measure',
            'tax_class',
            'main_image', 'gallery_images', 'video_url', 'status',
            'created_at', 'updated_at', 'variants', 'attributes', 'tags', 'tag_input'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_tags(self, obj):
        tags = Tag.objects.filter(producttag__product=obj)
        return TagSerializer(tags, many=True).data

    def _handle_tags(self, product, tag_input):
        """Create or retrieve tags from input list of {name, group?}."""
        # Clear existing tags (optional: you could merge, but replacing is simpler)
        ProductTag.objects.filter(product=product).delete()

        for tag_item in tag_input:
            name = tag_item.get('name', '').strip()
            if not name:
                continue
            group_name = tag_item.get('group', '').strip() or None
            slug = slugify(name)

            # Get or create tag group
            group = None
            if group_name:
                group_slug = slugify(group_name)
                group, _ = TagGroup.objects.get_or_create(
                    company_id=product.company_id,
                    branch_id=product.branch_id,
                    slug=group_slug,
                    defaults={'name': group_name}
                )

            # Get or create tag
            tag, created = Tag.objects.get_or_create(
                company_id=product.company_id,
                branch_id=product.branch_id,
                slug=slug,
                defaults={
                    'name': name,
                    'group': group,
                }
            )
            # If tag existed but group is missing, update it
            if not created and group and tag.group != group:
                tag.group = group
                tag.save(update_fields=['group'])

            ProductTag.objects.get_or_create(product=product, tag=tag)

    def create(self, validated_data):
        variants_data = validated_data.pop('variants', [])
        attributes_data = validated_data.pop('attributes', [])
        tag_input = validated_data.pop('tag_input', [])

        product = Product.objects.create(**validated_data)

        for variant_data in variants_data:
            ProductVariant.objects.create(product=product, **variant_data)

        for attr_data in attributes_data:
            ProductAttribute.objects.create(product=product, **attr_data)

        self._handle_tags(product, tag_input)

        return product

    def update(self, instance, validated_data):
        variants_data = validated_data.pop('variants', [])
        attributes_data = validated_data.pop('attributes', [])
        tag_input = validated_data.pop('tag_input', [])

        # Update product fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Replace variants
        instance.variants.all().delete()
        for variant_data in variants_data:
            ProductVariant.objects.create(product=instance, **variant_data)

        # Replace attributes
        instance.attributes.all().delete()
        for attr_data in attributes_data:
            ProductAttribute.objects.create(product=instance, **attr_data)

        # Replace tags
        self._handle_tags(instance, tag_input)

        return instance