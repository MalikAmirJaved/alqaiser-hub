import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class BaseModel(models.Model):
    """Abstract base model with common fields."""

    id = models.BigAutoField(primary_key=True)

    _id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False
    )

    company_id = models.IntegerField( # request.user.company_id
        db_index=True,
        null=True,
        blank=True
    )

    branch_id = models.IntegerField( # request.user.branch_id
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

    # When the row was soft-deleted. Drives the Trash module and the
    # automatic 30-day permanent purge (see apps.compsetting.trash).
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
        ]

    # ------------------------------------------------------------------
    # Soft-delete bookkeeping
    # ------------------------------------------------------------------
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Remember what was loaded so save() can detect a soft-delete flip
        # without paying for an extra SELECT on every write.
        self._loaded_is_deleted = self.is_deleted

    def save(self, *args, **kwargs):
        """Keep ``deleted_at`` in sync with ``is_deleted``.

        Existing delete paths only set ``is_deleted`` / ``deleted_by``; this
        stamps the timestamp they were missing. Bulk ``queryset.update()``
        calls bypass ``save()`` — the Trash services handle those.
        """
        touched_delete_state = False

        if self.is_deleted:
            if not self.deleted_at:
                self.deleted_at = timezone.now()
                touched_delete_state = True
        elif self.deleted_at or getattr(self, '_loaded_is_deleted', False):
            # Row was un-deleted (restore) — clear the trash bookkeeping.
            self.deleted_at = None
            self.deleted_by = None
            touched_delete_state = True

        self._loaded_is_deleted = self.is_deleted

        update_fields = kwargs.get('update_fields')
        if update_fields is not None and touched_delete_state:
            kwargs['update_fields'] = set(update_fields) | {'is_deleted', 'deleted_at', 'deleted_by'}

        super().save(*args, **kwargs)