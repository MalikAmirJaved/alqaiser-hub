from rest_framework import serializers
from apps.inventory.models import Category

class CategorySerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    
    class Meta:
        model = Category
        fields = [
            "id", "name", "code", "description",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]