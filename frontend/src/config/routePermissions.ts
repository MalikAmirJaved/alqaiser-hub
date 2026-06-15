/**
 * config/routePermissions.ts
 *
 * Route  → permission code   (for middleware / page-level guards)
 * Menu title → permission code  (for sidebar filtering)
 *
 * All codes mirror seed_permissions.py → RESOURCES_ACTIONS.
 */

// ─── Route → Permission ───────────────────────────────────────────────────────

export const routePermissions: Record<string, string> = {
  // HR
  "/hr/employees":              "HR:employee:view",
  "/hr/payroll":                "HR:payroll:view",
  "/hr/attendance":             "HR:attendance:view",
  "/hr/leave":                  "HR:leave:view",
  "/hr/shifts/list":            "HR:shift_override:view",
  "/hr/shifts/templates":       "HR:shift_template:view",
  "/hr/assets/list":            "HR:emp_asset:view",
  "/hr/assets/kits":            "HR:asset_kit:view",
  "/hr/assets/employee-assets": "HR:asset_assignment:view",
  "/hr/performance":            "HR:performance:view",
  "/hr/recruitment":            "HR:recruitment:view",
  "/hr/exit":                   "HR:exit:view",
  "/hr/exit/[id]":              "HR:exit:view",
  "/hr/salary":                 "HR:payroll:view",
  "/hr/policies":               "HR:policy:view",
  "/hr/compensation":           "HR:compensation:view_compensation",

  // Inventory
  "/inventory/dashboard":   "INVENTORY:dashboard:view",
  "/inventory/categories":  "INVENTORY:category:view",
  "/inventory/brands":      "INVENTORY:brand:view",
  "/inventory/products":    "INVENTORY:product:view",
  "/inventory/stock":       "INVENTORY:stock:view",
  "/inventory/warehouses":  "INVENTORY:warehouse:view",
  "/inventory/purchases":   "INVENTORY:purchase_order:view",
  "/inventory/suppliers":   "INVENTORY:supplier:view",
  "/inventory/transfers":   "INVENTORY:stock_transfer:view",
  "/inventory/barcode":     "INVENTORY:barcode:view",
  "/inventory/reports":     "INVENTORY:report:view",
  "/inventory/alerts":      "INVENTORY:alert:view",
  "/inventory/customers":   "INVENTORY:customer:view",
  "/inventory/pos":         "INVENTORY:sales_order:view",
  "/inventory/audit":       "INVENTORY:audit_log:view",

  // Sales
  "/sales/dashboard":         "SALES:dashboard:view",
  "/sales/leads":             "SALES:lead:view",
  "/sales/quotes":            "SALES:quote:view",
  "/sales/customers":         "SALES:sales_customer:view",
  "/sales/customer-invoices": "SALES:sales_customers_invoice:view",

  // Finance
  "/finance/dashboard":       "FINANCE:dashboard:view",
  "/finance/accounts":        "FINANCE:account:view",
  "/finance/customer-invoices":"FINANCE:customer_invoice:view",
  "/finance/journal-entries": "FINANCE:journal_entrie:view",
  "/finance/reports":         "FINANCE:finance_reports:view",
  "/finance/expenses":        "FINANCE:expense:view",
  "/finance/budgets":         "FINANCE:budget:view",
  "/finance/bank-accounts":   "FINANCE:bank_account:view",
  "/finance/bank-transactions":"FINANCE:bank_transaction:view",
  "/finance/supplier-bills":  "FINANCE:supplier_bill:view",
  "/finance/payments":        "FINANCE:payment:view",
  "/finance/payroll":         "FINANCE:forecast:view",       // finance payroll — adjust if separate resource added
  "/finance/taxes":           "FINANCE:tax:view",
  "/finance/audit":           "FINANCE:audit_log:view",
  "/finance/forecast":        "FINANCE:forecast:view",

  // AI Monitoring
  "/monitoring/dashboard":           "AI_MONITORING:live_dashboard:view",
  "/monitoring/activity-tracking":   "AI_MONITORING:activity:view",
  "/monitoring/inventory-monitoring":"AI_MONITORING:inventory:view",
  "/monitoring/workforce-monitoring":"AI_MONITORING:workforce:view",
  "/monitoring/alerts-events":       "AI_MONITORING:alert:view",
  "/monitoring/reports-insights":    "AI_MONITORING:report:view",

  // Settings
  "/settings/company":      "SETTINGS:company:view",
  "/settings/users":        "SETTINGS:user:view",
  "/settings/departments":  "SETTINGS:department:view",
  "/settings/designations": "SETTINGS:designation:view",
  "/settings/preferences":  "SETTINGS:preference:view",
  "/settings/permissions":  "SETTINGS:permissions:view",
};

// ─── Menu title → Permission ──────────────────────────────────────────────────

