from rest_framework import serializers
from apps.hr.models import Asset
from datetime import date

class AssetSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    warranty_status = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Asset
        fields = [
            'id', 'name', 'brand', 'model', 'serial_number', 'description',
            'category', 'total_quantity', 'available_quantity',
            'purchase_date', 'purchase_price', 'warranty_until', 'vendor',
            'is_active', 'is_assigned', 'warranty_status',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'warranty_status', 'is_assigned']

    def create(self, validated_data):
        # If purchase_date not provided, set to None (not today)
        if 'purchase_date' not in validated_data:
            validated_data['purchase_date'] = None
        if 'purchase_price' not in validated_data:
            validated_data['purchase_price'] = None
        if 'warranty_until' not in validated_data:
            validated_data['warranty_until'] = None
        # Ensure available_quantity matches total_quantity on create
        validated_data['available_quantity'] = validated_data.get('total_quantity', 1)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # If total_quantity changes, adjust available_quantity accordingly
        if 'total_quantity' in validated_data and 'available_quantity' not in validated_data:
            # Only adjust if not explicitly set
            delta = validated_data['total_quantity'] - instance.total_quantity
            validated_data['available_quantity'] = instance.available_quantity + delta
        return super().update(instance, validated_data)