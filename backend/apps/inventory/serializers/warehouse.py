# apps/inventory/serializers/warehouse.py
from rest_framework import serializers
from apps.inventory.models import Warehouse

class WarehouseSerializer(serializers.ModelSerializer):
    available_capacity = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    occupancy_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True
    )
    
    class Meta:
        model = Warehouse
        fields = [
            "id", "warehouse_name", "code", "manager_name", "phone",
            "capacity", "current_occupancy", "available_capacity", 
            "occupancy_percentage", "country", "state", "city", 
            "address_line", "postal_code", "email", "is_active", 
            "description", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at", "available_capacity", "occupancy_percentage"]