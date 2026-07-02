from rest_framework import serializers
from apps.sales.models.status_history import SalesStatusHistory


class SalesStatusHistorySerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SalesStatusHistory
        fields = [
            'id', 'entity_type', 'entity_id',
            'from_status', 'to_status', 'notes',
            'changed_by', 'changed_by_name',
            'created_at',
        ]
        read_only_fields = fields

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.username
        return None
