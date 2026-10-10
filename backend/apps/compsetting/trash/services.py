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
import re
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

TRASH_SORTS = ('newest', 'oldest', 'expiring', 'name', 'type')

#: API sort key → model field(s) applied to each per-model queryset.
_SORT_FIELDS = {
    'newest':   ('-deleted_at',),
    'oldest':   ('deleted_at',),
    'expiring': ('deleted_at',),      # earliest deletion expires first
    'name':     ('deleted_at',),      # cross-model name sort happens in Python
    'type':     ('deleted_at',),
}


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


def _parse_groups(raw) -> list[TrashModel]:
    """Filter by module group (e.g. ``Inventory`` or ``Human Resources``)."""
    if not raw:
        return list(TRASH_MODELS)
    if isinstance(raw, str):
        names = [p.strip() for p in raw.split(',') if p.strip()]
    else:
        names = [str(p).strip() for p in raw if str(p).strip()]
    if not names:
        return list(TRASH_MODELS)

    lowered = {n.lower() for n in names}
    return [tm for tm in TRASH_MODELS if tm.group.lower() in lowered]


def group_counts(user) -> list[dict]:
    """Per-module totals for the grouped view."""
    buckets: dict[str, dict] = {}
    for tm in _parse_types(None):
        if not can_view_type(user, tm):
            continue
        count = scope_queryset(tm, user).count()
        if not count:
            continue
        bucket = buckets.setdefault(tm.group, {
            'group': tm.group, 'count': 0, 'types': [],
        })
        bucket['count'] += count
        bucket['types'].append(tm.key)
    return sorted(buckets.values(), key=lambda b: -b['count'])


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


def iter_entries(user, types=None, search='', only_expired=False,
                 sort='newest', date_from=None, date_to=None) -> Iterator[TrashEntry]:
    """Yield serialised trash entries visible to ``user``.

    ``sort`` is one of ``TRASH_SORTS``; ``date_from`` / ``date_to`` filter on
    ``deleted_at`` (dates, inclusive of the whole ``date_to`` day).
    """
    cutoff = retention_cutoff()
    term = (search or '').strip()
    if sort not in TRASH_SORTS:
        sort = 'newest'
    order_by = _SORT_FIELDS[sort]

    for tm in list(types if types is not None else TRASH_MODELS):
        if not can_view_type(user, tm):
            continue

        qs = scope_queryset(tm, user)
        if only_expired:
            qs = qs.filter(deleted_at__lt=cutoff)
        if date_from:
            qs = qs.filter(deleted_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(deleted_at__date__lte=date_to)

        if term:
            q = _search_q(tm, term)
            if q is None:
                continue
            qs = qs.filter(q)

        qs = qs.select_related('deleted_by').order_by(*order_by)
        for obj in qs.iterator(chunk_size=200):
            yield serialize_entry(tm, obj, cutoff)


def list_trash(user, types=None, groups=None, search='', page=1, page_size=20,
               only_expired=False, expired_only_flag=None, sort='newest',
               date_from=None, date_to=None) -> dict:
    """Paginated trash listing.

    ``only_expired`` and ``expired_only_flag`` are aliases; the latter exists so
    the view can pass ``?expired=true`` without ambiguity.

    ``sort`` accepts ``newest`` (default), ``oldest``, ``expiring``, ``name`` or
    ``type``. Cross-model ordering is finalised in Python because each model is
    queried separately.

    Performance note: rows are gathered per registered model and merged in
    Python, so cost grows with the *total* trash size rather than the page size
    (one indexed query per type). That is deliberate — the tables have different
    shapes and the retention window keeps the working set small — but if the
    trash ever grows into the hundreds of thousands, replace this with a UNION
    query or a shared deletion-index table.
    """
    expired = bool(only_expired or expired_only_flag)
    if sort not in TRASH_SORTS:
        sort = 'newest'

    selected = _parse_types(types)
    if groups:
        allowed = {tm.key for tm in _parse_groups(groups)}
        selected = [tm for tm in selected if tm.key in allowed]

    entries = list(iter_entries(
        user, types=selected, search=search, only_expired=expired,
        sort=sort, date_from=date_from, date_to=date_to,
    ))

    if sort == 'name':
        entries.sort(key=lambda e: (e.display_name or '').lower())
    elif sort == 'type':
        entries.sort(key=lambda e: (e.group, e.type_label, e.display_name or ''))
    elif sort == 'newest':
        entries.sort(key=lambda e: e.deleted_at, reverse=True)
    elif sort in ('oldest', 'expiring'):
        entries.sort(key=lambda e: e.deleted_at)

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
        'sort': sort,
        'results': [e.to_dict() for e in page_obj.object_list],
    }


