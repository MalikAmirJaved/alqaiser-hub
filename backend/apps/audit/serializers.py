from rest_framework import serializers
from .models import AuditLog, AuditLogChange

class AuditLogChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLogChange
        fields = ['id', 'field_name', 'old_value', 'new_value', 'created_at']

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    field_changes = AuditLogChangeSerializer(many=True, read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_name', 'user_email', 'action', 'action_display',
            'model_name', 'record_id', 'module', 'field_changes', 'ip_address', 'user_agent',
            'created_at', 'updated_at'
        ]