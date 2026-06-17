from rest_framework import serializers
from apps.inventory.models import Supplier

class SupplierSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    
    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'code', 'contact_person', 'email', 'phone',
            'address_line', 'country', 'state', 'city', 'postal_code',
            'partner_type', 'status', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']