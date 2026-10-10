"""Trash services — listing, retention policy, restore and permanent purge.

Scope rules
-----------
* Backend behaviour is identical to ``CompanyBranchMixin``: always restricted to
  ``company_id == user.company_id``; additionally restricted to the user's
  ``branch_id`` unless they are a COMPANY_ADMIN.
* Only rows with ``is_deleted=True`` **and a real ``deleted_at``** appear. Rows
  that were seeded with ``is_deleted=True`` and no deleter are never shown and
  never purged.

Retention
---------
Everything in the trash is permanently deleted ``TRASH_RETENTION_DAYS``
(default 30) after ``deleted_at``. The Celery beat task calls
``purge_expired()``; the API can trigger the same thing on demand.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field as dataclass_field
from datetime import timedelta
from typing import Any, Iterable, Iterator, Sequence

from django.conf import settings
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import CASCADE, PROTECT, Q
from django.utils import timezone

from apps.permissions.checks import check_permission

from .registry import TRASH_MODELS, TrashModel, build_display_name, get_trash_model

logger = logging.getLogger(__name__)

# Safety valve for the recursive dependency walk.
MAX_DEPENDENCY_DEPTH = 4
MAX_REPORTED_DEPENDENCIES = 25


# ─────────────────────────────────────────────────────────────────────────────
# Retention policy
# ─────────────────────────────────────────────────────────────────────────────

def retention_days() -> int:
    """Days a row stays in the trash before it is auto-purged."""
    try:
        days = int(getattr(settings, 'TRASH_RETENTION_DAYS', 30))
    except (TypeError, ValueError):
        return 30
    return days if days > 0 else 30


def retention_cutoff():
    """Rows deleted strictly before this instant are expired."""
    return timezone.now() - timedelta(days=retention_days())


def expiry_for(deleted_at):
    """The instant this row will be auto-purged."""
    if not deleted_at:
        return None
    return deleted_at + timedelta(days=retention_days())


# ─────────────────────────────────────────────────────────────────────────────
# Querysets / scoping
# ─────────────────────────────────────────────────────────────────────────────

def _model_field_names(tm: TrashModel) -> set[str]:
    return {f.name for f in tm.model._meta.get_fields()}


def _has_field(tm: TrashModel, name: str) -> bool:
    return any(f.name == name for f in tm.model._meta.get_fields())


def scope_queryset(tm: TrashModel, user) -> Any:
    """Deleted-but-not-purged rows visible to ``user``, newest first."""
    qs = tm.model._default_manager.filter(
        is_deleted=True,
        deleted_at__isnull=False,
    )

    company_id = getattr(user, 'company_id', None)
    if company_id is not None:
        qs = qs.filter(company_id=company_id)

    if getattr(user, 'role', None) != 'COMPANY_ADMIN':
        branch_id = getattr(user, 'branch_id', None)
        if _has_field(tm, 'branch_id'):
            if branch_id:
                qs = qs.filter(branch_id=branch_id)
            else:
                return qs.none()

    return qs.order_by('-deleted_at')


def can_view_type(user, tm: TrashModel) -> bool:
    """True when the user may see this trash type at all."""
    if check_permission(user, 'SETTINGS', 'trash', 'view'):
        return True
    return check_permission(user, tm.module, tm.resource, 'delete')


def visible_types(user) -> list[TrashModel]:
    return [tm for tm in TRASH_MODELS if can_view_type(user, tm)]


# ─────────────────────────────────────────────────────────────────────────────
# Serialisation
# ─────────────────────────────────────────────────────────────────────────────

def _user_display(user) -> str | None:
    if not user:
        return None
    for attr in ('full_name', 'get_full_name', 'username', 'email'):
        value = getattr(user, attr, None)
        if callable(value):
            try:
                value = value()
            except Exception:
                value = None
        if value:
            return str(value)
    return None


@dataclass
class TrashEntry:
    type_key: str
    type_label: str
    group: str
    _id: str
    display_name: str
    deleted_at: str
    deleted_by: str | None
    expires_at: str | None
    days_left: int | None
    is_expired: bool
    size_bytes: int
    meta: dict = dataclass_field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def _row_size_bytes(obj) -> int:
    """Approximate retained size — sum of file sizes on the record."""
    total = 0
    for f in obj._meta.get_fields():
        if f.many_to_one or f.one_to_many or f.many_to_many or not getattr(f, 'concrete', False):
            continue
        try:
            val = getattr(obj, f.attname, None)
        except Exception:
            continue
        if val is None:
            continue
        # Django FileField exposes .size on FieldFile
        size = getattr(val, 'size', None)
        if isinstance(size, int):
            total += size
    return total


def serialize_entry(tm: TrashModel, obj, cutoff=None) -> TrashEntry:
    cutoff = cutoff or retention_cutoff()
    deleted_at = getattr(obj, 'deleted_at', None)
    expires_at = expiry_for(deleted_at)
    now = timezone.now()

    days_left = None
    if expires_at:
        # Round up to whole days: something expiring in 19d23h59m is shown as
        # "20 days left", which is what a user expects from a countdown.
        days_left = max(0, round((expires_at - now).total_seconds() / 86400))

    return TrashEntry(
        type_key=tm.key,
        type_label=tm.label,
        group=tm.group,
        _id=str(getattr(obj, '_id', '')),
        display_name=build_display_name(tm, obj),
        deleted_at=deleted_at.isoformat() if deleted_at else '',
        deleted_by=_user_display(getattr(obj, 'deleted_by', None)),
        expires_at=expires_at.isoformat() if expires_at else None,
        days_left=days_left,
        is_expired=bool(deleted_at and deleted_at < cutoff),
        size_bytes=_row_size_bytes(obj),
        meta=_extra_meta(tm, obj),
    )


_META_FIELDS = {
    'product': ('status',),
    'customer_invoice': ('status', 'amount', 'currency'),
    'supplier_bill': ('status', 'amount'),
    'expense': ('amount', 'expense_date'),
    'quote': ('status', 'total_amount'),
    'lead': ('status',),
    'employee': ('employment_status', 'designation'),
    'leave': ('status', 'leave_type'),
    'policy': ('status',),
    'exit': ('status', 'exit_date'),
    'journal_entry': ('date', 'is_posted'),
    'account': ('account_type',),
}


def _extra_meta(tm: TrashModel, obj) -> dict:
    """A couple of type-specific extras so the UI can show useful context."""
    out: dict = {}
    for name in _META_FIELDS.get(tm.key, ()):
        try:
            value = getattr(obj, name, None)
        except Exception:
            continue
        if value is None or callable(value) or hasattr(value, '_meta'):
            continue
        if hasattr(value, 'isoformat'):
            value = value.isoformat()
        elif not isinstance(value, (str, int, float, bool)):
            value = str(value)
        out[name] = value
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Listing
# ─────────────────────────────────────────────────────────────────────────────

def _parse_types(raw) -> list[TrashModel]:
    if not raw:
        return list(TRASH_MODELS)
    if isinstance(raw, str):
        keys = [p.strip().lower() for p in raw.split(',') if p.strip()]
    else:
        keys = [str(p).strip().lower() for p in raw if str(p).strip()]
    if not keys or 'all' in keys:
        return list(TRASH_MODELS)

    wanted = {k for k in keys if k in {tm.key for tm in TRASH_MODELS}}
    return [tm for tm in TRASH_MODELS if tm.key in wanted]


def _search_q(tm: TrashModel, term: str) -> Q | None:
    q = Q()
    matched = False
    for path in tm.label_fields:
        try:
            q |= Q(**{f'{path}__icontains': term})
            matched = True
        except Exception:
            continue
    return q if matched else None


def iter_entries(user, types=None, search='', only_expired=False) -> Iterator[TrashEntry]:
    """Yield serialised trash entries visible to ``user``, newest first."""
    cutoff = retention_cutoff()
    term = (search or '').strip()

    for tm in _parse_types(types):
        if not can_view_type(user, tm):
            continue

        qs = scope_queryset(tm, user)
        if only_expired:
            qs = qs.filter(deleted_at__lt=cutoff)

        if term:
            q = _search_q(tm, term)
            if q is None:
                continue
            qs = qs.filter(q)

        qs = qs.select_related('deleted_by')
        for obj in qs.iterator(chunk_size=200):
            yield serialize_entry(tm, obj, cutoff)


def list_trash(user, types=None, search='', page=1, page_size=20,
               only_expired=False, expired_only_flag=None) -> dict:
    """Paginated trash listing.

    ``only_expired`` and ``expired_only_flag`` are aliases; the latter exists so
    the view can pass ``?expired=true`` without ambiguity.

    Performance note: rows are gathered per registered model and merged in
    Python, so cost grows with the *total* trash size rather than the page size
    (one indexed query per type). That is deliberate — the tables have different
    shapes and the retention window keeps the working set small — but if the
    trash ever grows into the hundreds of thousands, replace this with a UNION
    query or a shared deletion-index table.
    """
    expired = bool(only_expired or expired_only_flag)
    entries = list(iter_entries(user, types=types, search=search, only_expired=expired))

    paginator = Paginator(entries, max(1, min(int(page_size or 20), 200)))
    page_obj = paginator.get_page(page)

    return {
        'count': paginator.count,
        'total_pages': paginator.num_pages,
        'current_page': page_obj.number,
        'page_size': paginator.per_page,
        'next': page_obj.number + 1 if page_obj.has_next() else None,
        'previous': page_obj.number - 1 if page_obj.has_previous() else None,
        'retention_days': retention_days(),
        'results': [e.to_dict() for e in page_obj.object_list],
    }


def trash_summary(user) -> dict:
    """Counts per trash type + global totals (drives the filter chips / KPIs)."""
    cutoff = retention_cutoff()
    types_out: list[dict] = []
    total = 0
    expired_total = 0
    expiring_soon = 0
    size_total = 0

    for tm in TRASH_MODELS:
        if not can_view_type(user, tm):
            continue
        qs = scope_queryset(tm, user)
        count = qs.count()
        expired = qs.filter(deleted_at__lt=cutoff).count()
        soon = qs.filter(deleted_at__gte=cutoff).count()
        total += count
        expired_total += expired
        expiring_soon += soon
        if count:
            types_out.append({
                'key': tm.key,
                'label': tm.label,
                'group': tm.group,
                'count': count,
                'expired': expired,
            })

    return {
        'total': total,
        'expired': expired_total,
        'within_retention': expiring_soon,
        'size_bytes': size_total,
        'retention_days': retention_days(),
        'types': types_out,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Dependencies (what else disappears when this row is purged)
# ─────────────────────────────────────────────────────────────────────────────

def _reverse_cascade_relations(model) -> list:
    """Reverse relations whose child FK carries CASCADE.

    This is the common shape here (Product ← ProductVariant ← StockItem) and is
    where the rows a user thinks of as "the same thing" live.
    """
    out = []
    for rel in model._meta.related_objects:
        remote = getattr(rel.field, 'remote_field', None)
        if remote is None or remote.on_delete is not CASCADE:
            continue
        out.append(rel)
    return out


def _child_queryset(obj, rel):
    """The related-row queryset for one reverse relation, or None."""
    try:
        accessor = rel.get_accessor_name()
        manager = getattr(obj, accessor, None)
    except Exception:
        return None
    if manager is None or not hasattr(manager, 'all'):
        return None
    try:
        return manager.all()
    except Exception:
        return None


def collect_dependencies(obj, depth: int = 0) -> list[dict]:
    """Rows that will be removed along with ``obj`` when it is hard-deleted.

    Recurses through CASCADE relations only (reverse children whose FK cascades,
    which in turn pull their own children). Returns aggregated counts per model
    plus how many of those rows are already soft-deleted.
    """
    if depth >= MAX_DEPENDENCY_DEPTH or not hasattr(obj, '_meta'):
        return []

    counts: dict[str, dict] = {}

    def bump(model, field_name, is_soft, nested_count=1, nested_soft=0):
        label = model._meta.label
        entry = counts.setdefault(label, {
            'model': label, 'count': 0, 'fields': set(), 'soft_deleted': 0,
        })
        entry['count'] += nested_count
        entry['soft_deleted'] += nested_soft + (1 if is_soft else 0)
        entry['fields'].add(field_name)

    for rel in _reverse_cascade_relations(type(obj)):
        qs = _child_queryset(obj, rel)
        if qs is None:
            continue
        child_model = rel.related_model
        has_soft = any(f.name == 'is_deleted' for f in child_model._meta.get_fields())
        try:
            children = list(qs[:MAX_REPORTED_DEPENDENCIES])
        except Exception:
            continue

        for child in children:
            is_soft = bool(has_soft and getattr(child, 'is_deleted', False))
            bump(child_model, rel.field.name, is_soft)
            for nested in collect_dependencies(child, depth + 1):
                entry = counts.setdefault(nested['model'], {
                    'model': nested['model'], 'count': 0, 'fields': set(), 'soft_deleted': 0,
                })
                entry['count'] += nested['count']
                entry['soft_deleted'] += nested.get('soft_deleted', 0)
                entry['fields'].update(nested.get('fields', []))

    return [
        {
            'model': v['model'],
            'count': v['count'],
            'soft_deleted': v['soft_deleted'],
            'fields': sorted(v['fields']),
        }
        for v in counts.values()
    ]


def protected_relations(obj) -> list[dict]:
    """Rows that would BLOCK a hard delete (FK with on_delete=PROTECT)."""
    blocked = []
    for rel in type(obj)._meta.related_objects:
        remote = getattr(rel.field, 'remote_field', None)
        if remote is None or remote.on_delete is not PROTECT:
            continue
        qs = _child_queryset(obj, rel)
        if qs is None:
            continue
        try:
            count = qs.count()
        except Exception:
            continue
        if count:
            blocked.append({
                'model': rel.related_model._meta.label,
                'field': rel.field.name,
                'count': count,
            })
    return blocked


def _process_relations(obj, action) -> int:
    """Run ``action`` over every CASCADE-related row of ``obj``, deepest first.

    Returns the number of related rows removed (children included).
    """
    processed = 0
    for rel in _reverse_cascade_relations(type(obj)):
        qs = _child_queryset(obj, rel)
        if qs is None:
            continue
        children = list(qs)
        if not children:
            continue
        for child in children:
            processed += _process_relations(child, action)
        action(children)
        processed += len(children)
    return processed


# ─────────────────────────────────────────────────────────────────────────────
# File cleanup
# ─────────────────────────────────────────────────────────────────────────────

def _delete_row_files(obj) -> int:
    """Best-effort removal of stored files before the row is dropped."""
    removed = 0
    for f in obj._meta.get_fields():
        if not getattr(f, 'concrete', False):
            continue
        if f.get_internal_type() not in ('FileField', 'ImageField'):
            continue
        storage_file = getattr(obj, f.attname, None)
        if not storage_file or not getattr(storage_file, 'name', None):
            continue
        try:
            storage_file.storage.delete(storage_file.name)
            removed += 1
        except Exception as exc:  # pragma: no cover - storage failures are non-fatal
            logger.warning('Trash: could not delete file %s: %s', storage_file.name, exc)
    return removed


# ─────────────────────────────────────────────────────────────────────────────
# Permanent purge
# ─────────────────────────────────────────────────────────────────────────────

class TrashOperationError(Exception):
    """Raised when a purge/restore cannot be performed."""


def find_entry(tm: TrashModel, user, entry_id) -> Any:
    """Fetch a single trashed row, respecting tenant scope."""
    qs = scope_queryset(tm, user)
    obj = qs.filter(_id=entry_id).first()
    if obj is None:
        raise TrashOperationError('This item is no longer in the trash.')
    return obj


def purge_entry(tm: TrashModel, user, entry_id, *, ignore_permission: bool = False) -> dict:
    """Hard-delete one trashed row forever.

    Related CASCADE rows are deleted deepest-first so PROTECT constraints deeper
    in the graph cannot abort the operation with an opaque IntegrityError.
    """
    if not ignore_permission and not can_purge(user, tm):
        raise TrashOperationError('You do not have permission to permanently delete this item.')

    obj = find_entry(tm, user, entry_id)
    display_name = build_display_name(tm, obj)

    # Surface blockers before we start so the user gets a clear message.
    blocked = protected_relations(obj)
    if blocked:
        names = ', '.join(f"{b['count']} {b['model'].split('.')[-1]}" for b in blocked)
        raise TrashOperationError(
            f'This item is still referenced by {names} and cannot be permanently '
            f'deleted yet. Remove those records first.'
        )

    with transaction.atomic():
        files_removed = _delete_row_files(obj)
        removed_related = _process_relations(obj, lambda rows: _purge_rows(rows))
        obj.delete()

    return {
        'id': str(entry_id),
        'type': tm.key,
        'display_name': display_name,
        'related_removed': removed_related,
        'files_removed': files_removed,
    }


def _purge_rows(rows) -> None:
    """Best-effort deletion of a batch of related rows (per-row, so one
    failure does not strand the rest)."""
    for row in rows:
        try:
            _delete_row_files(row)
        except Exception:
            pass
        row.delete()


def can_purge(user, tm: TrashModel) -> bool:
    """Permanent delete is a Settings-Trash action, with a module fallback."""
    if check_permission(user, 'SETTINGS', 'trash', 'delete'):
        return True
    return check_permission(user, tm.module, tm.resource, 'delete')


def restore_entry(tm: TrashModel, user, entry_id) -> dict:
    """Un-delete a single row (clears the trash bookkeeping)."""
    if not can_restore(user, tm):
        raise TrashOperationError('You do not have permission to restore this item.')

    obj = find_entry(tm, user, entry_id)
    display_name = build_display_name(tm, obj)

    saved = {}
    for field_name in ('is_deleted', 'deleted_at', 'deleted_by'):
        if any(f.name == field_name for f in tm.model._meta.get_fields()):
            saved[field_name] = getattr(obj, field_name)

    obj.is_deleted = False
    obj.deleted_at = None
    if 'deleted_by' in saved:
        obj.deleted_by = None

    obj.save(update_fields=[name for name in saved if name in ('is_deleted', 'deleted_at', 'deleted_by')])

    return {
        'id': str(entry_id),
        'type': tm.key,
        'display_name': display_name,
        'restored': True,
    }


def can_restore(user, tm: TrashModel) -> bool:
    if check_permission(user, 'SETTINGS', 'trash', 'restore'):
        return True
    return check_permission(user, tm.module, tm.resource, 'update')


def purge_expired(user=None, *, only_type: str | None = None) -> dict:
    """Permanently delete everything past the retention window.

    Called by the Celery beat task (no user → no permission check, global scope)
    and by the ``purge-expired`` API action (user scoped).
    """
    cutoff = retention_cutoff()
    models = [get_trash_model(only_type)] if only_type else list(TRASH_MODELS)
    models = [tm for tm in models if tm is not None]

    purged = 0
    by_type: dict[str, int] = {}
    errors: list[str] = []

    for tm in models:
        if user is not None:
            if not can_purge(user, tm):
                continue
            qs = scope_queryset(tm, user).filter(deleted_at__lt=cutoff)
        else:
            qs = tm.model._default_manager.filter(
                is_deleted=True, deleted_at__isnull=False, deleted_at__lt=cutoff,
            )

        for obj in qs.only('_id').iterator(chunk_size=200):
            try:
                if user is not None:
                    purge_entry(tm, user, obj._id)
                else:
                    _hard_delete_unscoped(tm, obj._id)
                purged += 1
                by_type[tm.key] = by_type.get(tm.key, 0) + 1
            except Exception as exc:
                errors.append(f'{tm.key}:{obj._id}: {exc}')
                logger.warning('Trash purge failed for %s %s: %s', tm.key, obj._id, exc)

    return {
        'purged': purged,
        'by_type': by_type,
        'errors': errors[:20],
        'retention_days': retention_days(),
        'cutoff': cutoff.isoformat(),
    }


def _hard_delete_unscoped(tm: TrashModel, entry_id) -> None:
    """System-context purge (Celery) — no tenant scoping."""
    obj = tm.model._default_manager.filter(_id=entry_id).first()
    if obj is None:
        return
    with transaction.atomic():
        _delete_row_files(obj)
        _process_relations(obj, lambda rows: _purge_rows(rows))
        obj.delete()


def empty_trash(user, types: Sequence[str] | None = None) -> dict:
    """Permanently delete everything currently in the trash (manual action)."""
    keys = None
    if types:
        keys = [k for k in types if get_trash_model(k)]
        if not keys:
            raise TrashOperationError('No valid trash types supplied.')

    purged = 0
    by_type: dict[str, int] = {}
    errors: list[str] = []

    for tm in (_parse_types(keys) if keys else TRASH_MODELS):
        if not can_purge(user, tm):
            continue
        qs = scope_queryset(tm, user)
        for obj in qs.only('_id').iterator(chunk_size=200):
            try:
                purge_entry(tm, user, obj._id, ignore_permission=True)
                purged += 1
                by_type[tm.key] = by_type.get(tm.key, 0) + 1
            except Exception as exc:
                errors.append(f'{tm.key}:{obj._id}: {exc}')
                logger.warning('Trash empty failed for %s %s: %s', tm.key, obj._id, exc)

    return {'purged': purged, 'by_type': by_type, 'errors': errors[:20]}


def dependency_report(tm: TrashModel, user, entry_id) -> dict:
    """Preview of what a permanent delete would take with it."""
    obj = find_entry(tm, user, entry_id)
    deps = collect_dependencies(obj)
    blocked = protected_relations(obj)
    return {
        'id': str(entry_id),
        'type': tm.key,
        'display_name': build_display_name(tm, obj),
        'dependencies': deps,
        'total_related': sum(d['count'] for d in deps),
        'blocked_by': blocked,
        'can_purge': not blocked,
    }
