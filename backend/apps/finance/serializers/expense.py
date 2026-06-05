from rest_framework import serializers
from apps.finance.models import Expense, BankAccount

class ExpenseSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    bank_account = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=BankAccount.objects.all(),
        allow_null=True,
        required=False
    )
    
    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'company_id', 'branch_id', 'journal_entry')