# apps/notifications/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import models
from django.shortcuts import get_object_or_404
from django.utils import timezone
from apps.common.baseauthentication import CompanyBranchMixin
from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    """Notification ViewSet with UUID support"""
    
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = '_id'
    lookup_value_regex = '[0-9a-f-]+'
    
    # Disable branch filtering for notifications (they should show from both branch and company)
    branch_filter_enabled = False
    
    def get_queryset(self):
        """Get notifications for current user or company/branch"""
        user = self.request.user
        
        queryset = Notification.objects.filter(
            models.Q(user=user) | 
            models.Q(company_id=user.company_id, branch_id=user.branch_id, user__isnull=True)
        ).filter(is_deleted=False)
        
        # Filter by read status
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            queryset = queryset.filter(is_read=is_read.lower() == 'true')
        
        # Filter by favourite
        is_favourite = self.request.query_params.get('is_favourite')
        if is_favourite is not None:
            queryset = queryset.filter(is_favourite=is_favourite.lower() == 'true')
        
        # Filter by type
        notification_type = self.request.query_params.get('type')
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)
        
        return queryset.order_by('-created_at')
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a single notification as read"""
        notification = self.get_object()
        notification.mark_as_read()
        
        return Response({
            'status': 'success',
            'message': 'Notification marked as read',
            'data': NotificationSerializer(notification).data
        })
    
    @action(detail=True, methods=['post'])
    def mark_unread(self, request, pk=None):
        """Mark a single notification as unread"""
        notification = self.get_object()
        notification.mark_as_unread()
        
        return Response({
            'status': 'success',
            'message': 'Notification marked as unread',
            'data': NotificationSerializer(notification).data
        })
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read for the current user/company"""
        queryset = self.get_queryset().filter(is_read=False)
        
        count = 0
        for notification in queryset:
            notification.mark_as_read()
            count += 1
        
        return Response({
            'status': 'success',
            'message': f'{count} notification(s) marked as read',
            'marked_count': count
        })
    
    @action(detail=False, methods=['post'])
    def mark_all_unread(self, request):
        """Mark all notifications as unread for the current user/company"""
        queryset = self.get_queryset().filter(is_read=True)
        
        count = 0
        for notification in queryset:
            notification.mark_as_unread()
            count += 1
        
        return Response({
            'status': 'success',
            'message': f'{count} notification(s) marked as unread',
            'marked_count': count
        })
    
    @action(detail=True, methods=['post'])
    def toggle_favourite(self, request, pk=None):
        """Toggle favourite status of a notification"""
        notification = self.get_object()
        notification.toggle_favourite()
        
        return Response({
            'status': 'success',
            'message': 'Favourite status updated',
            'is_favourite': notification.is_favourite,
            'data': NotificationSerializer(notification).data
        })
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get notification statistics"""
        queryset = self.get_queryset()
        
        total = queryset.count()
        unread = queryset.filter(is_read=False).count()
        read = queryset.filter(is_read=True).count()
        favourites = queryset.filter(is_favourite=True).count()
        
        # Get counts by type
        by_type = queryset.values('notification_type').annotate(
            count=models.Count('id')
        ).order_by('-count')
        
        # Get last 7 days activity
        last_7_days = timezone.now() - timezone.timedelta(days=7)
        daily_activity = queryset.filter(
            created_at__gte=last_7_days
        ).extra(
            {'day': "DATE(created_at)"}
        ).values('day').annotate(
            count=models.Count('id')
        ).order_by('-day')
        
        return Response({
            'total': total,
            'unread': unread,
            'read': read,
            'favourites': favourites,
            'by_type': list(by_type),
            'daily_activity': list(daily_activity)
        })
    
    @action(detail=False, methods=['delete'])
    def clear_all(self, request):
        """Delete all read notifications"""
        queryset = self.get_queryset().filter(is_read=True)
        
        # Soft delete
        count = queryset.update(
            is_deleted=True,
            deleted_at=timezone.now(),
            deleted_by=request.user
        )
        
        return Response({
            'status': 'success',
            'message': f'{count} notification(s) cleared',
            'cleared_count': count
        })
    
    @action(detail=False, methods=['delete'])
    def delete_all_read(self, request):
        """Delete all read notifications (alias for clear_all)"""
        return self.clear_all(request)
    
    @action(detail=True, methods=['delete'])
    def delete_notification(self, request, pk=None):
        """Soft delete a single notification"""
        notification = self.get_object()
        notification.is_deleted = True
        notification.deleted_at = timezone.now()
        notification.deleted_by = request.user
        notification.save()
        
        return Response({
            'status': 'success',
            'message': 'Notification deleted successfully'
        })