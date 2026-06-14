import uuid
from django.db import models
from django.conf import settings


class BaseModel(models.Model):
    """Abstract base model with common fields."""

    id = models.BigAutoField(primary_key=True)

    _id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False
    )

    company_id = models.IntegerField(
        db_index=True,
        null=True,
        blank=True
    )

    branch_id = models.IntegerField(
        db_index=True,
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # AUTO USER RELATION
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_created",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_updated",
    )

    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_deleted"
    )

    is_deleted = models.BooleanField(default=False)

    class Meta:
        abstract = True
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
        ]