/**
 * lib/permissions.ts
 *
 * Single source of truth for:
 *   1. Every permission code in the system  (mirrors seed_permissions.py)
 *   2. `getPermissions()`  — extract typed action-map from the Redux store
 *   3. `hasPermission()`   — low-level boolean check
 *   4. `useHasPermission()` — React hook for a single code
 *
 * Usage examples:
 *
 *   // In a page / component
 *   const p = useFeaturePermissions("HR", "employee");
 *   if (p.create) { ... }
 *
 *   // One-shot boolean
 *   const can = useHasPermission("INVENTORY:product:delete");
 *
 *   // In a guard / util (non-hook)
 *   const can = hasPermission(permissionsArray, "FINANCE:payment:pay");
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Generic bag of boolean flags returned by getPermissions(). */
export type PermissionActions = Record<string, boolean>;

// ─── Master permission registry ───────────────────────────────────────────────
//
// Every entry is:  "<MODULE>:<resource>:<action>"
// Keep this in sync with seed_permissions.py → RESOURCES_ACTIONS.
// ─────────────────────────────────────────────────────────────────────────────

export const PERMISSIONS = {
  // ── HR ────────────────────────────────────────────────────────────────────
  HR: {
    dashboard:        ["view"]                                                                    as const,
    employee:         ["view","create","update","delete","activate","deactivate"]                 as const,
    payroll:          ["view","pay_salary"]                                                        as const,
    attendance:       ["view"]                                                                    as const,
    leave:            ["view","create","approve","reject"]                                        as const,
    shift_override:   ["view","schedule"]                                                         as const,
    shift_template:   ["view","create","update","delete"]                                         as const,
    emp_asset:        ["view","create","update","delete"]                                         as const,
    asset_kit:        ["view","create","update","delete"]                                         as const,
    asset_assignment: ["view","assign","return"]                                                  as const,
    performance:      ["view"]                                                                    as const,
    recruitment:      ["view","create","update_round"]                                            as const,
    exit:             ["view","create","update_checklist"]                                        as const,
    policy:           ["view","create","update","delete"]                                         as const,
    compensation:     [
      "view_compensation","view_loan",
      "create_compensation","create_loan",
      "update_compensation_status","update_loan_status",
      "update_compensation","delete_compensation",
      "update_loan","delete_loan",
    ] as const,
  },

  // ── Inventory ─────────────────────────────────────────────────────────────
  INVENTORY: {
    dashboard:      ["view"]                                          as const,
    category:       ["view","create","update","delete"]               as const,
    brand:          ["view","create","update","delete"]               as const,
    product:        ["view","create","update","delete"]               as const,
    stock:          ["view","adjust"]                                 as const,
    warehouse:      ["view","create","update","delete"]               as const,
    purchase_order: ["view","create","confirm","receive_goods"]       as const,
    supplier:       ["view","create","update","delete"]               as const,
    stock_transfer: ["view","create","confirm"]                       as const,
    barcode:        ["view"]                                          as const,
    report:         ["view"]                                          as const,
    alert:          ["view"]                                          as const,
    customer:       ["view","create","update","delete"]               as const,
    sales_order:    ["view","create","update","delete","complete_sale","hold_sale","return"] as const,
    vendor:         ["view","create","update","delete"]               as const,
    audit_log:      ["view"]                                          as const,
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  FINANCE: {
    dashboard:        ["view"]                                        as const,
    account:          ["view","create","update","delete"]             as const,
    customer_invoice: ["view","create","pay","update","delete"]       as const,
    expense:          ["view","create","pay","update","delete"]       as const,
    journal_entrie:   ["view"]                                        as const,
    finance_reports:  ["view"]                                        as const,
    budget:           ["view","create","update","delete"]             as const,
    bank_account:     ["view","create","update","delete"]             as const,
    bank_transaction: ["view","create","update","delete"]             as const,
    supplier_bill:    ["view","pay"]                                  as const,
    payment:          ["view"]                                        as const,
    tax:              ["view","create","update","delete"]             as const,
    audit_log:        ["view"]                                        as const,
    forecast:         ["view","create","recompute_sales","recompute_stock"] as const,
  },

  // ── Sales ─────────────────────────────────────────────────────────────────
  SALES: {
    dashboard:              ["view"]                                          as const,
    lead:                   ["view","create","update","delete","accept","convert_to_quote"] as const,
    quote:                  ["view","approve","reject","update","delete"]     as const,
    sales_customer:         ["view","create","update","delete"]               as const,
    sales_customers_invoice:["view","create","pay","update","delete"]         as const,
  },

  // ── AI Monitoring ─────────────────────────────────────────────────────────
  AI_MONITORING: {
    live_dashboard: ["view"] as const,
    workforce:      ["view"] as const,
    inventory:      ["view"] as const,
    alert:          ["view"] as const,
    report:         ["view"] as const,
    activity:       ["view"] as const,
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  SETTINGS: {
    company:     ["view","update"]                       as const,
    branch:      ["view","create","update","delete"]     as const,
    user:        ["view","create","update","delete"]     as const,
    permissions: ["view","update"]                       as const,
    department:  ["view", "create", "update", "delete"]  as const,
    designation: ["view","create","update","delete"]     as const,
    role:        ["view","create","update","delete"]     as const,
    preference:  ["view","update"]                       as const,
    dashboard:   ["view"]                                as const,
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  NOTIFICATIONS: {
    notification: ["view","create","update","delete"]    as const,
  },
} as const;

// ─── Helper types ─────────────────────────────────────────────────────────────

type Module   = keyof typeof PERMISSIONS;
type Resource<M extends Module> = keyof (typeof PERMISSIONS)[M];

// ─── Core utilities ───────────────────────────────────────────────────────────

/**
 * Low-level boolean check — does `permissions` array contain `code`?
 *
 * @example
 *   hasPermission(store.permissions, "HR:employee:create")
 */
export function hasPermission(permissions: string[], code: string): boolean {
  return permissions.includes(code);
}

/**
 * Build a full code string at call-site, useful for computed checks.
 *
 * @example
 *   buildCode("HR", "employee", "activate")  // "HR:employee:activate"
 */
export function buildCode(module: string, resource: string, action: string): string {
  return `${module}:${resource}:${action}`;
}

/**
 * Given the flat `permissions` array from Redux, return a typed object
 * mapping every declared action for `module:resource` to a boolean.
 *
 * Falls back gracefully: if `module` or `resource` is not in the registry,
 * returns an empty object (all `false` by convention).
 *
 * @example
 *   const p = getPermissions(state.permissions.permissions, "HR", "employee");
 *   if (p.create) { ... }
 *   if (p.activate) { ... }
 */
export function getPermissions(
  permissions: string[],
  module: string,
  resource: string,
): PermissionActions {
  const moduleRegistry = (PERMISSIONS as Record<string, Record<string, readonly string[]>>)[module];
  if (!moduleRegistry) return {};

  const actions = moduleRegistry[resource];
  if (!actions) return {};

  const result: PermissionActions = {};
  for (const action of actions) {
    result[action] = permissions.includes(`${module}:${resource}:${action}`);
  }
  return result;
}

/**
 * Check if the user has ALL of the supplied codes.
 */
export function hasAllPermissions(permissions: string[], codes: string[]): boolean {
  return codes.every(c => permissions.includes(c));
}

/**
 * Check if the user has ANY of the supplied codes.
 */
export function hasAnyPermission(permissions: string[], codes: string[]): boolean {
  return codes.some(c => permissions.includes(c));
}