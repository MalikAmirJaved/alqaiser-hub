from rest_framework import serializers

from apps.finance.models import Expense
from apps.inventory.models import Supplier

class ExpenseSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    paid_amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    payment_status = serializers.CharField(read_only=True)
    outstanding = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    paid = serializers.BooleanField(read_only=True)
    supplier_bill_id = serializers.UUIDField(source='supplier_bill._id', read_only=True, allow_null=True)
    supplier_bill_number = serializers.CharField(source='supplier_bill.bill_number', read_only=True, allow_null=True)
    supplier = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=Supplier.objects.all(),
        allow_null=True,
        required=False
    )

    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = (
            'id', 'created_at', 'updated_at', 'company_id', 'branch_id',
            'paid_amount', 'payment_status', 'outstanding', 'paid',
            'supplier_bill_id', 'supplier_bill_number',
        )
        extra_kwargs = {
            'supplier_bill': {'read_only': True},  # managed by backend
        }
