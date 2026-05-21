from rest_framework import serializers
from apps.inventory.models import AuditLog, AuditFieldChange
from apps.organization.models import User  # adjust import to your User model

class AuditFieldChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditFieldChange
        fields = ['id', 'field_name', 'old_value', 'new_value', 'created_at']


class AuditLogSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    field_changes = AuditFieldChangeSerializer(many=True, read_only=True)
    
    # User info from user_id (manual lookup)
    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()
    
    # Human-readable action
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'user_id', 'user_name', 'user_email', 'action', 'action_display',
            'entity_type', 'entity_id', 'source_module', 'reference_id',
            'ip_address', 'user_agent', 'company_id', 'branch_id',
            'field_changes', 'created_at', 'updated_at'
        ]
    
    def get_user_name(self, obj):
        if obj.user_id:
            try:
                return User.objects.get(id=obj.user_id).get_full_name() or User.objects.get(id=obj.user_id).username
            except User.DoesNotExist:
                return None
        return None
    
    def get_user_email(self, obj):
        if obj.user_id:
            try:
                return User.objects.get(id=obj.user_id).email
            except User.DoesNotExist:
                return None
        return None