"""Settings → Trash API.

Endpoints (mounted at ``/api/company/settings/trash/``)::

    GET    /                             paginated trash listing
    DELETE /                             empty the trash (all types or ?type=a,b)
    GET    /summary/                     counts per type + totals (chips/KPIs)
    POST   /purge-expired/               purge everything past retention
    GET    /<type>/<uuid>/dependencies/  what a permanent delete would remove
    DELETE /<type>/<uuid>/               permanently delete ONE item
    POST   /<type>/<uuid>/restore/       restore ONE item

``<type>`` is a registry key from ``trash/registry.py`` (product, employee, …).

Permissions (``SETTINGS:trash:<action>``): ``view``, ``delete``, ``restore``.
Each has a cross-module fallback so a module admin can act on their own trash
(see ``services.can_view_type`` / ``can_purge`` / ``can_restore``).
"""
from __future__ import annotations

import logging
from datetime import date

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.permissions.checks import check_permission
from apps.permissions.mixins import PermissionRequiredMixin

from . import services
from .registry import get_trash_model, registry_keys

logger = logging.getLogger(__name__)


class BaseTrashView(PermissionRequiredMixin, APIView):
    """Shared plumbing for every trash endpoint.

    ``required_action`` is the SETTINGS:trash:<action> this view enforces. The
    inherited ``PermissionRequiredMixin.get_permission_action`` resolves plain
    APIViews through ``VIEWSET_ACTION_TO_PERMISSION``/HTTP-method fallbacks
    (POST → "create"), which is wrong for restore/purge, so we override it.
    """

    permission_classes = [IsAuthenticated]
    permission_module = 'SETTINGS'
    permission_resource = 'trash'
    required_action = 'view'

    def get_permission_action(self) -> str:
        return self.required_action

    # ── response helpers ───────────────────────────────────────────────────
    @staticmethod
    def _ok(data=None, message='', http_status=status.HTTP_200_OK):
        return Response({'success': True, 'message': message, 'data': data}, status=http_status)

    @staticmethod
    def _fail(message, http_status=status.HTTP_400_BAD_REQUEST):
        return Response(
            {'success': False, 'message': message, 'data': None},
            status=http_status,
        )

    # ── param helpers ──────────────────────────────────────────────────────
    @staticmethod
    def _bool_param(request, name):
        raw = request.query_params.get(name)
        if raw is None:
            return None
        return str(raw).strip().lower() in ('1', 'true', 'yes', 'on')

    @staticmethod
    def _int_param(request, name, default):
        try:
            return int(request.query_params.get(name, default))
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _date_param(request, name):
        """Parse an ISO ``YYYY-MM-DD`` query param into a date, or None."""
        raw = (request.query_params.get(name) or '').strip()
        if not raw:
            return None
        try:
            return date.fromisoformat(raw)
        except ValueError:
            return None

    # ── permission + type helpers ──────────────────────────────────────────
    def _require_permission(self, action: str) -> Response | None:
        if check_permission(self.request.user, 'SETTINGS', 'trash', action):
            return None
        return self._fail(
            'You do not have permission to manage the trash.',
            status.HTTP_403_FORBIDDEN,
        )

    def _resolve_type(self, type_key: str):
        tm = get_trash_model(type_key)
        if tm is None:
            return None, self._fail(
                f'Unknown trash type "{type_key}". '
                f'Valid types: {", ".join(registry_keys())}',
                status.HTTP_404_NOT_FOUND,
            )
        if not services.can_view_type(self.request.user, tm):
            return None, self._fail(
                'You do not have permission to view this trash type.',
                status.HTTP_403_FORBIDDEN,
            )
        return tm, None


class TrashListView(BaseTrashView):
    """List the trash (paginated) or empty it entirely."""

    def get_permission_action(self) -> str:
        # GET lists (view) but DELETE empties the trash (permanent delete).
        return 'view' if self.request.method == 'GET' else 'delete'

    def get(self, request):
        denied = self._require_permission('view')
        if denied:
            return denied

        types = request.query_params.get('type') or request.query_params.get('types')
        if types and not any(get_trash_model(k) for k in types.split(',')):
            return self._fail(
                f'Unknown trash type. Valid types: {", ".join(registry_keys())}',
                status.HTTP_404_NOT_FOUND,
            )

        payload = services.list_trash(
            request.user,
            types=types,
            groups=request.query_params.get('group') or request.query_params.get('groups'),
            search=request.query_params.get('search', ''),
            page=self._int_param(request, 'page', 1),
            page_size=self._int_param(request, 'page_size', 20),
            only_expired=bool(self._bool_param(request, 'expired')),
            sort=request.query_params.get('sort', 'newest'),
            date_from=self._date_param(request, 'date_from'),
            date_to=self._date_param(request, 'date_to'),
        )
        return self._ok(payload)

    def delete(self, request):
        """Empty the trash.

        Scope with ``?type=a,b`` (registry keys) and/or ``?group=Inventory``
        (module group).
        """
        denied = self._require_permission('delete')
        if denied:
            return denied

        raw_types = request.query_params.get('type') or request.query_params.get('types')
        types = [t.strip() for t in raw_types.split(',')] if raw_types else None
        group = request.query_params.get('group') or request.query_params.get('groups')

        if types and not any(get_trash_model(k) for k in types):
            return self._fail(
                f'Unknown trash type. Valid types: {", ".join(registry_keys())}',
                status.HTTP_404_NOT_FOUND,
            )

        result = services.empty_trash(request.user, types=types, groups=group)

        if result['purged'] == 0 and not result['errors'] and not result['blocked']:
            return self._ok(result, 'The trash is already empty.')

        if result['purged'] == 0 and result['blocked']:
            # Nothing could be removed — explain exactly why instead of a bare
            # "0 deleted".
            first = result['blockers'][0] if result['blockers'] else ''
            message = (
                f"No items could be permanently deleted — {result['blocked']} "
                f"item(s) are still referenced by other records. {first}"
            ).strip()
            return self._ok(result, message)

        message = f"Permanently deleted {result['purged']} item(s) from the trash."
        if result['blocked']:
            message += f" {result['blocked']} item(s) are still referenced and were kept."
        if result['errors']:
            message += f" {len(result['errors'])} item(s) could not be deleted."
        return self._ok(result, message)


