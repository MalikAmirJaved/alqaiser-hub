# apps/finance/serializers/bank.py
from rest_framework import serializers
from apps.finance.models import BankAccount, BankTransaction

class BankAccountSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    pending_balance = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model = BankAccount
        fields = [
            'id', 'account_name', 'account_number', 'bank_name',
            'opening_balance', 'book_balance', 'cleared_balance', 'pending_balance',
            'currency', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ('id', 'created_at', 'updated_at', 'company_id', 'branch_id', 'pending_balance')


class BankTransactionSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    bank_account = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=BankAccount.objects.all()
    )

    class Meta:
        model = BankTransaction
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'company_id', 'branch_id')