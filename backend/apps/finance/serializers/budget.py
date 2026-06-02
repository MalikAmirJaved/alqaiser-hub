from rest_framework import serializers
from apps.finance.models import Budget, Account

class BudgetSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    account_code = serializers.CharField(source='account.code', read_only=True)
    
    # Make account accept UUID from frontend
    account = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=Account.objects.all()
    )

    class Meta:
        model = Budget
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'company_id', 'branch_id', 'created_by', 'updated_by')