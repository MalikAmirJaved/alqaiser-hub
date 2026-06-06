from rest_framework import serializers
from apps.finance.models import SupplierBill
from apps.inventory.models import Supplier, PurchaseOrder

class SupplierBillSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    paid_amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    payment_status = serializers.CharField(read_only=True)
    outstanding = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    
    # Foreign keys accept UUID
    supplier = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=Supplier.objects.all()
    )
    purchase_order = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=PurchaseOrder.objects.all(),
        allow_null=True,
        required=False
    )
    
    class Meta:
        model = SupplierBill
        fields = '__all__'
        read_only_fields = (
            'id', 'created_at', 'updated_at', 'company_id', 'branch_id',
            'paid_amount', 'payment_status', 'outstanding', 'status', 'journal_entry',
        )