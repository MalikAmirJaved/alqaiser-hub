from rest_framework import serializers
from apps.sales.models.lead import Lead

class LeadSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)

    class Meta:
        model = Lead
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'company_id', 'branch_id')
