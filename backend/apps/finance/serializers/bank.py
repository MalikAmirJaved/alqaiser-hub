from rest_framework import serializers
from apps.finance.models import BankAccount, BankTransaction

class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = '__all__'
        read_only_fields = ('id', '_id', 'created_at', 'updated_at', 'company_id', 'branch_id')

class BankTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankTransaction
        fields = '__all__'
        read_only_fields = ('id', '_id', 'created_at', 'updated_at', 'company_id', 'branch_id')