export const menuPermissionMapping: Record<string, string | null> = {
  // Always visible
  Dashboard: null,

  // HR
  "Employee Management":  "HR:employee:view",
  "Payroll":              "HR:payroll:view",
  "Time & Attendance":    "HR:attendance:view",
  "Leave Management":     "HR:leave:view",
  "Performance":          "HR:performance:view",
  "Recruitment":          "HR:recruitment:view",
  "Exit Management":      "HR:exit:view",
  "HR Policies":          "HR:policy:view",
  "Compensation & Loan":  "HR:compensation:view_compensation",
  "Shifts":               "HR:shift_override:view",
  "Shift Templates":      "HR:shift_template:view",
  "Assets":               "HR:emp_asset:view",
  "Asset Kits":           "HR:asset_kit:view",
  "Employee Assignments": "HR:asset_assignment:view",

  // Inventory
  "Inventory Dashboard":  "INVENTORY:dashboard:view",
  "Categories":           "INVENTORY:category:view",
  "Brands":               "INVENTORY:brand:view",
  "Product Management":   "INVENTORY:product:view",
  "Stock Management":     "INVENTORY:stock:view",
  "Warehouse Management": "INVENTORY:warehouse:view",
  "Purchase Management":  "INVENTORY:purchase_order:view",
  "Suppliers & Vendors":  "INVENTORY:supplier:view",
  "Inventory Transfers":  "INVENTORY:stock_transfer:view",
  "Barcode & QR":         "INVENTORY:barcode:view",
  "Reports":              "INVENTORY:report:view",
  "Alerts":               "INVENTORY:alert:view",
  "Customers":            "INVENTORY:customer:view",
  "Selling / POS":        "INVENTORY:sales_order:view",
  "Inventoy Audit Logs":  "INVENTORY:audit_log:view",

  // Sales
  "Sales Dashboard":    "SALES:dashboard:view",
  "Leads":              "SALES:lead:view",
  "Quotes":             "SALES:quote:view",
  "Sales Customers":    "SALES:sales_customer:view",
  "Sales Invoices":     "SALES:sales_customers_invoice:view",

  // Finance
  "Finance Dashboard":        "FINANCE:dashboard:view",
  "Accounts":                 "FINANCE:account:view",
  "Customer Invoice":         "FINANCE:customer_invoice:view",
  "Expenses":                 "FINANCE:expense:view",
  "Budgets":                  "FINANCE:budget:view",
  "Bank Accounts":            "FINANCE:bank_account:view",
  "Bank Transaction":         "FINANCE:bank_transaction:view",
  "Payables / Supplier Bills":"FINANCE:supplier_bill:view",
  "Journal Entries":          "FINANCE:journal_entrie:view",
  "Finance Reports":          "FINANCE:finance_reports:view",
  "Payments":                 "FINANCE:payment:view",
  "Finance Payroll":          "FINANCE:forecast:view",
  "Taxes":                    "FINANCE:tax:view",
  "Forecast":                 "FINANCE:forecast:view",
  "Finance Audit Logs":       "FINANCE:audit_log:view",

  // AI Monitoring
  "Live Dashboard":       "AI_MONITORING:live_dashboard:view",
  "Activity Tracking":    "AI_MONITORING:activity:view",
  "Inventory Monitoring": "AI_MONITORING:inventory:view",
  "Workforce Monitoring": "AI_MONITORING:workforce:view",
  "Alerts & Events":      "AI_MONITORING:alert:view",
  "Reports & Insights":   "AI_MONITORING:report:view",

  // Settings
  "Company Profile": "SETTINGS:company:view",
  "Users & Roles":   "SETTINGS:user:view",
  "Departments":     "SETTINGS:department:view",
  "Designations":    "SETTINGS:designation:view",
  "Preferences":     "SETTINGS:preference:view",
  "Permissions":     "SETTINGS:permissions:view",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Exact match, then prefix match for nested routes like /hr/employees/123. */
export function getRequiredPermission(path: string): string | null {
  if (routePermissions[path]) return routePermissions[path];
  const key = Object.keys(routePermissions).find(
    k => path.startsWith(k + "/") || path === k,
  );
  return key ? routePermissions[key] : null;
}

export function getPermissionForMenuItem(title: string, parentTitle?: string): string | null {
  if (menuPermissionMapping[title] !== undefined) return menuPermissionMapping[title];

  // Nested group fallbacks
  if (parentTitle === "Shift Management") {
    if (title === "Shifts") return "HR:shift_override:view";
    if (title === "Shift Templates") return "HR:shift_template:view";
  }
  if (parentTitle === "Employee Assets") {
    if (title === "Assets") return "HR:emp_asset:view";
    if (title === "Asset Kits") return "HR:asset_kit:view";
    if (title === "Employee Assignments") return "HR:asset_assignment:view";
  }
  return null;
}

/** Public routes — no auth or permission check needed. */
export const publicRoutes = ["/login", "/unauthorized"];