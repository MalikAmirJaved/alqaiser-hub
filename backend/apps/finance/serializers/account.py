from rest_framework import serializers
from apps.finance.models import Account

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = '__all__'
        read_only_fields = ('id', '_id', 'created_at', 'updated_at', 'company_id', 'branch_id', 'created_by', 'updated_by')