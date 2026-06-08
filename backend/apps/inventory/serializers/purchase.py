# ============================================================
# File: backend/apps/inventory/serializers/purchase.py
# ============================================================
from rest_framework import serializers
from decimal import Decimal
from django.db.models import Sum, Value, DecimalField
from django.db.models.functions import Coalesce
from apps.inventory.models import (
    PurchaseOrder, PurchaseOrderLine, GoodsReceipt, GoodsReceiptLine,
    ProductVariant, Warehouse, Supplier
)
from apps.common.serializer_fields import UUIDForeignRelatedField
from django.contrib.contenttypes.models import ContentType
from apps.finance.models import Payment, SupplierBill


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    # Replace the default PrimaryKeyRelatedField with our UUID field
    variant = UUIDForeignRelatedField(queryset=ProductVariant.objects.all())
    id = serializers.UUIDField(source='_id', read_only=True)
    # Read-only fields for product info
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_name = serializers.CharField(source='variant.product.product_name', read_only=True)
    line_total = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    quantity_pending = serializers.SerializerMethodField()

    # Creator/updater info
    created_by_info = serializers.SerializerMethodField()
    updated_by_info = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrderLine
        fields = [
            'id',                       # UUID exposed for frontend
            'variant', 'variant_sku', 'variant_name',
            'quantity_ordered', 'quantity_received', 'quantity_pending',
            'unit_cost', 'tax_rate', 'line_total', 'status', 'notes',
            'created_at', 'updated_at',
            'created_by_info', 'updated_by_info',
        ]
        read_only_fields = ['quantity_received', 'created_at', 'updated_at']

    def get_quantity_pending(self, obj):
        return obj.quantity_ordered - obj.quantity_received

    def get_created_by_info(self, obj):
        if obj.created_by:
            return {'id': obj.created_by._id, 'username': obj.created_by.username}
        return None

    def get_updated_by_info(self, obj):
        if obj.updated_by:
            return {'id': obj.updated_by._id, 'username': obj.updated_by.username}
        return None


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier = UUIDForeignRelatedField(queryset=Supplier.objects.all())
    warehouse = UUIDForeignRelatedField(queryset=Warehouse.objects.all())

    # Read-only nested fields for display
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    lines = PurchaseOrderLineSerializer(many=True, read_only=True)

    # Write-only line items (as before, but each line's 'variant' will be a UUID)
    line_items = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )

    # Creator/updater info
    created_by_info = serializers.SerializerMethodField()
    updated_by_info = serializers.SerializerMethodField()

    # New computed fields
    payment_status = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            '_id', 'order_number', 'supplier', 'supplier_name',
            'warehouse', 'warehouse_name', 'status',
            'order_date', 'expected_delivery_date', 'total_amount',
            'notes', 'lines', 'line_items',
            'created_at', 'updated_at', 'created_by_info', 'updated_by_info',
            'payment_status', 'total_paid', 'inventory_type',
        ]
        read_only_fields = ['order_number', 'created_at', 'updated_at']

    def get_total_paid(self, obj):
        """Calculate total confirmed payments against this purchase order via supplier bills."""
        bill_ids = SupplierBill.objects.filter(purchase_order=obj).values_list('pk', flat=True)
        if not bill_ids:
            return Decimal('0.00')
        ct = ContentType.objects.get_for_model(SupplierBill)
        total = Payment.objects.filter(
            content_type=ct,
            object_id__in=bill_ids,
            status='CONFIRMED',
        ).aggregate(
            total=Coalesce(Sum('amount'), Value(0, output_field=DecimalField()))
        )['total']
        return total if total is not None else Decimal('0.00')

    def get_payment_status(self, obj):
        """Determine payment status based on total paid vs total amount"""
        total_paid = self.get_total_paid(obj)
        if total_paid >= obj.total_amount:
            return 'PAID'
        elif total_paid > 0:
            return 'PARTIAL'
        return 'UNPAID'

    def get_created_by_info(self, obj):
        if obj.created_by:
            return {'id': obj.created_by._id, 'username': obj.created_by.username}
        return None

    def get_updated_by_info(self, obj):
        if obj.updated_by:
            return {'id': obj.updated_by._id, 'username': obj.updated_by.username}
        return None

    def create(self, validated_data):
        # No changes needed here – the UUIDForeignRelatedField already converted
        # `supplier` and `warehouse` to model instances (with integer PK).
        line_items_data = validated_data.pop('line_items', [])
        user = self.context['request'].user
        company_id = user.company_id
        branch_id = user.branch_id
        
        validated_data['order_number'] = self._generate_order_number()
        validated_data['company_id'] = company_id
        validated_data['branch_id'] = branch_id
        validated_data['created_by'] = user
        validated_data['updated_by'] = user

        po = PurchaseOrder.objects.create(**validated_data)

        total_amount = 0
        for line_data in line_items_data:
            # line_data['variant'] is now a UUID string; we need to convert to variant instance.
            # But the frontend will send the UUID. We can use the same UUIDForeignRelatedField
            # to resolve it. Since we are inside the serializer, we can manually resolve.
            variant_uuid = line_data.get('variant')
            variant = ProductVariant.objects.get(_id=variant_uuid, company_id=company_id)
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
    id = serializers.UUIDField(source='_id', read_only=True)
    
    class Meta:
        model = GoodsReceiptLine
        fields = [
            'id', 'purchase_order_line', 'quantity_received',
            'unit_cost', 'accepted', 'variant_name'
        ]


class GoodsReceiptSerializer(serializers.ModelSerializer):
    purchase_order = UUIDForeignRelatedField(
        queryset=PurchaseOrder.objects.all(),
        help_text="UUID of the purchase order"
    )
    purchase_order_number = serializers.CharField(source='purchase_order.order_number', read_only=True)
    lines = GoodsReceiptLineSerializer(many=True, read_only=True)
    receipt_lines = serializers.ListField(
        child=serializers.DictField(), write_only=True
    )
    id = serializers.UUIDField(source='_id', read_only=True)

    class Meta:
        model = GoodsReceipt
        fields = [
            'id', 'receipt_number', 'purchase_order', 'purchase_order_number',
            'received_date', 'received_by', 'status', 'notes',
            'lines', 'receipt_lines', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'receipt_number', 'created_at', 'updated_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Dynamically filter purchase_order queryset to the current company
        request = self.context.get('request')
        if request and hasattr(request.user, 'company_id'):
            self.fields['purchase_order'].queryset = PurchaseOrder.objects.filter(
                company_id=request.user.company_id
            )

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
            po_line_uuid = line_data['purchase_order_line_id']   # frontend sends UUID
            po_line = PurchaseOrderLine.objects.get(_id=po_line_uuid, company_id=company_id)
            GoodsReceiptLine.objects.create(
                goods_receipt=gr,
                purchase_order_line=po_line,    # now an instance, not an ID
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