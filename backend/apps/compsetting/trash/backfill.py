"""Trash data remediation.

``backfill_deleted_at`` reconciles rows that are flagged ``is_deleted=True`` but
have no ``deleted_at``.

Why those rows exist
--------------------
``deleted_at`` was added to ``BaseModel`` after the fact. Any row that was
already flagged deleted before that migration — imported as deleted, written by
a seed command, or soft-deleted through ``queryset.update()`` — kept
``deleted_at = NULL``.

Why it matters
--------------
``NULL`` means "never actually deleted by a user" as far as the Trash module is
concerned: the row is hidden from the trash *and* invisible to the retention
purge, so it is stuck in a permanent limbo where it keeps blocking unique
constraints (a soft-deleted SKU still reserves its value) but cannot be reviewed
or cleaned up.

What this does
--------------
Stamps ``deleted_at = updated_at`` — the row's real last-modified instant, which
for a row stored as deleted is its creation/deletion moment. ``deleted_by`` is
deliberately left untouched: no user performed these deletions, so inventing one
would be a lie. The API renders a missing deleter as "Unknown (legacy)".
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def backfill_deleted_at(app_label: str | None = None, *, dry_run: bool = False) -> dict:
    """Set ``deleted_at = updated_at`` for every ``is_deleted`` row missing it.

    Args:
        app_label: limit the sweep to one Django app (used by the per-app data
            migrations); ``None`` sweeps every registered model.
        dry_run: report what would change without writing.

    Returns:
        ``{'updated': {model_label: rows}, 'total': int}``
    """
    from django.apps import apps
    from django.db.models import F

    updated: dict[str, int] = {}
    total = 0

    for model in apps.get_models():
        if model._meta.abstract:
            continue
        if app_label and model._meta.app_label != app_label:
            continue

        field_names = {f.name for f in model._meta.get_fields()}
        if not {'is_deleted', 'deleted_at', 'updated_at'} <= field_names:
            continue

        try:
            stale = model._default_manager.filter(
                is_deleted=True, deleted_at__isnull=True,
            )
            count = stale.count()
            if not count:
                continue
            if not dry_run:
                # F() keeps this a single UPDATE ... SET deleted_at = updated_at
                stale.update(deleted_at=F('updated_at'))
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning('Trash backfill skipped %s: %s', model._meta.label, exc)
            continue

        updated[model._meta.label] = count
        total += count

    if total:
        logger.info(
            'Trash backfill%s: stamped deleted_at on %s row(s) across %s model(s)',
            ' (dry run)' if dry_run else '',
            total,
            len(updated),
        )

    return {'updated': updated, 'total': total}
