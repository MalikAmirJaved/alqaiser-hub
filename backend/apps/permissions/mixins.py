"""
apps/permissions/mixins.py

DRF mixin that enforces DB-backed module:resource:action permissions.

Every ViewSet or APIView that touches a protected resource should inherit
PermissionRequiredMixin and declare:

    permission_module   = "HR"
    permission_resource = "employee"

The mixin resolves the action from the HTTP method / viewset action name,
checks it against the cache-backed PermissionService, and raises 403 if
the user is not allowed.
"""
from __future__ import annotations

from rest_framework.exceptions import PermissionDenied

from .checks import build_permission_code, check_permission

# ─── HTTP method → canonical action ──────────────────────────────────────────

HTTP_METHOD_TO_ACTION: dict[str, str] = {
    "GET":     "view",
    "HEAD":    "view",
    "OPTIONS": "view",
    "POST":    "create",
    "PUT":     "update",
    "PATCH":   "update",
    "DELETE":  "delete",
}

# ─── ViewSet action name → canonical action ───────────────────────────────────

VIEWSET_ACTION_TO_PERMISSION: dict[str, str] = {
    "list":           "view",
    "retrieve":       "view",
    "create":         "create",
    "update":         "update",
    "partial_update": "update",
    "destroy":        "delete",
}

# ─── Custom @action names → canonical permission action ──────────────────────
# Covers every action declared in seed_permissions.py RESOURCES_ACTIONS.

CUSTOM_ACTION_TO_PERMISSION: dict[str, str] = {
    # ── Generic ────────────────────────────────────────────────────
    "confirm":          "confirm",
    "cancel":           "update",
    "complete":         "update",
    "adjust":           "adjust",
    "stats":            "view",
    "preview":          "view",
    "bulk":             "create",
    "bulk_action":      "update",
    "approve":          "approve",
    "reject":           "reject",
    "assign":           "assign",
    "export":           "export",
    "publish":          "publish",
    "archive":          "archive",
    "acknowledge":      "update",
    "setup":            "create",
    "mark_read":        "update",
    "resolve":          "update",

    # ── HR ─────────────────────────────────────────────────────────
    "activate":              "activate",
    "deactivate":            "deactivate",
    "pay_salary":            "pay_salary",
    "schedule":              "schedule",
    "schedule_shift":        "schedule",
    "return_asset":          "return",
    "asset_return":          "return",
    "asset_assign":          "assign",
    "update_round":          "update_round",
    "update_checklist":      "update_checklist",
    # compensation
    "view_compensation":              "view_compensation",
    "view_loan":                      "view_loan",
    "create_compensation":            "create_compensation",
    "create_loan":                    "create_loan",
    "update_compensation_status":     "update_compensation_status",
    "update_loan_status":             "update_loan_status",
    "update_compensation":            "update_compensation",
    "delete_compensation":            "delete_compensation",
    "update_loan":                    "update_loan",
    "delete_loan":                    "delete_loan",
    "approve_loan":                   "approve_loan",
    "pay_loan":                       "pay_loan",

    # ── Inventory ──────────────────────────────────────────────────
    "receive_goods":    "receive_goods",
    "complete_sale":    "complete_sale",
    "hold_sale":        "hold_sale",
    "return_sale":      "return",
    "reconcile":        "update",

    # ── Finance ────────────────────────────────────────────────────
    "pay":              "pay",
    "recompute_sales":  "recompute_sales",
    "recompute_stock":  "recompute_stock",

    # ── Sales ──────────────────────────────────────────────────────
    "accept":           "accept",
    "convert_to_quote": "convert_to_quote",

    # ── Inventory report shortcuts ─────────────────────────────────
    "batch_stock":          "view",
    "overall_summary":      "view",
    "stock_report":         "view",
    "stock_summary":        "view",
    "inventory_valuation":  "view",
    "stock_movement":       "view",
    "sales_vs_purchase":    "view",
    "profit_loss":          "view",
    "slow_moving":          "view",
    "reorder_planning":     "view",
    "supplier_performance": "view",

    # ── Financial reports ──────────────────────────────────────────
    "balance_sheet":        "view",
    "trial_balance":        "view",
    "ledger":               "view",
    "ap_aging":             "view",
    "ar_aging":             "view",
    "cashflow":             "view",
    "expense_breakdown":    "view",
    "expense_report":       "view",
    "revenue_trend":        "view",
    "variance_report":      "view",

    # ── Dashboard/Analytics actions ────────────────────────────────
    "analytics":            "view",
    "summary":              "view",
    "trends":               "view",
    "history":              "view",
    "recent_activity":      "view",
    "recent_payments":      "view",
    "unread_count":         "view",
    "utilization":          "view",

    # ── Inventory management ───────────────────────────────────────
    "adjust_stock":         "adjust",
    "current_stock":        "view",
    "incoming_stock":       "view",
    "variant_summary":      "view",
    "alerts":               "view",

    # ── Finance/Accounting ─────────────────────────────────────────
    "record_payment":       "pay",
    "post_bill":            "create",
    "post_invoice":         "create",
    "create_customer":      "create",
    "bank_balances":        "view",
    "balances_by_type":     "view",

    # ── Forecast/Analytics ────────────────────────────────────────
    "regenerate":           "create",
    "generate_sales_forecast": "create",
    "generate_stock_forecast": "create",

    # ── Sales/Pipeline ────────────────────────────────────────────
    "pipeline":             "view",
    "convert":              "update",
    "tree":                 "view",
    "example":              "view",
}


