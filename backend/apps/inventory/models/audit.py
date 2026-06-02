from django.db import models
from apps.common.basemodel import BaseModel


class AuditLog(BaseModel):
    """
    Header of an audit event (one per user action).
    Stores metadata about who, when, what, and where.
    """
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('BULK_CREATE', 'Bulk Create'),
        ('BULK_UPDATE', 'Bulk Update'),
        ('BULK_DELETE', 'Bulk Delete'),
    ]

    # Who performed the action
    user_id = models.IntegerField(null=True, db_index=True, help_text="User ID who performed the action")
    
    # What action was performed
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, db_index=True)
    
    # Which entity was affected
    entity_type = models.CharField(max_length=50, db_index=True, help_text="Model name (e.g., 'product', 'variant')")
    entity_id = models.UUIDField(db_index=True, help_text="UUID of the affected row")
    
    # Context information
    source_module = models.CharField(max_length=30, default='inventory', help_text="Module that generated the audit")
    reference_id = models.UUIDField(null=True, db_index=True, help_text="Reference ID (e.g., transaction_id, order_number)")
    
    # Request metadata
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'inventory_audit_logs'
        ordering = ['-created_at']
        indexes = [
            # For filtering by entity
            models.Index(fields=['entity_type', 'entity_id', '-created_at'], name='idx_audit_entity'),
            # For multi-tenant queries
            models.Index(fields=['company_id', 'branch_id', '-created_at'], name='idx_audit_tenant'),
            # For user activity queries
            models.Index(fields=['user_id', 'action', '-created_at'], name='idx_audit_user_action'),
            # For time-based cleanup
            models.Index(fields=['created_at'], name='idx_audit_created_at'),
        ]

    def __str__(self):
        return f"{self.action} on {self.entity_type} {self.entity_id} by user {self.user_id} at {self.created_at}"


class AuditFieldChange(BaseModel):
    """
    One row per field that changed in an audit event.
    This is the fully normalized approach - no JSON, pure relational.
    
    For CREATE: old_value = null, new_value = initial value
    For UPDATE: old_value = previous value, new_value = new value
    For DELETE: old_value = final value, new_value = null
    """
    audit_log = models.ForeignKey(
        AuditLog,
        on_delete=models.CASCADE,
        related_name='field_changes',
        db_index=True
    )
    field_name = models.CharField(max_length=100, db_index=True, help_text="Name of the field that changed")
    old_value = models.TextField(null=True, blank=True, help_text="Previous value (as string)")
    new_value = models.TextField(null=True, blank=True, help_text="New value (as string)")

    class Meta:
        db_table = 'inventory_audit_field_changes'
        indexes = [
            # For querying changes to specific fields
            models.Index(fields=['field_name'], name='idx_audit_field_name'),
            # For joining with audit log
            models.Index(fields=['audit_log', 'field_name'], name='idx_audit_log_field'),
        ]

    def __str__(self):
        if self.old_value is None and self.new_value is not None:
            return f"CREATE {self.field_name} = {self.new_value}"
        elif self.old_value is not None and self.new_value is None:
            return f"DELETE {self.field_name} = {self.old_value}"
        else:
            return f"UPDATE {self.field_name}: {self.old_value} → {self.new_value}"