"""Settings → Trash: unified soft-delete listing, restore and permanent purge."""

from .backfill import backfill_deleted_at
from .registry import TRASH_BY_KEY, TRASH_MODELS, TrashModel, get_trash_model
from .services import (  # noqa: F401
    TrashOperationError,
    can_purge,
    can_restore,
    dependency_report,
    empty_trash,
    list_trash,
    purge_entry,
    purge_expired,
    resolve_scope,
    restore_entry,
    retention_days,
    trash_summary,
)

__all__ = [
    'TRASH_MODELS',
    'TRASH_BY_KEY',
    'TrashModel',
    'TrashOperationError',
    'get_trash_model',
    'list_trash',
    'trash_summary',
    'purge_entry',
    'restore_entry',
    'purge_expired',
    'empty_trash',
    'dependency_report',
    'resolve_scope',
    'can_purge',
    'can_restore',
    'retention_days',
    'backfill_deleted_at',
]
