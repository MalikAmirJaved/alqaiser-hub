from rest_framework import serializers
from apps.inventory.models.customer import Customer

class CustomerSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    class Meta:
        model = Customer
        fields = [
            'id', 'customer_code', 'name', 'contact_person', 'email', 'phone',
            'address_line', 'city', 'state', 'postal_code', 'country', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']