class TrashSummaryView(BaseTrashView):
    """Totals and per-type counts."""

    required_action = 'view'

    def get(self, request):
        denied = self._require_permission('view')
        if denied:
            return denied
        return self._ok(services.trash_summary(request.user))


class TrashEntryView(BaseTrashView):
    """Permanent delete or dependency preview for a single entry."""

    def get_permission_action(self) -> str:
        # GET is a read-only preview (view); DELETE is irreversible (delete).
        return 'view' if self.request.method == 'GET' else 'delete'

    def get(self, request, type_key: str, entry_id):
        """Dependency preview — what else disappears with this row."""
        denied = self._require_permission('view')
        if denied:
            return denied

        tm, error = self._resolve_type(type_key)
        if error:
            return error

        try:
            data = services.dependency_report(tm, request.user, entry_id)
        except services.TrashOperationError as exc:
            return self._fail(str(exc), status.HTTP_404_NOT_FOUND)
        return self._ok(data)

    def delete(self, request, type_key: str, entry_id):
        """Permanently delete one item — irreversible."""
        denied = self._require_permission('delete')
        if denied:
            return denied

        tm, error = self._resolve_type(type_key)
        if error:
            return error

        try:
            result = services.purge_entry(tm, request.user, entry_id)
        except services.TrashOperationError as exc:
            return self._fail(str(exc), status.HTTP_400_BAD_REQUEST)
        except Exception as exc:  # unexpected DB error — keep the envelope shape
            logger.exception('Trash purge failed for %s %s', type_key, entry_id)
            return self._fail(
                f'Could not permanently delete this item: {exc}',
                status.HTTP_409_CONFLICT,
            )

        message = f"Permanently deleted “{result['display_name']}”."
        if result['related_removed']:
            message += f" {result['related_removed']} related record(s) were removed as well."
        return self._ok(result, message)


class TrashRestoreView(BaseTrashView):
    """Restore a single trashed item."""

    required_action = 'restore'

    def post(self, request, type_key: str, entry_id):
        denied = self._require_permission('restore')
        if denied:
            return denied

        tm, error = self._resolve_type(type_key)
        if error:
            return error

        try:
            result = services.restore_entry(tm, request.user, entry_id)
        except services.TrashOperationError as exc:
            return self._fail(str(exc), status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.exception('Trash restore failed for %s %s', type_key, entry_id)
            return self._fail(f'Could not restore this item: {exc}', status.HTTP_409_CONFLICT)

        return self._ok(result, f"Restored “{result['display_name']}”.")


class TrashPurgeExpiredView(BaseTrashView):
    """Permanently delete everything past the retention window, on demand."""

    required_action = 'delete'

    def post(self, request):
        denied = self._require_permission('delete')
        if denied:
            return denied

        only_type = request.data.get('type') or request.query_params.get('type')
        group = request.data.get('group') or request.query_params.get('group')
        if only_type and not get_trash_model(only_type):
            return self._fail(
                f'Unknown trash type "{only_type}". '
                f'Valid types: {", ".join(registry_keys())}',
                status.HTTP_404_NOT_FOUND,
            )

        result = services.purge_expired(request.user, only_type=only_type, groups=group)

        if result['purged'] == 0 and not result['blocked']:
            return self._ok(
                result,
                f"Nothing to purge — no items are older than {result['retention_days']} days.",
            )

        if result['purged'] == 0 and result['blocked']:
            first = result['blockers'][0] if result['blockers'] else ''
            return self._ok(
                result,
                f"{result['blocked']} expired item(s) are still referenced by other "
                f"records and were kept. {first}".strip(),
            )

        message = (
            f"Permanently deleted {result['purged']} item(s) older than "
            f"{result['retention_days']} days."
        )
        if result['blocked']:
            message += f" {result['blocked']} expired item(s) are still referenced and were kept."
        if result['errors']:
            message += f" {len(result['errors'])} item(s) could not be deleted."
        return self._ok(result, message)
