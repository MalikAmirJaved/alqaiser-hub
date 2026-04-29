/**
 * Schemas for every CRUD submodule. Keys = localStorage keys from seeder.
 */
export const schemas = {
  // INVENTORY
  products: {
    title: "Product Management",
    subtitle: "Manage products, SKUs, brands and stock levels",
    storeKey: "products",
    idPrefix: "p",
    statusField: "status",
    fields: [
      { key: "sku", label: "SKU", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "category", label: "Category", type: "text" },
      { key: "brand", label: "Brand", type: "text" },
      { key: "price", label: "Price", type: "number" },
      { key: "cost", label: "Cost", type: "number" },
      { key: "stock", label: "Stock", type: "number" },
      { key: "reorder", label: "Reorder Level", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Low", "Out", "Inactive"] },
    ],
    columns: ["sku", "name", "category", "brand", "price", "stock", "status"],
  },
  categories: {
    title: "Categories", storeKey: "categories", idPrefix: "cat",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "parent", label: "Parent", type: "text" },
    ],
  },
  brands: {
    title: "Brands", storeKey: "brands", idPrefix: "br",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "country", label: "Country", type: "text" },
    ],
  },
  stockMoves: {
    title: "Stock Management", subtitle: "Stock in/out, adjustments and transfers",
    storeKey: "stockMoves", idPrefix: "sm", statusField: "type",
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "type", label: "Type", type: "select", options: ["IN", "OUT", "ADJUST"], required: true },
      { key: "product", label: "Product", type: "text", required: true },
      { key: "qty", label: "Quantity", type: "number", required: true },
      { key: "warehouse", label: "Warehouse", type: "text" },
      { key: "note", label: "Note", type: "textarea" },
    ],
  },
  warehouses: {
    title: "Warehouse Management", storeKey: "warehouses", idPrefix: "wh",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "location", label: "Location", type: "text" },
      { key: "manager", label: "Manager", type: "text" },
      { key: "capacity", label: "Capacity", type: "number" },
    ],
  },
  purchaseOrders: {
    title: "Purchase Orders", storeKey: "purchaseOrders", idPrefix: "po", statusField: "status",
    fields: [
      { key: "code", label: "PO Code", type: "text", required: true },
      { key: "supplier", label: "Supplier", type: "text" },
      { key: "date", label: "Date", type: "date" },
      { key: "total", label: "Total", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Pending", "Received", "Cancelled"] },
    ],
  },
  suppliers: {
    title: "Suppliers & Vendors", storeKey: "suppliers", idPrefix: "sup", statusField: "status",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "contact", label: "Contact Person", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "balance", label: "Balance", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
    ],
  },
  salesOrders: {
    title: "Sales Orders", storeKey: "salesOrders", idPrefix: "so", statusField: "status",
    fields: [
      { key: "code", label: "Order Code", type: "text", required: true },
      { key: "customer", label: "Customer", type: "text" },
      { key: "date", label: "Date", type: "date" },
      { key: "total", label: "Total", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Pending", "Paid", "Cancelled"] },
    ],
  },
  assetsInv: {
    title: "Assets Inventory", storeKey: "assetsInv", idPrefix: "ai", statusField: "status",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "tag", label: "Asset Tag", type: "text" },
      { key: "category", label: "Category", type: "text" },
      { key: "assignedTo", label: "Assigned To", type: "text" },
      { key: "value", label: "Value", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Available", "Assigned", "Retired"] },
    ],
  },
  transfers: {
    title: "Inventory Transfers", storeKey: "transfers", idPrefix: "tr", statusField: "status",
    fields: [
      { key: "code", label: "Transfer Code", type: "text", required: true },
      { key: "from", label: "From", type: "text" },
      { key: "to", label: "To", type: "text" },
      { key: "date", label: "Date", type: "date" },
      { key: "items", label: "Items", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Pending", "In Transit", "Completed"] },
    ],
  },
  barcodes: {
    title: "Barcode & QR", storeKey: "barcodes", idPrefix: "bc",
    fields: [
      { key: "product", label: "Product", type: "text", required: true },
      { key: "code", label: "Code", type: "text", required: true },
      { key: "type", label: "Type", type: "select", options: ["Barcode", "QR"] },
    ],
  },
  posReceipts: {
    title: "Selling / POS", subtitle: "POS billing, sales orders & receipts",
    storeKey: "posReceipts", idPrefix: "rcp",
    fields: [
      { key: "code", label: "Receipt Code", type: "text", required: true },
      { key: "cashier", label: "Cashier", type: "text" },
      { key: "date", label: "Date", type: "date" },
      { key: "total", label: "Total", type: "number" },
      { key: "items", label: "Items", type: "number" },
      { key: "payment", label: "Payment", type: "select", options: ["Cash", "Card", "Bank"] },
    ],
  },
  alerts: {
    title: "Alerts", storeKey: "alerts", idPrefix: "al", statusField: "severity",
    fields: [
      { key: "type", label: "Type", type: "text", required: true },
      { key: "message", label: "Message", type: "textarea" },
      { key: "severity", label: "Severity", type: "select", options: ["Low", "Medium", "High"] },
      { key: "date", label: "Date", type: "date" },
    ],
  },
  auditLogs: {
    title: "Audit Logs", storeKey: "auditLogs", idPrefix: "log",
    fields: [
      { key: "user", label: "User", type: "text" },
      { key: "action", label: "Action", type: "text" },
      { key: "module", label: "Module", type: "text" },
      { key: "date", label: "Date", type: "text" },
    ],
  },

  // HR
  employees: {
    title: "Employee Management", storeKey: "employees", idPrefix: "emp", statusField: "status",
    fields: [
      { key: "code", label: "Employee Code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "department", label: "Department", type: "text" },
      { key: "designation", label: "Designation", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "salary", label: "Salary", type: "number" },
      { key: "joinDate", label: "Join Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Active", "On Leave", "Resigned"] },
    ],
    columns: ["code", "name", "department", "designation", "salary", "status"],
  },
  payroll: {
    title: "Payroll", storeKey: "payroll", idPrefix: "pr", statusField: "status",
    fields: [
      { key: "employee", label: "Employee", type: "text", required: true },
      { key: "month", label: "Month", type: "text" },
      { key: "basic", label: "Basic", type: "number" },
      { key: "bonus", label: "Bonus", type: "number" },
      { key: "deduction", label: "Deduction", type: "number" },
      { key: "net", label: "Net", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Paid", "Pending"] },
    ],
  },
  attendance: {
    title: "Time & Attendance", storeKey: "attendance", idPrefix: "at", statusField: "status",
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "employee", label: "Employee", type: "text", required: true },
      { key: "checkIn", label: "Check In", type: "text" },
      { key: "checkOut", label: "Check Out", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Present", "Absent", "Leave"] },
    ],
  },
  leaves: {
    title: "Leave Management", storeKey: "leaves", idPrefix: "lv", statusField: "status",
    fields: [
      { key: "employee", label: "Employee", type: "text", required: true },
      { key: "type", label: "Type", type: "select", options: ["Casual", "Sick", "Annual", "Unpaid"] },
      { key: "from", label: "From", type: "date" },
      { key: "to", label: "To", type: "date" },
      { key: "days", label: "Days", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Pending", "Approved", "Rejected"] },
    ],
  },
  shifts: {
    title: "Shift Management", storeKey: "shifts", idPrefix: "sh",
    fields: [
      { key: "name", label: "Shift Name", type: "text", required: true },
      { key: "start", label: "Start", type: "text" },
      { key: "end", label: "End", type: "text" },
      { key: "employees", label: "Employees", type: "number" },
    ],
  },
  empAssets: {
    title: "Employee Assets", storeKey: "empAssets", idPrefix: "ea", statusField: "status",
    fields: [
      { key: "employee", label: "Employee", type: "text", required: true },
      { key: "asset", label: "Asset", type: "text", required: true },
      { key: "date", label: "Assigned Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Returned"] },
    ],
  },
  performance: {
    title: "Performance", storeKey: "performance", idPrefix: "pf", statusField: "rating",
    fields: [
      { key: "employee", label: "Employee", type: "text", required: true },
      { key: "period", label: "Period", type: "text" },
      { key: "score", label: "Score", type: "number" },
      { key: "rating", label: "Rating", type: "select", options: ["Excellent", "Good", "Average", "Poor"] },
    ],
  },
  recruitment: {
    title: "Recruitment", storeKey: "recruitment", idPrefix: "rc", statusField: "stage",
    fields: [
      { key: "name", label: "Applicant", type: "text", required: true },
      { key: "position", label: "Position", type: "text" },
      { key: "stage", label: "Stage", type: "select", options: ["Applied", "Interview", "Offer", "Hired", "Rejected"] },
      { key: "date", label: "Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Closed"] },
    ],
  },
  exits: {
    title: "Exit Management", storeKey: "exits", idPrefix: "ex", statusField: "clearance",
    fields: [
      { key: "employee", label: "Employee", type: "text", required: true },
      { key: "date", label: "Exit Date", type: "date" },
      { key: "reason", label: "Reason", type: "text" },
      { key: "clearance", label: "Clearance", type: "select", options: ["Pending", "Approved"] },
    ],
  },
  policies: {
    title: "HR Policies", storeKey: "policies", idPrefix: "pol", statusField: "status",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "category", label: "Category", type: "text" },
      { key: "updated", label: "Updated", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Archived"] },
    ],
  },
  compensation: {
    title: "Compensation", storeKey: "compensation", idPrefix: "cp",
    fields: [
      { key: "employee", label: "Employee", type: "text", required: true },
      { key: "basic", label: "Basic", type: "number" },
      { key: "allowances", label: "Allowances", type: "number" },
      { key: "total", label: "Total", type: "number" },
    ],
  },

  // FINANCE
  accounts: {
    title: "Accounts (Chart of Accounts)", storeKey: "accounts", idPrefix: "acc",
    fields: [
      { key: "code", label: "Code", type: "text", required: true },
      { key: "name", label: "Account Name", type: "text", required: true },
      { key: "type", label: "Type", type: "select", options: ["Asset", "Liability", "Income", "Expense", "Equity"] },
      { key: "balance", label: "Balance", type: "number" },
    ],
  },
  invoices: {
    title: "Invoices", storeKey: "invoices", idPrefix: "inv", statusField: "status",
    fields: [
      { key: "code", label: "Invoice #", type: "text", required: true },
      { key: "customer", label: "Customer", type: "text" },
      { key: "date", label: "Date", type: "date" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Pending", "Paid", "Overdue", "Cancelled"] },
    ],
  },
  expenses: {
    title: "Expenses", storeKey: "expenses", idPrefix: "ex", statusField: "status",
    fields: [
      { key: "category", label: "Category", type: "text", required: true },
      { key: "date", label: "Date", type: "date" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "vendor", label: "Vendor", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Paid", "Pending"] },
    ],
  },
  payables: {
    title: "Payables", storeKey: "payables", idPrefix: "pay", statusField: "status",
    fields: [
      { key: "vendor", label: "Vendor", type: "text", required: true },
      { key: "due", label: "Due Date", type: "date" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Pending", "Paid", "Overdue"] },
    ],
  },
  receivables: {
    title: "Receivables", storeKey: "receivables", idPrefix: "rec", statusField: "status",
    fields: [
      { key: "customer", label: "Customer", type: "text", required: true },
      { key: "due", label: "Due Date", type: "date" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Pending", "Paid", "Overdue"] },
    ],
  },
  budgets: {
    title: "Budgets", storeKey: "budgets", idPrefix: "bg",
    fields: [
      { key: "department", label: "Department", type: "text", required: true },
      { key: "period", label: "Period", type: "text" },
      { key: "allocated", label: "Allocated", type: "number" },
      { key: "spent", label: "Spent", type: "number" },
    ],
  },
  bankAccounts: {
    title: "Bank & Cash", storeKey: "bankAccounts", idPrefix: "ba",
    fields: [
      { key: "bank", label: "Bank", type: "text", required: true },
      { key: "account", label: "Account #", type: "text" },
      { key: "branch", label: "Branch", type: "text" },
      { key: "balance", label: "Balance", type: "number" },
    ],
  },
  financeAssets: {
    title: "Finance Assets", storeKey: "financeAssets", idPrefix: "fa", statusField: "status",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "value", label: "Value", type: "number" },
      { key: "depreciation", label: "Depreciation", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Disposed"] },
    ],
  },
  taxes: {
    title: "Taxes", storeKey: "taxes", idPrefix: "tx",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "rate", label: "Rate (%)", type: "number" },
      { key: "period", label: "Period", type: "text" },
      { key: "amount", label: "Amount", type: "number" },
    ],
  },
  forecasts: {
    title: "Forecasting", storeKey: "forecasts", idPrefix: "fc",
    fields: [
      { key: "period", label: "Period", type: "text", required: true },
      { key: "revenue", label: "Revenue", type: "number" },
      { key: "expense", label: "Expense", type: "number" },
      { key: "profit", label: "Profit", type: "number" },
    ],
  },

  // SETTINGS
  users: {
    title: "Users & Roles", storeKey: "users", idPrefix: "u", statusField: "status",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "email", label: "Email", type: "text", required: true },
      { key: "password", label: "Password", type: "text" },
      { key: "role", label: "Role", type: "select", options: ["Admin", "HR", "Finance", "Manager", "Staff"] },
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
    ],
    columns: ["name", "email", "role", "status"],
  },
  departments: {
    title: "Departments", storeKey: "departments", idPrefix: "dep",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "head", label: "Department Head", type: "text" },
      { key: "employees", label: "Employees", type: "number" },
    ],
  },
  designations: {
    title: "Designations", storeKey: "designations", idPrefix: "dsg",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "level", label: "Level", type: "select", options: ["Junior", "Mid", "Senior", "Lead", "Manager"] },
    ],
  },
};
