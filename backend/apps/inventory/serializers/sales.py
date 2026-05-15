# ============================================================
# File: backend/apps/inventory/serializers/sales.py
# ============================================================
from rest_framework import serializers
from apps.inventory.models.sales import (
    Customer, SalesOrder, SalesOrderLine,
    SalesShipment, SalesShipmentLine,
    SalesReturn, SalesReturnLine
)
from apps.inventory.models import ProductVariant, Warehouse


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            'id', 'customer_code', 'name', 'contact_person', 'email', 'phone',
            'address_line', 'city', 'state', 'postal_code', 'country', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SalesOrderLineSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_name = serializers.CharField(source='variant.product.product_name', read_only=True)
    line_total = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    quantity_pending = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrderLine
        fields = [
            'id', 'variant', 'variant_sku', 'variant_name',
            'quantity_ordered', 'quantity_shipped', 'quantity_pending',
            'unit_price', 'tax_rate', 'line_total', 'status', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'quantity_shipped']

    def get_quantity_pending(self, obj):
        return obj.quantity_ordered - obj.quantity_shipped


class SalesOrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    lines = SalesOrderLineSerializer(many=True, read_only=True)
    line_items = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )

    class Meta:
        model = SalesOrder
        fields = [
            'id', 'order_number', 'customer', 'customer_name',
            'warehouse', 'warehouse_name', 'status',
            'order_date', 'expected_ship_date', 'total_amount',
            'notes', 'lines', 'line_items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'order_number', 'created_at', 'updated_at']

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
            variant_id = item['variant']
            variant = ProductVariant.objects.get(id=variant_id, company_id=company_id)
            qty = item['quantity_ordered']
            unit_price = item['unit_price']
            line_total = qty * unit_price
            total_amount += line_total

            SalesOrderLine.objects.create(
                sales_order=order,
                variant=variant,
                quantity_ordered=qty,
                unit_price=unit_price,
                tax_rate=item.get('tax_rate', 0),
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


class SalesShipmentLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesShipmentLine
        fields = ['id', 'sales_order_line', 'quantity_shipped']


class SalesShipmentSerializer(serializers.ModelSerializer):
    lines = SalesShipmentLineSerializer(many=True, read_only=True)
    shipment_lines = serializers.ListField(
        child=serializers.DictField(), write_only=True
    )

    class Meta:
        model = SalesShipment
        fields = [
            'id', 'shipment_number', 'sales_order', 'shipment_date',
            'carrier', 'tracking_number', 'status', 'notes',
            'lines', 'shipment_lines', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'shipment_number', 'created_at', 'updated_at']

    def create(self, validated_data):
        shipment_lines_data = validated_data.pop('shipment_lines')
        user = self.context['request'].user
        company_id = user.company_id
        branch_id = user.branch_id

        validated_data['shipment_number'] = self._generate_shipment_number()
        validated_data['company_id'] = company_id
        validated_data['branch_id'] = branch_id
        validated_data['created_by'] = user
        validated_data['updated_by'] = user

        shipment = SalesShipment.objects.create(**validated_data)

        for line_data in shipment_lines_data:
            SalesShipmentLine.objects.create(
                shipment=shipment,
                sales_order_line_id=line_data['sales_order_line_id'],
                quantity_shipped=line_data['quantity_shipped'],
                company_id=company_id,
                branch_id=branch_id,
                created_by=user,
                updated_by=user,
            )
        return shipment

    def _generate_shipment_number(self):
        import time, random
        return f"SH-{int(time.time())}-{random.randint(1000, 9999)}"


class SalesReturnLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesReturnLine
        fields = ['id', 'sales_order_line', 'quantity_returned', 'restock', 'unit_cost', 'reason']


class SalesReturnSerializer(serializers.ModelSerializer):
    lines = SalesReturnLineSerializer(many=True, read_only=True)
    return_lines = serializers.ListField(
        child=serializers.DictField(), write_only=True
    )

    class Meta:
        model = SalesReturn
        fields = [
            'id', 'return_number', 'sales_order', 'warehouse',
            'return_date', 'status', 'reason',
            'lines', 'return_lines', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'return_number', 'created_at', 'updated_at']

    def create(self, validated_data):
        return_lines_data = validated_data.pop('return_lines')
        user = self.context['request'].user
        company_id = user.company_id
        branch_id = user.branch_id

        validated_data['return_number'] = self._generate_return_number()
        validated_data['company_id'] = company_id
        validated_data['branch_id'] = branch_id
        validated_data['created_by'] = user
        validated_data['updated_by'] = user

        ret = SalesReturn.objects.create(**validated_data)

        for line_data in return_lines_data:
            SalesReturnLine.objects.create(
                sales_return=ret,
                sales_order_line_id=line_data['sales_order_line_id'],
                quantity_returned=line_data['quantity_returned'],
                restock=line_data.get('restock', True),
                unit_cost=line_data.get('unit_cost', 0),
                reason=line_data.get('reason', ''),
                company_id=company_id,
                branch_id=branch_id,
                created_by=user,
                updated_by=user,
            )
        return ret

    def _generate_return_number(self):
        import time, random
        return f"SR-{int(time.time())}-{random.randint(1000, 9999)}"