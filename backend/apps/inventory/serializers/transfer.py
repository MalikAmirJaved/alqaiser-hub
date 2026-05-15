from rest_framework import serializers
from apps.inventory.models import StockTransfer, ProductVariant, Warehouse, StockItem

class StockTransferSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_name = serializers.CharField(source='variant.product.product_name', read_only=True)
    source_warehouse_name = serializers.CharField(source='source_warehouse.warehouse_name', read_only=True)
    destination_warehouse_name = serializers.CharField(source='destination_warehouse.warehouse_name', read_only=True)

    class Meta:
        model = StockTransfer
        fields = [
            'id', 'transfer_number', 'variant_id', 'variant_sku', 'variant_name',
            'source_warehouse_id', 'source_warehouse_name',
            'destination_warehouse_id', 'destination_warehouse_name',
            'quantity', 'status', 'notes', 'planned_date',
            'completed_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'transfer_number', 'completed_at', 'created_at', 'updated_at']


class StockTransferCreateSerializer(serializers.Serializer):
    variant_id = serializers.CharField()
    source_warehouse_id = serializers.CharField()
    destination_warehouse_id = serializers.CharField()
    quantity = serializers.IntegerField(min_value=1)
    planned_date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_variant_id(self, value):
        user = self.context['request'].user
        try:
            # Try to parse as integer ID, else treat as UUID (_id)
            if value.isdigit():
                variant = ProductVariant.objects.get(id=value, company_id=user.company_id)
            else:
                variant = ProductVariant.objects.get(_id=value, company_id=user.company_id)
            return variant
        except ProductVariant.DoesNotExist:
            raise serializers.ValidationError("Variant not found.")

    def validate_source_warehouse_id(self, value):
        user = self.context['request'].user
        try:
            if value.isdigit():
                warehouse = Warehouse.objects.get(id=value, company_id=user.company_id)
            else:
                warehouse = Warehouse.objects.get(_id=value, company_id=user.company_id)
            return warehouse
        except Warehouse.DoesNotExist:
            raise serializers.ValidationError("Source warehouse not found.")

    def validate_destination_warehouse_id(self, value):
        user = self.context['request'].user
        try:
            if value.isdigit():
                warehouse = Warehouse.objects.get(id=value, company_id=user.company_id)
            else:
                warehouse = Warehouse.objects.get(_id=value, company_id=user.company_id)
            return warehouse
        except Warehouse.DoesNotExist:
            raise serializers.ValidationError("Destination warehouse not found.")

    def validate(self, data):
        variant = data['variant_id']
        source_wh = data['source_warehouse_id']
        dest_wh = data['destination_warehouse_id']
        quantity = data['quantity']

        if source_wh == dest_wh:
            raise serializers.ValidationError("Source and destination warehouses cannot be the same.")

        try:
            stock_item = StockItem.objects.get(
                variant=variant,
                warehouse=source_wh,
                company_id=self.context['request'].user.company_id
            )
            available = stock_item.quantity_on_hand - stock_item.quantity_reserved
            if available < quantity:
                raise serializers.ValidationError(
                    f"Insufficient available stock at source. Available: {available}"
                )
        except StockItem.DoesNotExist:
            raise serializers.ValidationError("No stock record found at source warehouse.")

        return data