from rest_framework import serializers

from apps.finance.models import Payment, BankAccount
from apps.finance.services.payable import get_payable_label


class PaymentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    payable_type = serializers.SerializerMethodField()
    payable_id = serializers.SerializerMethodField()
    payable_label = serializers.SerializerMethodField()

    bank_account = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=BankAccount.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = Payment
        fields = [
            'id', '_id', 'payment_type', 'payment_method', 'amount', 'payment_date',
            'reference_number', 'payable_type', 'payable_id', 'payable_label',
            'bank_account', 'status', 'journal_entry', 'notes',
            'company_id', 'branch_id', 'created_at', 'updated_at',
        ]
        read_only_fields = (
            'id', 'created_at', 'updated_at', 'company_id', 'branch_id',
            'journal_entry', 'payable_type', 'payable_id', 'payable_label',
        )

    def get_payable_type(self, obj):
        if obj.payable is None:
            return None
        return get_payable_label(obj.payable)

    def get_payable_id(self, obj):
        if obj.payable is None:
            return None
        return str(obj.payable._id)

    def get_payable_label(self, obj):
        payable = obj.payable
        if payable is None:
            return None
        model_name = payable._meta.model_name
        if model_name == 'customerinvoice':
            return getattr(payable, 'invoice_number', None)
        if model_name == 'supplierbill':
            return getattr(payable, 'bill_number', None)
        if model_name == 'expense':
            return getattr(payable, 'expense_number', None)
        if model_name == 'payrollrecord' and payable.employee:
            return f'{payable.employee.full_name} {payable.year}-{payable.month:02d}'
        return str(payable._id)
