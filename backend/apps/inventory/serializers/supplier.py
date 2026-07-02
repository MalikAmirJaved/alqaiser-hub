from rest_framework import serializers
from apps.inventory.models import Supplier, SupplierHistory

class SupplierSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    
    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'code', 'contact_person', 'email', 'phone',
            'address_line', 'country', 'state', 'city', 'postal_code',
            'partner_type', 'status', 'balance', 'credit',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'balance', 'credit']


class SupplierHistorySerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_code = serializers.CharField(source='supplier.code', read_only=True)

    class Meta:
        model = SupplierHistory
        fields = [
            'id', 'supplier', 'supplier_name', 'supplier_code',
            'transaction_type', 'amount', 'balance_after', 'credit_after',
            'reference_type', 'reference_id', 'notes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']