# apps/inventory/serializers/brand.py
from rest_framework import serializers
from apps.inventory.models import Brand

class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = [
            "id", "name", "code", "description", "country_of_origin",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]