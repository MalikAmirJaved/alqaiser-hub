from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'is_read', 'read_at', 'is_favourite', 'created_at', 'notification_type']
        read_only_fields = ['id', 'created_at']
