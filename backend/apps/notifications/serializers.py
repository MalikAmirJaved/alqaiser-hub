# apps/notifications/serializers.py
from rest_framework import serializers
from .models import Notification
from django.utils import timezone


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification with UUID support"""
    
    id = serializers.UUIDField(source='_id', read_only=True)
    user_id = serializers.UUIDField(source='user._id', read_only=True, allow_null=True)
    user_name = serializers.SerializerMethodField()
    time_ago = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id', 'user_id', 'user_name', 'title', 'message', 
            'is_read', 'read_at', 'is_favourite', 'notification_type',
            'created_at', 'updated_at', 'time_ago'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user_name', 'time_ago']
    
    def get_user_name(self, obj):
        """Get user's full name or username"""
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return None
    
    def get_time_ago(self, obj):
        """Calculate time ago string for display"""
        if not obj.created_at:
            return None
        
        now = timezone.now()
        diff = now - obj.created_at
        
        if diff.days > 365:
            years = diff.days // 365
            return f"{years} year{'s' if years > 1 else ''} ago"
        elif diff.days > 30:
            months = diff.days // 30
            return f"{months} month{'s' if months > 1 else ''} ago"
        elif diff.days > 0:
            return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
        elif diff.seconds > 3600:
            hours = diff.seconds // 3600
            return f"{hours} hour{'s' if hours > 1 else ''} ago"
        elif diff.seconds > 60:
            minutes = diff.seconds // 60
            return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
        else:
            return "Just now"