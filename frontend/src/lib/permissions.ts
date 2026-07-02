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
    dashboard:        ["view", "export"]                                                           as const,
    employee:         ["view","create","update","delete","activate","deactivate", "export"]        as const,
    payroll:          ["view","pay_salary","update_loan","delete_loan","update_loan_status","approve_loan","pay_loan","export"] as const,
    attendance:       ["view", "export"]                                                           as const,
    leave:            ["view","create","approve","reject", "export"]                               as const,
    shift_override:   ["view","schedule", "export"]                                                as const,
    shift_template:   ["view","create","update","delete", "export"]                                as const,
    emp_asset:        ["view","create","update","delete", "export"]                                as const,
    asset_kit:        ["view","create","update","delete", "export"]                                as const,
    asset_assignment: ["view","assign","return", "export"]                                         as const,
    performance:      ["view", "export"]                                                           as const,
    recruitment:      ["view","create","update_round", "export"]                                   as const,
    exit:             ["view","create","update","update_status", "export"]    as const,
    policy:           ["view","create","update","delete", "export"]                                as const,
    compensation:     [
      "view_compensation","view_loan",
      "create_compensation","create_loan",
      "update_compensation_status","update_loan_status",
      "update_compensation","delete_compensation",
      "update_loan","delete_loan",
      "approve_loan","pay_loan",
      "export",
    ] as const,
  },

  // ── Inventory ─────────────────────────────────────────────────────────────
  INVENTORY: {
    dashboard:      ["view", "export"]                                          as const,
    category:       ["view","create","update","delete", "export"]               as const,
    brand:          ["view","create","update","delete", "export"]               as const,
    product:        ["view","create","update","delete", "export"]               as const,
    stock:          ["view","adjust", "export"]                                 as const,
    warehouse:      ["view","create","update","delete", "export"]               as const,
    purchase_order: ["view","create","confirm","receive_goods", "export"]       as const,
    supplier:       ["view","create","update","delete", "export"]               as const,
    stock_transfer: ["view","create","confirm", "export"]                       as const,
    barcode:        ["view", "export"]                                          as const,
    report:         ["view", "export"]                                          as const,
    alert:          ["view", "export"]                                          as const,
    customer:       ["view","create","update","delete", "export"]               as const,
    sales_order:    ["view","create","update","delete","complete_sale","hold_sale","return", "export"] as const,
    vendor:         ["view","create","update","delete", "export"]               as const,
    audit_log:      ["view", "export"]                                          as const,
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  FINANCE: {
    dashboard:        ["view", "export"]                                        as const,
    account:          ["view","create","update","delete", "export"]             as const,
    customer_invoice: ["view","create","pay","update","delete","send", "export"]       as const,
    expense:          ["view","create","pay","update","delete", "export"]       as const,
    journal_entrie:   ["view", "export"]                                        as const,
    finance_reports:  ["view", "export"]                                        as const,
    budget:           ["view","create","update","delete", "export"]             as const,
    bank_account:     ["view","create","update","delete", "export"]             as const,
    bank_transaction: ["view","create","update","delete", "export"]             as const,
    supplier_bill:    ["view","pay", "export"]                                  as const,
    payment:          ["view", "export"]                                        as const,
    tax:              ["view","create","update","delete", "export"]             as const,
    audit_log:        ["view", "export"]                                        as const,
    forecast:         ["view","create","recompute_sales","recompute_stock", "export"] as const,
  },

  // ── Sales ─────────────────────────────────────────────────────────────────
  SALES: {
    dashboard:              ["view", "export"]                                          as const,
    lead:                   ["view","create","update","delete","accept","convert_to_quote", "export"] as const,
    quote:                  ["view","create","approve","reject","update","delete", "export"]     as const,
    sales_customer:         ["view","create","update","delete", "export"]               as const,
    sales_customers_invoice:["view","create","pay","update","delete","send", "export"]         as const,
  },

  // ── AI Monitoring ─────────────────────────────────────────────────────────
  AI_MONITORING: {
    live_dashboard: ["view", "export"] as const,
    workforce:      ["view", "export"] as const,
    inventory:      ["view", "export"] as const,
    alert:          ["view", "export"] as const,
    report:         ["view", "export"] as const,
    activity:       ["view", "export"] as const,
    site:           ["view", "create", "update", "delete", "export"] as const,
    nvr:            ["view", "create", "update", "delete", "export"] as const,
    camera:         ["view", "create", "update", "delete", "export"] as const,
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  SETTINGS: {
    company:     ["view","update", "export"]                       as const,
    branch:      ["view","create","update","delete", "export"]     as const,
    user:        ["view","create","update","delete", "export"]     as const,
    permissions: ["view","update", "export"]                       as const,
    department:  ["view", "create", "update", "delete", "export"]  as const,
    designation: ["view","create","update","delete", "export"]     as const,
    role:        ["view","create","update","delete", "export"]     as const,
    preference:  ["view","update", "export"]                       as const,
    dashboard:   ["view", "export"]                                as const,
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  NOTIFICATIONS: {
    notification: ["view","create","update","delete", "export"]    as const,
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