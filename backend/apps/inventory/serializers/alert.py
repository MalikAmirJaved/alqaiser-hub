from rest_framework import serializers
from apps.inventory.models import Alert

class AlertSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)

    class Meta:
        model = Alert
        fields = ['id', 'type', 'type_display', 'severity', 'severity_display',
                  'title', 'message', 'entity_type', 'entity_id', 'is_read',
                  'created_at', 'updated_at']