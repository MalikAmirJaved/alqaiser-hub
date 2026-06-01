"""
DRF mixins for module/resource/action permission enforcement.
"""
from __future__ import annotations

from rest_framework.exceptions import PermissionDenied

from .checks import build_permission_code, check_permission

HTTP_METHOD_TO_ACTION = {
    'GET': 'view',
    'HEAD': 'view',
    'OPTIONS': 'view',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete',
}

VIEWSET_ACTION_TO_PERMISSION = {
    'list': 'view',
    'retrieve': 'view',
    'create': 'create',
    'update': 'update',
    'partial_update': 'update',
    'destroy': 'delete',
}

# Custom @action names that are not standard CRUD
CUSTOM_ACTION_TO_PERMISSION = {
    'confirm': 'update',
    'cancel': 'update',
    'complete': 'update',
    'adjust': 'update',
    'batch_stock': 'view',
    'overall_summary': 'view',
    'stock_report': 'view',
    'stock_summary': 'view',
    'inventory_valuation': 'view',
    'stock_movement': 'view',
    'sales_vs_purchase': 'view',
    'profit_loss': 'view',
    'slow_moving': 'view',
    'reorder_planning': 'view',
    'supplier_performance': 'view',
    'mark_read': 'update',
    'resolve': 'update',
    'stats': 'view',
    'preview': 'view',
    'bulk': 'create',
    'bulk_action': 'update',
    'approve': 'approve',
    'reject': 'reject',
    'assign': 'assign',
    'export': 'export',
    'publish': 'publish',
    'archive': 'archive',
    'acknowledge': 'update',
    'setup': 'create',
}


class PermissionRequiredMixin:
    """
    Enforce DB-backed permissions before the view handler runs.

    On each view / viewset set:
        permission_module = 'INVENTORY'   # matches Module.code in seed
        permission_resource = 'product'   # matches Resource.code in seed

    Optional:
        permission_action_map = {'custom_action': 'approve'}
        skip_permission_check = True      # health checks, webhooks, etc.

    Cross-module access (for shared read endpoints like batch-stock):
        action_permission_any_of = {
            'batch_stock': [
                ('INVENTORY', 'stock'),
                ('INVENTORY', 'sales_order'),
                ('INVENTORY', 'product'),
            ],
        }
        When the current action matches a key, access is granted if the user
        has the resolved action on ANY of the listed (module, resource) pairs.
    """

    permission_module: str | None = None
    permission_resource: str | None = None
    permission_action_map: dict[str, str] = {}
    action_permission_any_of: dict[str, list[tuple[str, str]]] = {}
    skip_permission_check: bool = False

    def get_permission_action(self) -> str:
        """Resolve the action code for the current request (override in subclasses)."""
        custom = self.permission_action_map.get(getattr(self, 'action', None) or '')
        if custom:
            return custom

        viewset_action = getattr(self, 'action', None)
        if viewset_action:
            if viewset_action in self.permission_action_map:
                return self.permission_action_map[viewset_action]
            if viewset_action in VIEWSET_ACTION_TO_PERMISSION:
                return VIEWSET_ACTION_TO_PERMISSION[viewset_action]
            normalized = viewset_action.replace('-', '_')
            if normalized in CUSTOM_ACTION_TO_PERMISSION:
                return CUSTOM_ACTION_TO_PERMISSION[normalized]
            if normalized in self.permission_action_map:
                return self.permission_action_map[normalized]

        return HTTP_METHOD_TO_ACTION.get(
            self.request.method.upper(),
            'view',
        )

    def check_permissions(self, request):
        """Run after authentication; validates resource permission then DRF classes."""
        super().check_permissions(request)
        self._enforce_resource_permission(request)

    def _enforce_resource_permission(self, request) -> None:
        if self.skip_permission_check:
            return

        module = getattr(self, 'permission_module', None)
        resource = getattr(self, 'permission_resource', None)
        if not module or not resource:
            return

        action = self.get_permission_action()
        user = request.user
        if not user or not user.is_authenticated:
            return

        # ── Cross-module "any-of" check ──────────────────────────────
        # For actions that legitimately serve multiple modules (e.g.
        # batch_stock is used by POS, product detail, and stock pages),
        # allow access if the user has the resolved action on ANY of
        # the listed (module, resource) alternatives.
        viewset_action = getattr(self, 'action', None) or ''
        normalized_action = viewset_action.replace('-', '_')
        any_of = (
            self.action_permission_any_of.get(viewset_action)
            or self.action_permission_any_of.get(normalized_action)
        )

        if any_of:
            for alt_module, alt_resource in any_of:
                if check_permission(user, alt_module, alt_resource, action):
                    return  # ✅ Granted via cross-module alternative
            # None of the alternatives matched — deny with helpful detail
            codes = [
                build_permission_code(m, r, action) for m, r in any_of
            ]
            raise PermissionDenied(
                detail={
                    'error': 'You do not have permission to perform this action.',
                    'required_any_of': codes,
                    'action': action.lower(),
                }
            )

        # ── Standard single-resource check ───────────────────────────
        if check_permission(user, module, resource, action):
            return

        code = build_permission_code(module, resource, action)
        raise PermissionDenied(
            detail={
                'error': 'You do not have permission to perform this action.',
                'permission': code,
                'module': module.upper(),
                'resource': resource.lower(),
                'action': action.lower(),
            }
        )
