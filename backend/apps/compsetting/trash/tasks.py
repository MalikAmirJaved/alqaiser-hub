"""Celery tasks for the Trash module.

Trash data is never purged automatically. Permanent deletion remains an
explicit user action through the Trash API.
"""
from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(name='compsetting.trash_retention_report')
def trash_retention_report():
    """Cheap observability task: how much is sitting in the trash right now."""
    from django.apps import apps as django_apps

    from .registry import TRASH_MODELS

    total = 0
    per_type: dict[str, int] = {}
    for tm in TRASH_MODELS:
        count = tm.model._default_manager.filter(
            is_deleted=True, deleted_at__isnull=False,
        ).count()
        if count:
            per_type[tm.key] = count
            total += count

    logger.info('Trash inventory: total=%s per_type=%s', total, per_type)
    return {
        'total': total,
        'per_type': per_type,
        'retention_days': getattr(settings, 'TRASH_RETENTION_DAYS', 30),
    }
