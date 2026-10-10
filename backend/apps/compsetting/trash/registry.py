"""Trash registry — which soft-deleted models appear in Settings → Trash.

Every entry here is a model that carries ``is_deleted`` / ``deleted_at`` (from
``apps.common.basemodel.BaseModel``) and represents something a user deleted
from the UI.

How to add a new trash type
---------------------------
1. Make sure the model inherits ``BaseModel`` and its view soft-deletes (never
   hard-deletes) rows.
2. Append a ``TrashModel`` below. ``label_fields`` are rendered in order as the
   entry's display name. Each entry is either a plain attribute, a Django
   relation path (``"category__name"``), or the name of a zero-argument method
   (``"full_name"``) — all resolved defensively.
3. ``module`` / ``resource`` give the *cross-module* RBAC fallback
   (``<MODULE>:<resource>:delete``) so an Inventory admin can see inventory
   trash without holding the Settings Trash permission.

Unregistered models are never listed and are never auto-purged.
"""
from __future__ import annotations

from dataclasses import dataclass, field as dataclass_field
from typing import Any, Sequence

from django.apps import apps


@dataclass(frozen=True)
class TrashModel:
    """Metadata describing one trash-eligible model."""

    model_label: str          # "inventory.Product"
    key: str                  # stable API key, e.g. "product"
    label: str                # human group label, e.g. "Product"
    group: str                # module grouping, e.g. "Inventory"
    resource: str             # RBAC resource for the cross-module fallback
    module: str               # RBAC module for the cross-module fallback
    label_fields: Sequence[str] = dataclass_field(default_factory=tuple)

    @property
    def model(self):
        return apps.get_model(self.model_label)


TRASH_MODELS: tuple[TrashModel, ...] = (
    # ── Settings ────────────────────────────────────────────────────────────
    TrashModel('organization.User', 'user', 'User', 'Settings', 'user', 'SETTINGS',
               ('full_name', 'email')),
    TrashModel('organization.Department', 'department', 'Department', 'Settings',
               'department', 'SETTINGS', ('name', 'code')),
    TrashModel('compsetting.Designation', 'designation', 'Designation', 'Settings',
               'designation', 'SETTINGS', ('name',)),
    TrashModel('compsetting.PublicHoliday', 'public_holiday', 'Public Holiday',
               'Settings', 'preference', 'SETTINGS', ('name',)),
    TrashModel('compsetting.TermsAndCondition', 'terms', 'Terms & Conditions',
               'Settings', 'terms', 'SETTINGS', ('type',)),

    # ── Inventory ───────────────────────────────────────────────────────────
    TrashModel('inventory.Category', 'category', 'Category', 'Inventory',
               'category', 'INVENTORY', ('name', 'code')),
    TrashModel('inventory.Brand', 'brand', 'Brand', 'Inventory',
               'brand', 'INVENTORY', ('name', 'code')),
    TrashModel('inventory.Warehouse', 'warehouse', 'Warehouse', 'Inventory',
               'warehouse', 'INVENTORY', ('warehouse_name', 'code')),
    TrashModel('inventory.Supplier', 'supplier', 'Supplier', 'Inventory',
               'supplier', 'INVENTORY', ('name', 'code')),
    TrashModel('inventory.Customer', 'customer', 'Customer', 'Inventory',
               'customer', 'INVENTORY', ('name', 'customer_code')),
    TrashModel('inventory.Product', 'product', 'Product', 'Inventory',
               'product', 'INVENTORY', ('product_name', 'category__name')),

    # ── Finance ─────────────────────────────────────────────────────────────
    TrashModel('finance.Account', 'account', 'Account', 'Finance',
               'account', 'FINANCE', ('name', 'code')),
    TrashModel('finance.CustomerInvoice', 'customer_invoice', 'Customer Invoice',
               'Finance', 'customer_invoice', 'FINANCE', ('invoice_number',)),
    TrashModel('finance.SupplierBill', 'supplier_bill', 'Supplier Bill', 'Finance',
               'supplier_bill', 'FINANCE', ('bill_number',)),
    TrashModel('finance.Expense', 'expense', 'Expense', 'Finance',
               'expense', 'FINANCE', ('expense_number', 'description')),
    TrashModel('finance.Budget', 'budget', 'Budget', 'Finance',
               'budget', 'FINANCE', ('notes', 'year')),
    TrashModel('finance.BankAccount', 'bank_account', 'Bank Account', 'Finance',
               'bank_account', 'FINANCE', ('account_name', 'account_number')),
    TrashModel('finance.JournalEntry', 'journal_entry', 'Journal Entry', 'Finance',
               'journal_entrie', 'FINANCE', ('entry_number', 'description')),

    # ── Sales ───────────────────────────────────────────────────────────────
    TrashModel('sales.Lead', 'lead', 'Lead', 'Sales', 'lead', 'SALES',
               ('title', 'company_name')),
    TrashModel('sales.Quote', 'quote', 'Quote', 'Sales', 'quote', 'SALES',
               ('quote_number',)),

    # ── HR ──────────────────────────────────────────────────────────────────
    TrashModel('hr.Employee', 'employee', 'Employee', 'Human Resources',
               'employee', 'HR', ('employee_id', 'first_name', 'last_name')),
    TrashModel('hr.LeaveRequest', 'leave', 'Leave Request', 'Human Resources',
               'leave', 'HR', ('leave_type', 'reason')),
    TrashModel('hr.Policy', 'policy', 'Policy', 'Human Resources',
               'policy', 'HR', ('title', 'code')),
    TrashModel('hr.Asset', 'asset', 'Asset', 'Human Resources',
               'emp_asset', 'HR', ('name', 'serial_number')),
    TrashModel('hr.AssetCategory', 'asset_category', 'Asset Category',
               'Human Resources', 'emp_asset', 'HR', ('name',)),
    TrashModel('hr.ShiftTemplate', 'shift_template', 'Shift Template',
               'Human Resources', 'shift_template', 'HR', ('name',)),
    TrashModel('hr.ExitRecord', 'exit', 'Exit Record', 'Human Resources',
               'exit', 'HR', ('employee_name', 'status')),
)


TRASH_BY_KEY: dict[str, TrashModel] = {tm.key: tm for tm in TRASH_MODELS}


def get_trash_model(key: str) -> TrashModel | None:
    """Resolve a registry entry by its API key."""
    return TRASH_BY_KEY.get((key or '').strip().lower())


def registry_keys() -> list[str]:
    return [tm.key for tm in TRASH_MODELS]


def _resolve(obj: Any, path: str) -> Any:
    """Resolve ``a__b`` / zero-arg method / attribute without ever raising."""
    value = obj
    for part in path.split('__'):
        if value is None:
            return None
        try:
            value = getattr(value, part)
        except Exception:
            return None
        if callable(value):
            try:
                value = value()
            except Exception:
                return None
    return value


def build_display_name(tm: TrashModel, obj: Any, max_length: int = 160) -> str:
    """Best-effort human label for a deleted row."""
    parts: list[str] = []
    for path in tm.label_fields:
        raw = _resolve(obj, path)
        if raw is None or raw == '':
            continue
        text = str(raw).strip()
        if not text or text in parts:
            continue
        parts.append(text)
        if len(' '.join(parts)) >= max_length:
            break

    if not parts:
        return f'{tm.label} {str(getattr(obj, "_id", ""))[:8]}'

    name = ' · '.join(parts)
    return name[:max_length]
