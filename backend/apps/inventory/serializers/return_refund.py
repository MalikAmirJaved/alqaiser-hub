from rest_framework import serializers
from apps.inventory.models.return_refund import ReturnRefund, ReturnRefundLine


class ReturnRefundLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnRefundLine
        fields = [
            'id', '_id', 'return_refund',
            'source_line_id',
            'variant', 'is_manual_entry',
            'manual_variant_name', 'manual_variant_sku',
            'vendor',
            'quantity', 'unit_price', 'refund_amount', 'tax_rate',
            'restock', 'return_to_supplier',
            'disposition_action', 'product_qty', 'damage_qty', 'damage_reason',
            'reason',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', '_id', 'created_at', 'updated_at', 'return_refund']


class ReturnRefundListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list view."""
    customer_name = serializers.CharField(source='customer.name', read_only=True, allow_null=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    return_type_display = serializers.CharField(source='get_return_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    lines_count = serializers.SerializerMethodField()

    class Meta:
        model = ReturnRefund
        fields = [
            'id', '_id', 'return_number', 'return_type', 'return_type_display',
            'document_id', 'document_number',
            'customer', 'customer_name',
            'warehouse', 'warehouse_name',
            'return_date', 'status', 'status_display',
            'total_refund_amount', 'reason',
            'lines_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', '_id', 'created_at', 'updated_at']

    def get_lines_count(self, obj):
        return obj.lines.count()


class ReturnRefundDetailSerializer(serializers.ModelSerializer):
    """Full detail serializer with nested lines."""
    lines = ReturnRefundLineSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True, allow_null=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    return_type_display = serializers.CharField(source='get_return_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ReturnRefund
        fields = [
            'id', '_id', 'return_number', 'return_type', 'return_type_display',
            'document_id', 'document_number',
            'customer', 'customer_name',
            'warehouse', 'warehouse_name',
            'return_date', 'status', 'status_display',
            'total_refund_amount', 'reason',
            'refund_payment_id',
            'completed_at', 'completed_by',
            'lines',
            'created_at', 'updated_at',
            'company_id', 'branch_id',
        ]
        read_only_fields = [
            'id', '_id', 'created_at', 'updated_at',
            'return_number', 'refund_payment_id',
            'completed_at', 'completed_by',
            'company_id', 'branch_id',
        ]


class CreateReturnRefundSerializer(serializers.Serializer):
    """
    Serializer for creating a return by looking up a document first,
    then specifying lines to return.
    """
    return_type = serializers.ChoiceField(choices=['INVOICE', 'POS'])
    document_id = serializers.UUIDField(
        help_text="UUID (_id) of the CustomerInvoice or SalesOrder"
    )
    warehouse_id = serializers.UUIDField(
        help_text="UUID (_id) of the warehouse to receive returned goods"
    )
    return_date = serializers.DateTimeField(required=False)
    reason = serializers.CharField(required=False, allow_blank=True)
    lines = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of { source_line_id, quantity, unit_price, refund_amount, restock, return_to_supplier, reason }"
    )


class LookupDocumentSerializer(serializers.Serializer):
    """
    Look up a document by its invoice/order number to get line details.
    """
    return_type = serializers.ChoiceField(choices=['INVOICE', 'POS'])
    document_number = serializers.CharField(
        help_text="Invoice number (e.g. INV-...) or order number (e.g. SO-...)"
    )
