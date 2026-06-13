"""
Management command: seed_permissions
Usage: python manage.py seed_permissions

Idempotent — safe to re-run after adding new resources or actions.
Permission code format: MODULE:resource:action
"""
import logging
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.permissions.models import (
    Module, Resource, Action, Permission, Role, RolePermission,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Modules
# ─────────────────────────────────────────────────────────────────────────────
MODULES: dict[str, dict] = {
    "HR":           {"name": "Human Resources",     "ordering": 1},
    "INVENTORY":    {"name": "Inventory Management","ordering": 2},
    "FINANCE":      {"name": "Finance",             "ordering": 3},
    "SALES":        {"name": "Sales",               "ordering": 4},
    "AI_MONITORING":{"name": "AI Monitoring",       "ordering": 5},
    "NOTIFICATIONS":{"name": "Notifications",       "ordering": 6},
    "SETTINGS":     {"name": "System Settings",     "ordering": 7},
}

# ─────────────────────────────────────────────────────────────────────────────
# Resources + per-resource actions
# Format: "resource_code": ["action1", "action2", ...]
# ─────────────────────────────────────────────────────────────────────────────
RESOURCES_ACTIONS: dict[str, dict[str, list[str]]] = {

    # ── Human Resources ──────────────────────────────────────────────────────
    "HR": {
        "dashboard":            ["view", "export"],
        "employee":             ["view", "create", "update", "delete", "activate", "deactivate", "export"],
        "payroll":              ["view", "pay_salary", "export"],
        "attendance":           ["view", "export"],
        "leave":                ["view", "create", "approve", "reject", "export"],
        "shift_override":       ["view", "schedule", "export"],
        "shift_template":       ["view", "create", "update", "delete", "export"],
        "emp_asset":            ["view", "create", "update", "delete", "export"],
        "asset_kit":            ["view", "create", "update", "delete", "export"],
        "asset_assignment":     ["view", "assign", "return", "export"],
        "performance":          ["view", "export"],
        "recruitment":          ["view", "create", "update_round", "export"],
        "exit":                 ["view", "create", "update_checklist", "export"],
        "policy":               ["view", "create", "update", "delete", "export"],
        "compensation":         [
            "view_compensation", "view_loan",
            "create_compensation", "create_loan",
            "update_compensation_status", "update_loan_status",
            "update_compensation", "delete_compensation",
            "update_loan", "delete_loan",
            "export",
        ],
    },

    # ── Inventory ────────────────────────────────────────────────────────────
    "INVENTORY": {
        "dashboard":        ["view", "export"],
        "category":         ["view", "create", "update", "delete", "export"],
        "brand":            ["view", "create", "update", "delete", "export"],
        "product":          ["view", "create", "update", "delete", "export"],
        "stock":            ["view", "adjust", "export"],
        "warehouse":        ["view", "create", "update", "delete", "export"],
        "purchase_order":   ["view", "create", "confirm", "receive_goods", "export"],
        "supplier":         ["view", "create", "update", "delete", "export"],
        "vendor":           ["view", "create", "update", "delete", "export"],
        "stock_transfer":   ["view", "create", "confirm", "export"],
        "barcode":          ["view", "export"],
        "report":           ["view", "export"],
        "alert":            ["view", "export"],
        "customer":         ["view", "create", "update", "delete", "export"],
        "sales_order":      ["view", "create", "update", "delete", "complete_sale", "hold_sale", "return", "export"],
        "audit_log":        ["view", "export"],
    },

    # ── Finance ──────────────────────────────────────────────────────────────
    "FINANCE": {
        "dashboard":        ["view", "export"],
        "account":          ["view", "create", "update", "delete", "export"],
        "customer_invoice": ["view", "create", "pay", "update", "delete", "export"],
        "expense":          ["view", "create", "pay", "update", "delete", "export"],
        "journal_entrie":   ["view", "export"],
        "finance_reports":  ["view", "export"],
        "budget":           ["view", "create", "update", "delete", "export"],
        "bank_account":     ["view", "create", "update", "delete", "export"],
        "bank_transaction": ["view", "create", "update", "delete", "export"],
        "supplier_bill":    ["view",  "pay", "export"],
        "payment":          ["view", "export"],
        "tax":              ["view", "create", "update", "delete", "export"],
        "audit_log":        ["view", "export"],
        "forecast":         ["view", "create", "recompute_sales", "recompute_stock", "export"],
    },

    # ── Sales ────────────────────────────────────────────────────────────────
    "SALES": {
        "dashboard":              ["view", "export"],
        "lead":                   ["view", "create", "update", "delete", "accept", "convert_to_quote", "export"],
        "quote":                  ["view", "approve", "reject", "update", "delete", "export"],
        "sales_customer":         ["view", "create", "update", "delete", "export"],
        "sales_customers_invoice":["view", "create", "pay", "update", "delete", "export"],
    },

    # ── AI Monitoring ────────────────────────────────────────────────────────
    "AI_MONITORING": {
        "live_dashboard":   ["view", "export"],
        "workforce":        ["view", "export"],
        "inventory":        ["view", "export"],
        "alert":            ["view", "export"],
        "report":           ["view", "export"],
        "activity":         ["view", "export"],
    },

    # ── Settings ─────────────────────────────────────────────────────────────
    "SETTINGS": {
        "company":      ["view", "update", "export"],
        "branch":       ["view", "create", "update", "delete", "export"],
        "user":         ["view", "create", "update", "delete", "export"],
        "permissions":  ["view", "update", "export"],
        "department":   ["view", "create", "update", "delete", "export"],
        "designation":  ["view", "create", "update", "delete", "export"],
        "role":         ["view", "create", "update", "delete", "export"],
        "preference":   ["view", "update", "export"],
        "dashboard":    ["view", "export"],
    },

    # ── Notifications ─────────────────────────────────────────────────────────
    "NOTIFICATIONS": {
        "notification": ["view", "create", "update", "delete", "export"],
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# All unique action codes (collected from RESOURCES_ACTIONS)
# ─────────────────────────────────────────────────────────────────────────────
ALL_ACTION_CODES: set[str] = set()
for _module_resources in RESOURCES_ACTIONS.values():
    for _actions in _module_resources.values():
        ALL_ACTION_CODES.update(_actions)

ACTION_DISPLAY_NAMES: dict[str, str] = {
    # Standard CRUD
    "view":                   "View",
    "create":                 "Create",
    "update":                 "Update",
    "delete":                 "Delete",
    # HR-specific
    "activate":               "Activate",
    "deactivate":             "Deactivate",
    "pay_salary":             "Pay Salary",
    "approve":                "Approve",
    "reject":                 "Reject",
    "schedule":               "Schedule",
    "assign":                 "Assign",
    "return":                 "Return",
    "update_round":           "Update Round",
    "update_checklist":       "Update Checklist",
    "view_compensation":      "View Compensation",
    "view_loan":              "View Loan",
    "create_compensation":    "Create Compensation",
    "create_loan":            "Create Loan",
    "update_compensation_status": "Update Compensation Status",
    "update_loan_status":     "Update Loan Status",
    "update_compensation":    "Update Compensation",
    "delete_compensation":    "Delete Compensation",
    "update_loan":            "Update Loan",
    "delete_loan":            "Delete Loan",
    # Inventory-specific
    "adjust":                 "Adjust",
    "confirm":                "Confirm",
    "receive_goods":          "Receive Goods",
    "complete_sale":          "Complete Sale",
    "hold_sale":              "Hold Sale",
    # Finance-specific
    "pay":                    "Pay",
    "recompute_sales":        "Recompute Sales",
    "recompute_stock":        "Recompute Stock",
    # Sales-specific
    "accept":                 "Accept",
    "convert_to_quote":       "Convert to Quote",
    # Generic
    "export":   "Export",
    "publish":  "Publish",
    "archive":  "Archive",
}


# ─────────────────────────────────────────────────────────────────────────────
# Role definitions  (module → list-of-resource:action or ['*'])
# ─────────────────────────────────────────────────────────────────────────────
ROLE_PERMISSIONS: dict[str, dict[str, list[str]]] = {
    "COMPANY_ADMIN": {
        "HR":           ["*"],
        "INVENTORY":    ["*"],
        "FINANCE":      ["*"],
        "SALES":        ["*"],
        "AI_MONITORING":["*"],
        "NOTIFICATIONS":["*"],
        "SETTINGS":     ["*"],
    },
    "BRANCH_ADMIN": {},
    "STAFF": {},
}


# ─────────────────────────────────────────────────────────────────────────────
# Command
# ─────────────────────────────────────────────────────────────────────────────
class Command(BaseCommand):
    help = "Seed modules, resources, actions, permissions, and role permissions (idempotent)"

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Seeding permissions …")

        # 1. Modules
        module_objs: dict[str, Module] = {}
        for code, data in MODULES.items():
            obj, created = Module.objects.update_or_create(
                code=code,
                defaults={
                    "name": data["name"],
                    "ordering": data.get("ordering", 0),
                    "is_active": True,
                },
            )
            module_objs[code] = obj
            self.stdout.write(f"  {'Created' if created else 'Updated'} module: {code}")

        # 2. Actions  (union of all action codes across all resources)
        action_objs: dict[str, Action] = {}
        for code in sorted(ALL_ACTION_CODES):
            name = ACTION_DISPLAY_NAMES.get(code, code.replace("_", " ").title())
            obj, _ = Action.objects.update_or_create(
                code=code,
                defaults={"name": name},
            )
            action_objs[code] = obj

        # 3. Resources + Permissions
        # permission_map: "MODULE:resource:action" → Permission instance
        permission_map: dict[str, Permission] = {}

        for module_code, resources in RESOURCES_ACTIONS.items():
            module = module_objs[module_code]
            for resource_code, action_codes in resources.items():
                resource_obj, _ = Resource.objects.update_or_create(
                    module=module,
                    code=resource_code,
                    defaults={
                        "name": resource_code.replace("_", " ").title(),
                        "is_active": True,
                    },
                )
                for action_code in action_codes:
                    perm_code = f"{module_code}:{resource_code}:{action_code}"
                    perm, created = Permission.objects.update_or_create(
                        resource=resource_obj,
                        action=action_objs[action_code],
                        defaults={
                            "code": perm_code,
                            "description": f"{resource_code.replace('_',' ').title()} – {action_code.replace('_',' ').title()}",
                        },
                    )
                    permission_map[perm_code] = perm
                    if created:
                        self.stdout.write(f"    + {perm_code}")

        # 4. Roles
        role_objs: dict[str, Role] = {}
        for role_name in ROLE_PERMISSIONS:
            role, created = Role.objects.update_or_create(
                name=role_name,
                defaults={"description": f"{role_name} role", "is_system": True},
            )
            role_objs[role_name] = role
            self.stdout.write(f"  {'Created' if created else 'Updated'} role: {role_name}")

        # 5. Role permissions  (rebuild from scratch — idempotent)
        RolePermission.objects.all().delete()
        grand_total = 0

        for role_name, module_perms in ROLE_PERMISSIONS.items():
            role = role_objs[role_name]
            count = 0
            bulk = []

            for module_code, patterns in module_perms.items():
                if patterns == ["*"]:
                    for perm in Permission.objects.filter(resource__module__code=module_code):
                        bulk.append(RolePermission(role=role, permission=perm, granted=True))
                        count += 1
                else:
                    for pattern in patterns:
                        if ":" not in pattern:
                            self.stdout.write(
                                self.style.WARNING(f"  Invalid pattern '{pattern}' — skipped")
                            )
                            continue
                        resource_code, action_code = pattern.split(":", 1)
                        perm_code = f"{module_code}:{resource_code}:{action_code}"
                        perm = permission_map.get(perm_code)
                        if perm:
                            bulk.append(RolePermission(role=role, permission=perm, granted=True))
                            count += 1
                        else:
                            self.stdout.write(
                                self.style.WARNING(f"  Permission not found: {perm_code}")
                            )

            RolePermission.objects.bulk_create(bulk, ignore_conflicts=True)
            self.stdout.write(f"  Assigned {count} permissions to {role_name}")
            grand_total += count

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone — "
                f"{Module.objects.count()} modules, "
                f"{Resource.objects.count()} resources, "
                f"{Action.objects.count()} actions, "
                f"{Permission.objects.count()} permissions, "
                f"{Role.objects.count()} roles, "
                f"{grand_total} role-permissions"
            )
        )