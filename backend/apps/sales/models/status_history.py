from django.db import models
from django.conf import settings
from apps.common.basemodel import BaseModel


class SalesStatusHistory(BaseModel):
    ENTITY_TYPES = [
        ('LEAD', 'Lead'),
        ('QUOTE', 'Quote'),
    ]
    entity_type = models.CharField(max_length=10, choices=ENTITY_TYPES, db_index=True)
    entity_id = models.UUIDField(db_index=True)
    from_status = models.CharField(max_length=30, blank=True, default='')
    to_status = models.CharField(max_length=30)
    notes = models.TextField(blank=True, default='')
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_status_changes',
    )

    class Meta:
        db_table = 'sales_status_history'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['company_id', 'branch_id']),
        ]

    def __str__(self):
        return f"{self.entity_type} {self.entity_id}: {self.from_status} → {self.to_status}"
