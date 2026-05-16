# apps/notifications/models.py
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.common.basemodel import BaseModel


class Notification(BaseModel):
    """Notification model with UUID support and BaseModel integration"""
    
    # User to receive notification (individual)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='notifications'
    )
    
    # Notification content
    title = models.CharField(max_length=255)
    message = models.TextField()
    
    # Status flags
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    is_favourite = models.BooleanField(default=False)
    
    # Type for UI styling (info, success, warning, error)
    notification_type = models.CharField(max_length=50, default="info")
    
    # Timestamp (BaseModel already provides created_at, updated_at)
    # created_at is automatically provided by BaseModel
    
    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['is_read', '-created_at']),
            models.Index(fields=['notification_type']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.user or f'Company {self.company_id}'}"
    
    def mark_as_read(self):
        """Mark notification as read with timestamp"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at', 'updated_at'])
    
    def mark_as_unread(self):
        """Mark notification as unread"""
        if self.is_read:
            self.is_read = False
            self.read_at = None
            self.save(update_fields=['is_read', 'read_at', 'updated_at'])
    
    def toggle_favourite(self):
        """Toggle favourite status"""
        self.is_favourite = not self.is_favourite
        self.save(update_fields=['is_favourite', 'updated_at'])
    
    @property
    def is_expired(self):
        """Check if notification is older than 30 days"""
        if self.created_at:
            thirty_days_ago = timezone.now() - timezone.timedelta(days=30)
            return self.created_at < thirty_days_ago
        return False