def count_entries(user, types=None) -> int:
    """Cheap row count for the visible trash (used by the blocked probe)."""
    return sum(
        scope_queryset(tm, user).count()
        for tm in (types if types is not None else TRASH_MODELS)
        if can_view_type(user, tm)
    )


def count_blocked(user, types=None, limit: int = 500) -> dict:
    """How many trashed rows cannot be purged because PROTECT rows reference them.

    Expensive (walks each row's cascade graph), so it is capped. A row that is
    blocked is permanently stuck: it keeps reserving unique constraints and can
    never age out, so the UI must be able to call it out.
    """
    blocked = 0
    checked = 0
    samples: list[dict] = []

    for tm in (types if types is not None else TRASH_MODELS):
        if not can_view_type(user, tm):
            continue
        qs = scope_queryset(tm, user)
        if checked >= limit:
            break
        for obj in qs.only('_id').iterator(chunk_size=200):
            checked += 1
            if checked > limit:
                break
            try:
                blockers = protected_relations(obj)
            except Exception:
                continue
            if blockers:
                blocked += 1
                if len(samples) < 5:
                    samples.append({
                        'type': tm.key,
                        'id': str(obj._id),
                        'display_name': build_display_name(tm, obj),
                        'blocked_by': blockers,
                    })

    return {'blocked': blocked, 'checked': checked, 'truncated': checked > limit, 'samples': samples}


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

    blocked_info = count_blocked(user)

    return {
        'total': total,
        'expired': expired_total,
        'within_retention': expiring_soon,
        'size_bytes': size_total,
        'retention_days': retention_days(),
        'types': types_out,
        'groups': group_counts(user),
        # Rows that can never be purged while their references exist.
        'blocked': blocked_info['blocked'],
        'blocked_samples': blocked_info['samples'],
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


def _collect_blockers(obj, depth: int, acc: dict, visited: set) -> None:
    """Accumulate every PROTECT relation that would block ``obj``'s deletion.

    Must recurse: a Product itself may have no blockers while its Variant is
    referenced by an immutable ledger row (InventoryTransaction) or an invoice
    line, and the purge deletes the variant as part of the cascade.
    """
    if depth > MAX_DEPENDENCY_DEPTH or not hasattr(obj, '_meta'):
        return

    marker = (obj._meta.label, obj.pk)
    if marker in visited:
        return
    visited.add(marker)

    for rel in obj._meta.related_objects:
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
            key = (rel.related_model._meta.label, rel.field.name)
            entry = acc.setdefault(key, {
                'model': rel.related_model._meta.label,
                'field': rel.field.name,
                'count': 0,
                'blocked_by_type': obj._meta.label,
            })
            entry['count'] += count

    # Recurse into the CASCADE children that will be deleted alongside it.
    for rel in _reverse_cascade_relations(type(obj)):
        qs = _child_queryset(obj, rel)
        if qs is None:
            continue
        try:
            for child in qs[:MAX_REPORTED_DEPENDENCIES]:
                _collect_blockers(child, depth + 1, acc, visited)
        except Exception:
            continue


def protected_relations(obj) -> list[dict]:
    """Rows that would BLOCK a hard delete, anywhere in the cascade graph.

    Checked before any deletion starts, because a ProtectedError raised halfway
    through leaves a partly-purged graph and an opaque error.
    """
    acc: dict = {}
    _collect_blockers(obj, 0, acc, set())
    return sorted(acc.values(), key=lambda b: -b['count'])[:MAX_REPORTED_DEPENDENCIES]


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

    def __init__(self, message, *, blocked_by=None):
        super().__init__(message)
        #: PROTECT relations (if any) that caused this failure.
        self.blocked_by = blocked_by or []


def format_blockers(blocked: list[dict], limit: int = 4) -> str:
    """Human-readable summary of PROTECT blockers, e.g. ``2 Inventory Transaction``."""
    parts = []
    for b in blocked[:limit]:
        name = b['model'].split('.')[-1]
        # CamelCase -> "Inventory Transaction"
        name = re.sub(r'(?<!^)(?=[A-Z])', ' ', name)
        parts.append(f"{b['count']} {name}")
    text = ', '.join(parts)
    if len(blocked) > limit:
        text += f", and {len(blocked) - limit} more"
    return text


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

    # Surface blockers before we start so the user gets a clear message and no
    # partial delete happens.
    blocked = protected_relations(obj)
    if blocked:
        raise TrashOperationError(
            f'“{display_name}” cannot be permanently deleted: it is still '
            f'referenced by {format_blockers(blocked)}. Those records must be '
            f'removed first.',
            blocked_by=blocked,
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
    """Delete a batch of related rows, files first."""
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


def resolve_scope(types=None, groups=None) -> list[TrashModel]:
    """Types selected by ``?type=a,b`` and/or ``?group=Inventory`` (AND-ed)."""
    selected = _parse_types(types)
    if groups:
        allowed = {tm.key for tm in _parse_groups(groups)}
        selected = [tm for tm in selected if tm.key in allowed]
    return selected


def purge_expired(user=None, *, only_type: str | None = None,
                  groups: str | None = None) -> dict:
    """Permanently delete everything past the retention window.

    Called by the Celery beat task (no user → no permission check, global scope)
    and by the ``purge-expired`` API action (user scoped).
    """
    cutoff = retention_cutoff()
    models = resolve_scope(only_type, groups)

    purged = 0
    blocked = 0
    by_type: dict[str, int] = {}
    blockers: list[str] = []
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
            except TrashOperationError as exc:
                # Still referenced by immutable records — expected, not a bug.
                blocked += 1
                blockers.append(str(exc))
                logger.info('Trash retention skipped %s %s: %s', tm.key, obj._id, exc)
            except Exception as exc:
                errors.append(f'{tm.key}:{obj._id}: {exc}')
                logger.warning('Trash purge failed for %s %s: %s', tm.key, obj._id, exc)

    return {
        'purged': purged,
        'blocked': blocked,
        'blockers': blockers[:10],
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


def empty_trash(user, types: Sequence[str] | None = None,
                groups: str | None = None) -> dict:
    """Permanently delete everything currently in the trash (manual action)."""
    if types:
        keys = [k for k in types if get_trash_model(k)]
        if not keys:
            raise TrashOperationError('No valid trash types supplied.')
        models = resolve_scope(keys, groups)
    else:
        models = resolve_scope(None, groups)

    purged = 0
    blocked = 0
    by_type: dict[str, int] = {}
    blockers: list[str] = []
    errors: list[str] = []

    for tm in models:
        if not can_purge(user, tm):
            continue
        qs = scope_queryset(tm, user)
        for obj in qs.only('_id').iterator(chunk_size=200):
            try:
                purge_entry(tm, user, obj._id, ignore_permission=True)
                purged += 1
                by_type[tm.key] = by_type.get(tm.key, 0) + 1
            except TrashOperationError as exc:
                # Still referenced by immutable records — expected, not a bug.
                blocked += 1
                blockers.append(str(exc))
                logger.info('Trash empty skipped %s %s: %s', tm.key, obj._id, exc)
            except Exception as exc:
                errors.append(f'{tm.key}:{obj._id}: {exc}')
                logger.warning('Trash empty failed for %s %s: %s', tm.key, obj._id, exc)

    return {
        'purged': purged,
        'blocked': blocked,
        'blockers': blockers[:10],
        'by_type': by_type,
        'errors': errors[:20],
    }


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
