from rest_framework import serializers
from apps.finance.models import Expense

class ExpenseSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    
    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'company_id', 'branch_id', 'journal_entry')