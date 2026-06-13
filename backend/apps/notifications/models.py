from django.db import models
from django.conf import settings

class Notification(models.Model):
    company_id = models.IntegerField(null=True, blank=True, db_index=True)
    branch_id = models.IntegerField(null=True, blank=True, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    notification_type = models.CharField(max_length=50, default="info")
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.user}"
