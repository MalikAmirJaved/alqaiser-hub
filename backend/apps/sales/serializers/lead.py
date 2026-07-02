from rest_framework import serializers
from apps.sales.models.lead import Lead


class LeadSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    converted_customer_id = serializers.UUIDField(source='converted_customer._id', read_only=True, allow_null=True)

    class Meta:
        model = Lead
        fields = [
            'id', 'title', 'first_name', 'last_name', 'company_name',
            'email', 'phone', 'source', 'status', 'priority', 'notes',
            'address_line', 'country', 'state', 'city', 'score',
            'follow_up_date', 'follow_up_notes', 'lost_reason',
            'converted_customer_id',
            'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'created_at', 'updated_at', 'company_id', 'branch_id', 'converted_customer_id')

    def validate_score(self, value):
        if value is not None and (value < 1 or value > 100):
            raise serializers.ValidationError("Score must be between 1 and 100.")
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['company_id'] = user.company_id
        validated_data['branch_id'] = user.branch_id
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        if not validated_data.get('title'):
            first_name = validated_data.get('first_name', '')
            last_name = validated_data.get('last_name', '')
            validated_data['title'] = f"Lead for {first_name} {last_name}".strip()
        return super().create(validated_data)
