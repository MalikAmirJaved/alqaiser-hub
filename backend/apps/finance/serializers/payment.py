from rest_framework import serializers
from apps.finance.models import Payment, SupplierBill, CustomerInvoice, BankAccount

class PaymentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    
    supplier_bill = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=SupplierBill.objects.all(),
        allow_null=True,
        required=False
    )
    customer_invoice = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=CustomerInvoice.objects.all(),
        allow_null=True,
        required=False
    )
    bank_account = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=BankAccount.objects.all(),
        allow_null=True,
        required=False
    )
    
    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'company_id', 'branch_id', 'journal_entry')