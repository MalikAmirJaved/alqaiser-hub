from rest_framework import serializers
from .models import Designation

class DesignationSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    isActive = serializers.BooleanField(source='is_active')
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = Designation
        fields = ['id', 'name', 'department', 'description', 'isActive', 'createdAt', 'updatedAt']