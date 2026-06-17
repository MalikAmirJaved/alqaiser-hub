from django.db import models
from django.conf import settings
from apps.common.basemodel import BaseModel

class AuditLog(BaseModel):
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
    ]
    # Override BaseModel's audit fields with custom related names to avoid clashes
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_created_logs",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_updated_logs",
    )
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_deleted_logs",
    )

    # Original fields (unchanged)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES, db_index=True)
    model_name = models.CharField(max_length=100, db_index=True)
    record_id = models.UUIDField(db_index=True)
    module = models.CharField(max_length=50, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['model_name', 'record_id']),
            models.Index(fields=['module', '-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"{self.action} {self.model_name} {self.record_id} by {self.user} at {self.created_at}"


class AuditLogChange(BaseModel):
    audit_log = models.ForeignKey(AuditLog, on_delete=models.CASCADE, related_name='field_changes', db_index=True)
    field_name = models.CharField(max_length=100, db_index=True)
    old_value = models.TextField(null=True, blank=True)
    new_value = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'audit_log_changes'
        ordering = ['field_name']
        indexes = [
            models.Index(fields=['field_name']),
            models.Index(fields=['audit_log', 'field_name']),
        ]

    def __str__(self):
        if self.old_value is None and self.new_value is not None:
            return f"CREATE {self.field_name} = {self.new_value}"
        elif self.old_value is not None and self.new_value is None:
            return f"DELETE {self.field_name} = {self.old_value}"
        return f"UPDATE {self.field_name}: {self.old_value} \u2192 {self.new_value}"