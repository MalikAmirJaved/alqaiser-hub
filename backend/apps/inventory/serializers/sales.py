# ============================================================
# File: backend/apps/inventory/serializers/sales.py
# ============================================================
from rest_framework import serializers
from apps.inventory.models.sales import (
    SalesOrder, SalesOrderLine,
    SalesReturn, SalesReturnLine
)
from apps.inventory.models import ProductVariant, Customer, Warehouse
from apps.common.serializer_fields import UUIDForeignRelatedField


class SalesOrderLineSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    variant = UUIDForeignRelatedField(queryset=ProductVariant.objects.all())
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_name = serializers.CharField(source='variant.product.product_name', read_only=True)
    line_total = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    max_returnable = serializers.SerializerMethodField()

    created_by_info = serializers.SerializerMethodField()
    updated_by_info = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrderLine
        fields = [
            'id', 'variant', 'variant_sku', 'variant_name',
            'quantity_ordered', 'unit_price', 'tax_rate',
            'discount_percent', 'discount_amount',
            'line_total', 'status', 'notes',
            'quantity_returned', 'max_returnable',
            'created_at', 'updated_at',
            'created_by_info', 'updated_by_info',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_max_returnable(self, obj):
        return obj.max_returnable

    def get_created_by_info(self, obj):
        if obj.created_by:
            return {'id': obj.created_by._id, 'username': obj.created_by.username}
        return None

    def get_updated_by_info(self, obj):
        if obj.updated_by:
            return {'id': obj.updated_by._id, 'username': obj.updated_by.username}
        return None

    def get_line_total(self, obj):
        return obj.line_total


class SalesOrderSerializer(serializers.ModelSerializer):
    customer = UUIDForeignRelatedField(queryset=Customer.objects.all(), allow_null=True)
    warehouse = UUIDForeignRelatedField(queryset=Warehouse.objects.all())
    id = serializers.UUIDField(source='_id', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    lines = SalesOrderLineSerializer(many=True, read_only=True)
    line_items = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )
    created_by_info = serializers.SerializerMethodField()
    updated_by_info = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrder
        fields = [
            'id', 'order_number', 'customer', 'customer_name',
            'warehouse', 'warehouse_name', 'status',
            'order_date', 'total_amount', 'notes',
            'lines', 'line_items',
            'created_at', 'updated_at', 'created_by_info', 'updated_by_info',
        ]
        read_only_fields = ['order_number', 'created_at', 'updated_at']

    def get_created_by_info(self, obj):
        if obj.created_by:
            return {'id': obj.created_by._id, 'username': obj.created_by.username}
        return None

    def get_updated_by_info(self, obj):
        if obj.updated_by:
            return {'id': obj.updated_by._id, 'username': obj.updated_by.username}
        return None

    def create(self, validated_data):
        line_items_data = validated_data.pop('line_items', [])
        user = self.context['request'].user
        company_id = user.company_id
        branch_id = user.branch_id

        validated_data['order_number'] = self._generate_order_number()
        validated_data['company_id'] = company_id
        validated_data['branch_id'] = branch_id
        validated_data['created_by'] = user
        validated_data['updated_by'] = user

        order = SalesOrder.objects.create(**validated_data)
        total_amount = 0

        for item in line_items_data:
            variant_uuid = item.get('variant')
            variant = ProductVariant.objects.get(_id=variant_uuid, company_id=company_id)
            qty = item['quantity_ordered']
            unit_price = item['unit_price']
            discount_pct = item.get('discount_pct', 0)
            discount_fixed = item.get('discount_fixed', 0)
            tax_rate = item.get('tax_rate', 0)

            subtotal = qty * unit_price
            if discount_fixed > 0:
                discount = discount_fixed
            else:
                discount = subtotal * (discount_pct / 100)
            line_total = subtotal - discount
            total_amount += line_total

            SalesOrderLine.objects.create(
                sales_order=order,
                variant=variant,
                quantity_ordered=qty,
                unit_price=unit_price,
                tax_rate=tax_rate,
                discount_percent=discount_pct,
                discount_amount=discount_fixed,
                quantity_returned=0,
                company_id=company_id,
                branch_id=branch_id,
                created_by=user,
                updated_by=user,
            )

        order.total_amount = total_amount
        order.save(update_fields=['total_amount'])
        return order

    def _generate_order_number(self):
        import time, random
        return f"SO-{int(time.time())}-{random.randint(1000, 9999)}"


class SalesReturnLineSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    refund_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)

    class Meta:
        model = SalesReturnLine
        fields = ['id', 'sales_order_line', 'quantity_returned', 'refund_amount', 'restock', 'unit_cost', 'reason']


class SalesReturnSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    sales_order = UUIDForeignRelatedField(queryset=SalesOrder.objects.all())
    warehouse = UUIDForeignRelatedField(queryset=Warehouse.objects.all())
    sales_order_number = serializers.CharField(source='sales_order.order_number', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    lines = SalesReturnLineSerializer(many=True, read_only=True)
    return_lines = serializers.ListField(
        child=serializers.DictField(), write_only=True
    )
    created_by_info = serializers.SerializerMethodField()
    updated_by_info = serializers.SerializerMethodField()

    class Meta:
        model = SalesReturn
        fields = [
            'id', 'return_number', 'sales_order', 'sales_order_number',
            'warehouse', 'warehouse_name', 'return_date', 'status', 'reason',
            'lines', 'return_lines',
            'created_at', 'updated_at', 'created_by_info', 'updated_by_info',
        ]
        read_only_fields = ['return_number', 'created_at', 'updated_at']

    def get_created_by_info(self, obj):
        if obj.created_by:
            return {'id': obj.created_by._id, 'username': obj.created_by.username}
        return None

    def get_updated_by_info(self, obj):
        if obj.updated_by:
            return {'id': obj.updated_by._id, 'username': obj.updated_by.username}
        return None

    def create(self, validated_data):
        return_lines_data = validated_data.pop('return_lines')
        user = self.context['request'].user
        company_id = user.company_id
        branch_id = user.branch_id

        # Validate each return line
        for line_data in return_lines_data:
            sol_uuid = line_data['sales_order_line_id']
            try:
                sol = SalesOrderLine.objects.get(_id=sol_uuid, company_id=company_id)
            except SalesOrderLine.DoesNotExist:
                raise serializers.ValidationError(f"Sales order line {sol_uuid} not found.")
            qty = line_data['quantity_returned']
            if qty > sol.max_returnable:
                raise serializers.ValidationError(
                    f"Cannot return more than {sol.max_returnable} units for this line. "
                    f"Ordered: {sol.quantity_ordered}, already returned: {sol.quantity_returned}"
                )
            refund_amount = line_data.get('refund_amount')
            if refund_amount is not None:
                if refund_amount > sol.line_total:
                    raise serializers.ValidationError(f"Refund amount cannot exceed line total ({sol.line_total}).")

        validated_data['return_number'] = self._generate_return_number()
        validated_data['company_id'] = company_id
        validated_data['branch_id'] = branch_id
        validated_data['created_by'] = user
        validated_data['updated_by'] = user

        ret = SalesReturn.objects.create(**validated_data)

        for line_data in return_lines_data:
            sol_uuid = line_data['sales_order_line_id']
            sales_order_line = SalesOrderLine.objects.get(_id=sol_uuid, company_id=company_id)
            refund_amount = line_data.get('refund_amount')
            if refund_amount is None:
                proportion = line_data['quantity_returned'] / sales_order_line.quantity_ordered
                refund_amount = sales_order_line.line_total * proportion

            SalesReturnLine.objects.create(
                sales_return=ret,
                sales_order_line=sales_order_line,
                quantity_returned=line_data['quantity_returned'],
                refund_amount=refund_amount,
                restock=line_data.get('restock', True),
                unit_cost=line_data.get('unit_cost', 0),
                reason=line_data.get('reason', ''),
                company_id=company_id,
                branch_id=branch_id,
                created_by=user,
                updated_by=user,
            )

            # Increment returned quantity on the original line
            sales_order_line.quantity_returned += line_data['quantity_returned']
            sales_order_line.save(update_fields=['quantity_returned'])

        return ret

    def _generate_return_number(self):
        import time, random
        return f"SR-{int(time.time())}-{random.randint(1000, 9999)}"