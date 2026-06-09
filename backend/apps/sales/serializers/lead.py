from rest_framework import serializers
from apps.sales.models.lead import Lead
from apps.inventory.models.customer import Customer
from apps.inventory.serializers.customer import CustomerSerializer

class LeadSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    customer = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=Customer.objects.all(),
        required=False,
        allow_null=True
    )
    new_customer = CustomerSerializer(required=False, write_only=True)

    class Meta:
        model = Lead
        fields = [
            'id', 'title', 'first_name', 'last_name', 'company_name',
            'email', 'phone', 'source', 'status', 'notes',
            'customer', 'new_customer', 'created_at', 'updated_at'
        ]
        read_only_fields = ('id', 'created_at', 'updated_at', 'company_id', 'branch_id')

    def create(self, validated_data):
        new_customer_data = validated_data.pop('new_customer', None)
        user = self.context['request'].user
        
        if new_customer_data:
            new_customer_data['company_id'] = user.company_id
            new_customer_data['branch_id'] = user.branch_id
            new_customer_data['created_by'] = user
            new_customer_data['updated_by'] = user
            customer = Customer.objects.create(**new_customer_data)
            validated_data['customer'] = customer

        validated_data['company_id'] = user.company_id
        validated_data['branch_id'] = user.branch_id
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        
        # Robustness: ensure title if missing
        if not validated_data.get('title'):
            first_name = validated_data.get('first_name', '')
            last_name = validated_data.get('last_name', '')
            validated_data['title'] = f"Lead for {first_name} {last_name}".strip()

        return super().create(validated_data)
