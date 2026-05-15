from rest_framework import serializers
from apps.inventory.models import (
    PurchaseOrder, PurchaseOrderLine, GoodsReceipt, GoodsReceiptLine,
    ProductVariant, Warehouse, Supplier
)


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_name = serializers.CharField(source='variant.product.product_name', read_only=True)
    line_total = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    quantity_pending = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrderLine
        fields = [
            'id', 'variant', 'variant_sku', 'variant_name',
            'quantity_ordered', 'quantity_received', 'quantity_pending',
            'unit_cost', 'tax_rate', 'line_total', 'status', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'quantity_received']

    def get_quantity_pending(self, obj):
        return obj.quantity_ordered - obj.quantity_received


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    lines = PurchaseOrderLineSerializer(many=True, read_only=True)
    # Write-only line data
    line_items = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'order_number', 'supplier', 'supplier_name',
            'warehouse', 'warehouse_name', 'status',
            'order_date', 'expected_delivery_date', 'total_amount',
            'notes', 'lines', 'line_items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'order_number', 'created_at', 'updated_at']

    def create(self, validated_data):
        line_items_data = validated_data.pop('line_items', [])
        user = self.context['request'].user
        company_id = user.company_id
        branch_id = user.branch_id

        # Generate order number
        validated_data['order_number'] = self._generate_order_number()
        validated_data['company_id'] = company_id
        validated_data['branch_id'] = branch_id
        validated_data['created_by'] = user
        validated_data['updated_by'] = user

        po = PurchaseOrder.objects.create(**validated_data)

        # Create line items
        total_amount = 0
        for line_data in line_items_data:
            variant_id = line_data.get('variant')
            variant = ProductVariant.objects.get(id=variant_id, company_id=company_id)
            qty = line_data['quantity_ordered']
            unit_cost = line_data['unit_cost']
            line_total = qty * unit_cost
            total_amount += line_total

            PurchaseOrderLine.objects.create(
                purchase_order=po,
                variant=variant,
                quantity_ordered=qty,
                unit_cost=unit_cost,
                tax_rate=line_data.get('tax_rate', 0),
                company_id=company_id,
                branch_id=branch_id,
                created_by=user,
                updated_by=user,
            )

        po.total_amount = total_amount
        po.save(update_fields=['total_amount'])
        return po

    def _generate_order_number(self):
        import time
        import random
        return f"PO-{int(time.time())}-{random.randint(1000, 9999)}"


class GoodsReceiptLineSerializer(serializers.ModelSerializer):
    variant_name = serializers.CharField(source='purchase_order_line.variant.product.product_name', read_only=True)

    class Meta:
        model = GoodsReceiptLine
        fields = [
            'id', 'purchase_order_line', 'quantity_received',
            'unit_cost', 'accepted', 'variant_name'
        ]


class GoodsReceiptSerializer(serializers.ModelSerializer):
    purchase_order_number = serializers.CharField(source='purchase_order.order_number', read_only=True)
    lines = GoodsReceiptLineSerializer(many=True, read_only=True)
    receipt_lines = serializers.ListField(
        child=serializers.DictField(), write_only=True
    )

    class Meta:
        model = GoodsReceipt
        fields = [
            'id', 'receipt_number', 'purchase_order', 'purchase_order_number',
            'received_date', 'received_by', 'status', 'notes',
            'lines', 'receipt_lines', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'receipt_number', 'created_at', 'updated_at']

    def create(self, validated_data):
        receipt_lines_data = validated_data.pop('receipt_lines')
        user = self.context['request'].user
        company_id = user.company_id
        branch_id = user.branch_id

        validated_data['receipt_number'] = self._generate_receipt_number()
        validated_data['company_id'] = company_id
        validated_data['branch_id'] = branch_id
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        validated_data['received_by'] = user

        gr = GoodsReceipt.objects.create(**validated_data)

        for line_data in receipt_lines_data:
            GoodsReceiptLine.objects.create(
                goods_receipt=gr,
                purchase_order_line_id=line_data['purchase_order_line_id'],
                quantity_received=line_data['quantity_received'],
                unit_cost=line_data.get('unit_cost', 0),
                accepted=line_data.get('accepted', True),
                company_id=company_id,
                branch_id=branch_id,
                created_by=user,
                updated_by=user,
            )

        return gr

    def _generate_receipt_number(self):
        import time
        import random
        return f"GR-{int(time.time())}-{random.randint(1000, 9999)}"