from rest_framework import serializers
from apps.inventory.models import StockItem, InventoryTransaction, ProductVariant, Warehouse


class StockAdjustmentSerializer(serializers.Serializer):
    variant_id = serializers.UUIDField()
    warehouse_id = serializers.UUIDField()
    quantity_change = serializers.IntegerField()
    reason = serializers.CharField(max_length=255, required=True)
    transaction_type = serializers.ChoiceField(
        choices=['DAMAGE', 'ADJUSTMENT', 'STOCK_TAKE'],
        default='ADJUSTMENT'
    )

    def validate_quantity_change(self, value):
        if value == 0:
            raise serializers.ValidationError("Quantity change cannot be zero.")
        return value

    def validate(self, data):
        variant = ProductVariant.objects.filter(
            _id=data['variant_id'],
            company_id=self.context['request'].user.company_id
        ).first()
        if not variant:
            raise serializers.ValidationError({"variant_id": "Variant not found."})
        data['variant'] = variant

        warehouse = Warehouse.objects.filter(
            _id=data['warehouse_id'],
            company_id=self.context['request'].user.company_id
        ).first()
        if not warehouse:
            raise serializers.ValidationError({"warehouse_id": "Warehouse not found."})
        data['warehouse'] = warehouse

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
    id = serializers.UUIDField(source='_id', read_only=True)
    variant_id = serializers.UUIDField(source='variant._id', read_only=True)
    warehouse_id = serializers.UUIDField(source='warehouse._id', read_only=True)
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
    id = serializers.UUIDField(source='_id', read_only=True)
    variant_id = serializers.UUIDField(source='variant._id', read_only=True)
    warehouse_id = serializers.UUIDField(source='warehouse._id', read_only=True)
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)

    # 👇 NEW FIELDS: who made the change
    created_by_name = serializers.SerializerMethodField()
    created_by_email = serializers.SerializerMethodField()

    class Meta:
        model = InventoryTransaction
        fields = [
            'id', 'transaction_id', 'variant_id', 'variant_sku',
            'warehouse_id', 'warehouse_name', 'quantity_change',
            'quantity_before', 'quantity_after', 'unit_cost',
            'transaction_type', 'transaction_type_display',
            'reason_text', 'created_by', 'created_at',
            'created_by_name', 'created_by_email',   # add these
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj):
        user = obj.created_by
        if not user:
            return None

        return (
            user.get_full_name()
            or user.username
            or user.email
        )

    def get_created_by_email(self, obj):
        return obj.created_by.email if obj.created_by else None