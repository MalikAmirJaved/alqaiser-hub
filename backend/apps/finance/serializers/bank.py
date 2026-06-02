from rest_framework import serializers
from apps.finance.models import BankAccount, BankTransaction

class BankAccountSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    class Meta:
        model = BankAccount
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'company_id', 'branch_id')

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