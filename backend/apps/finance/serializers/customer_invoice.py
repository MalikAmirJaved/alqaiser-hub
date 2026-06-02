from rest_framework import serializers
from apps.finance.models import CustomerInvoice

class CustomerInvoiceSerializer(serializers.ModelSerializer):
    outstanding = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model = CustomerInvoice
        fields = '__all__'
        read_only_fields = ('id', '_id', 'created_at', 'updated_at', 'company_id', 'branch_id', 'paid_amount', 'status', 'journal_entry')