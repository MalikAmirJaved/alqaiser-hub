"""Celery tasks for the Trash module.

``purge_expired_trash`` is scheduled daily from ``config/celery.py`` and is the
only thing that permanently deletes business data without a human clicking a
button — everything here is therefore logged and defensive.
"""
from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings

from .services import purge_expired, retention_days

logger = logging.getLogger(__name__)


@shared_task(name='compsetting.purge_expired_trash', bind=True, max_retries=2)
def purge_expired_trash(self, only_type: str | None = None):
    """Permanently delete every trashed row older than the retention window.

    Runs across all companies (no user context): the retention policy is global,
    while the interactive API is tenant scoped.
    """
    days = retention_days()
    logger.info('Trash retention purge starting (retention=%s days)', days)

    result = purge_expired(only_type=only_type)

    logger.info(
        'Trash retention purge finished: purged=%s by_type=%s errors=%s',
        result['purged'], result['by_type'], len(result['errors']),
    )
    if result['errors']:
        for err in result['errors']:
            logger.warning('Trash retention purge error: %s', err)

    return result


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
