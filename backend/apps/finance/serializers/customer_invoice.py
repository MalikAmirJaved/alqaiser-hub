from rest_framework import serializers
from apps.finance.models import CustomerInvoice
from apps.inventory.models import Customer, SalesOrder

class CustomerInvoiceSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    outstanding = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    
    customer = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=Customer.objects.all()
    )
    sales_order = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=SalesOrder.objects.all(),
        allow_null=True,
        required=False
    )
    
    class Meta:
        model = CustomerInvoice
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'company_id', 'branch_id', 'paid_amount', 'status', 'journal_entry')