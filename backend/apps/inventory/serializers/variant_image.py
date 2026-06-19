# apps/inventory/serializers/variant_image.py
import ast
from rest_framework import serializers
from apps.inventory.models import VariantImage

class VariantImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = VariantImage
        fields = ['id', 'image_url', 'image_url_thumb', 'sort_order', 'is_primary']

    @staticmethod
    def _fix_dict_string(val):
        if isinstance(val, str) and val.startswith('{'):
            try:
                parsed = ast.literal_eval(val)
                if isinstance(parsed, dict):
                    return parsed.get('url', val)
            except Exception:
                pass
        return val

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['image_url'] = self._fix_dict_string(data['image_url'])
        if data.get('image_url_thumb'):
            data['image_url_thumb'] = self._fix_dict_string(data['image_url_thumb'])
        return data
