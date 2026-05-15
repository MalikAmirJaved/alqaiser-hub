from rest_framework import serializers
from apps.inventory.models import StockItem, InventoryTransaction, ProductVariant, Warehouse


class StockAdjustmentSerializer(serializers.Serializer):
    """Serializer for stock adjustment request (add/damage)."""
    variant_id = serializers.UUIDField()
    warehouse_id = serializers.UUIDField()
    quantity_change = serializers.IntegerField()  # positive = add, negative = damage
    reason = serializers.CharField(max_length=255, required=True)
    transaction_type = serializers.ChoiceField(
        choices=['ADD_STOCK', 'DAMAGE', 'ADJUSTMENT'],
        default='ADJUSTMENT'
    )

    def validate_quantity_change(self, value):
        if value == 0:
            raise serializers.ValidationError("Quantity change cannot be zero.")
        return value

    def validate(self, data):
        # Ensure variant exists and belongs to user's company
        variant = ProductVariant.objects.filter(
            _id=data['variant_id'],
            company_id=self.context['request'].user.company_id
        ).first()
        if not variant:
            raise serializers.ValidationError({"variant_id": "Variant not found."})
        data['variant'] = variant

        # Ensure warehouse exists
        warehouse = Warehouse.objects.filter(
            _id=data['warehouse_id'],
            company_id=self.context['request'].user.company_id
        ).first()
        if not warehouse:
            raise serializers.ValidationError({"warehouse_id": "Warehouse not found."})
        data['warehouse'] = warehouse

        # For damage/negative adjustment, check sufficient stock
        if data['quantity_change'] < 0:
            stock_item = StockItem.objects.filter(
                variant=variant,
                warehouse=warehouse,
                company_id=self.context['request'].user.company_id
            ).first()
            if not stock_item or stock_item.quantity_on_hand < abs(data['quantity_change']):
                raise serializers.ValidationError(
                    "Insufficient stock. Available: {}".format(
                        stock_item.quantity_on_hand if stock_item else 0
                    )
                )
        return data


class StockHistoryFilterSerializer(serializers.Serializer):
    """Query params for stock history."""
    variant_id = serializers.UUIDField(required=False)
    warehouse_id = serializers.UUIDField(required=False)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    transaction_type = serializers.ChoiceField(
        choices=InventoryTransaction.TRANSACTION_TYPES, required=False
    )
    page = serializers.IntegerField(default=1)
    page_size = serializers.IntegerField(default=20, max_value=100)


class StockItemSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_name = serializers.CharField(source='variant.product.product_name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    quantity_available = serializers.IntegerField(read_only=True)

    class Meta:
        model = StockItem
        fields = [
            'id', 'variant_id', 'variant_sku', 'variant_name',
            'warehouse_id', 'warehouse_name', 'quantity_on_hand',
            'quantity_reserved', 'quantity_available', 'bin_location',
            'version', 'updated_at'
        ]


class InventoryTransactionSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)

    class Meta:
        model = InventoryTransaction
        fields = [
            '_id', 'id', 'transaction_id', 'variant_id', 'variant_sku',
            'warehouse_id', 'warehouse_name', 'quantity_change',
            'quantity_before', 'quantity_after', 'unit_cost',
            'transaction_type', 'transaction_type_display',
            'reason_text', 'created_by', 'created_at'
        ]
        read_only_fields = fields