class PermissionRequiredMixin:
    """
    Enforce DB-backed permissions before any view handler runs.

    Class attributes:
        permission_module (str):       Module code, e.g. "INVENTORY"
        permission_resource (str):     Resource code, e.g. "product"
        permission_action_map (dict):  Override action for specific viewset actions.
        action_permission_any_of (dict): Cross-module "any-of" alternatives.
        skip_permission_check (bool):  Set True to opt out (health checks, webhooks).

    Example:
        class ProductViewSet(PermissionRequiredMixin, ModelViewSet):
            permission_module   = "INVENTORY"
            permission_resource = "product"
    """

    permission_module: str | None = None
    permission_resource: str | None = None
    permission_action_map: dict[str, str] = {}
    action_permission_any_of: dict[str, list[tuple[str, str]]] = {}
    skip_permission_check: bool = False
    skip_safe_methods: bool = False

    # ------------------------------------------------------------------

    def get_permission_action(self) -> str:
        """Resolve the canonical action code for the current request."""
        viewset_action: str = getattr(self, "action", None) or ""
        normalized: str = viewset_action.replace("-", "_")

        # 1. Explicit per-view override map
        if viewset_action in self.permission_action_map:
            return self.permission_action_map[viewset_action]
        if normalized in self.permission_action_map:
            return self.permission_action_map[normalized]

        # 2. Standard DRF viewset actions
        if viewset_action in VIEWSET_ACTION_TO_PERMISSION:
            return VIEWSET_ACTION_TO_PERMISSION[viewset_action]

        # 3. Custom @action names
        if normalized in CUSTOM_ACTION_TO_PERMISSION:
            return CUSTOM_ACTION_TO_PERMISSION[normalized]
        if viewset_action in CUSTOM_ACTION_TO_PERMISSION:
            return CUSTOM_ACTION_TO_PERMISSION[viewset_action]

        # 4. HTTP method fallback
        return HTTP_METHOD_TO_ACTION.get(self.request.method.upper(), "view")

    def check_permissions(self, request):
        super().check_permissions(request)
        self._enforce_resource_permission(request)

    def _enforce_resource_permission(self, request) -> None:
        if self.skip_permission_check:
            return
        if self.skip_safe_methods and request.method in ('GET', 'HEAD', 'OPTIONS'):
            return

        module   = getattr(self, "permission_module", None)
        resource = getattr(self, "permission_resource", None)
        if not module or not resource:
            return

        user = request.user
        if not user or not user.is_authenticated:
            return

        action = self.get_permission_action()

        # ── Cross-module "any-of" check ───────────────────────────────────
        viewset_action = getattr(self, "action", None) or ""
        normalized_action = viewset_action.replace("-", "_")
        any_of = (
            self.action_permission_any_of.get(viewset_action)
            or self.action_permission_any_of.get(normalized_action)
            or self.action_permission_any_of.get("")
        )

        if any_of:
            for alt_module, alt_resource in any_of:
                if check_permission(user, alt_module, alt_resource, action):
                    return
            codes = [build_permission_code(m, r, action) for m, r in any_of]
            raise PermissionDenied(
                detail={
                    "error":            "You do not have permission to perform this action.",
                    "required_any_of":  codes,
                    "action":           action,
                }
            )

        # ── Standard single-resource check ───────────────────────────────
        if check_permission(user, module, resource, action):
            return

        raise PermissionDenied(
            detail={
                "error":    "You do not have permission to perform this action.",
                "permission": build_permission_code(module, resource, action),
                "module":   module.upper(),
                "resource": resource.lower(),
                "action":   action,
            }
        )