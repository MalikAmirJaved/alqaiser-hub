from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import models
from .models import Notification
from .serializers import NotificationSerializer

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Notification.objects.filter(
            models.Q(user=user) | 
            models.Q(company_id=user.company_id, branch_id=user.branch_id, user__isnull=True)
        )
        return queryset.order_by('-created_at')

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.mark_as_read()
        return Response({'status': 'marked as read'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        queryset = self.get_queryset().filter(is_read=False)
        for notif in queryset:
            notif.mark_as_read()
        return Response({'status': 'all marked as read'})

    @action(detail=True, methods=['post'])
    def toggle_favourite(self, request, pk=None):
        notification = self.get_object()
        notification.is_favourite = not notification.is_favourite
        notification.save(update_fields=['is_favourite'])
        return Response({'status': 'toggled', 'is_favourite': notification.is_favourite})
