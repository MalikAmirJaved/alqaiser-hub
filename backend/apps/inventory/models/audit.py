from django.db import models
from apps.common.basemodel import BaseModel

class AuditLog(BaseModel):
    user_id = models.IntegerField(null=True)
    action = models.CharField(max_length=20)
    entity_type = models.CharField(max_length=50)
    entity_id = models.UUIDField()
    before_state = models.JSONField(null=True)
    after_state = models.JSONField(null=True)
    source_module = models.CharField(max_length=30)
    reference_id = models.UUIDField(null=True)
    ip_address = models.GenericIPAddressField(null=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        db_table = 'inventory_audit_logs'
        indexes = [
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['-created_at']),
        ]