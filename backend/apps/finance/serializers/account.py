from rest_framework import serializers
from apps.finance.models import Account

class AccountSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    class Meta:
        model = Account
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'company_id', 'branch_id', 'created_by', 'updated_by')