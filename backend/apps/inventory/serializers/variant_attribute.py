from rest_framework import serializers
from apps.inventory.models import VariantAttribute

class VariantAttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VariantAttribute
        fields = ['id', 'attribute_key', 'attribute_value']