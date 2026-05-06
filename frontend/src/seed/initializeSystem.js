
import { ls, uid } from "../services/localStorageService";

const SEED_FLAG = "seeded_v1";

const today = () => new Date().toISOString().slice(0, 10);

const complusory = {
      company_id: "u_moldv7e5_i7n68",
      branch_id: "u_moldv7e5_i7n69",
      created_by: "u_moldv7e5_i7n67",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
}

export function initializeSystem() {
  if (ls.get(SEED_FLAG)) return;

  // ─── COMPANY ──────────────────────────────────────────────────────────────
  ls.set("company", {
    id: uid("comp"),
    name: "Al Qaiser IT Company",
    short_name: "Al Qaiser IT",
    address: "Karachi, Pakistan",
    city: "Karachi",
    country: "Pakistan",
    phone: "+92-300-0000000",
    email: "info@alqaiserit.local",
    currency_code: "PKR",
    taxRate: 18,
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  weekends: ["Sunday"],
  leaveYearType: "CALENDAR", // or FISCAL
  publicHolidays: [
    { date: "2026-03-14", name: "Holi" },
    { date: "2026-05-01", name: "Labour Day" },
    { date: "2026-08-14", name: "Independence Day" }
  ],
    tax_id: "AQT-9087-IT",
    branch_id: "u_moldv7e5_i7n69",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

   // ─── BRANCH ──────────────────────────────────────────────────────────────
  ls.set("branch", {
    id: uid("bran"),
    company_id: "u_moldv7e5_i7n68",
    name: "Al Qaiser IT Company",
    code: "Al Qaiser IT",
    address: "Karachi, Pakistan",
    city: "Karachi",
    country: "Pakistan",
    phone: "+92-300-0000000",
    email: "info@alqaiserit.local",
    currency_code: "PKR",
    tax_id: "AQT-9087-IT",
    is_hq: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // ─── USERS ────────────────────────────────────────────────────────────────
  ls.set("users", [
    {
      id: uid("u"),
      username: "admin",
      full_name: "System Admin",
      email: "admin@alqaiserit.local",
      password: "admin123",
      role: "COMPANY_ADMIN",
      branch_id: null,
      employee_id: null,
      status: "Active",
      company_id: "u_moldv7e5_i7n68",
      branch_id: "u_moldv7e5_i7n69",
      created_by: "u_moldv7e5_i7n67",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: uid("u"),
      username: "hrmanager",
      full_name: "HR Manager",
      email: "hr@alqaiserit.local",
      password: "hr12345",
      role: "STAFF",
      department: "HR",
      branch_id: null,
      employee_id: null,
      status: "Active",
      ...complusory
    },
    {
      id: uid("u"),
      username: "financelead",
      full_name: "Finance Lead",
      email: "finance@alqaiserit.local",
      password: "fin12345",
      role: "STAFF",
      department: "FINANCE",
      branch_id: null,
      employee_id: null,
      status: "Active",
      ...complusory
    },
  ]);

  ls.set("leaveTypes", [
  {
    id: uid("lt"),
    name: "Annual Leave",
    code: "AL",
    max_days_per_year: 20,
    is_paid: "true",
    requires_document: "false",
    carry_forward_allowed: "true",
    max_carry_forward_days: 10,
    min_advance_notice_days: 3,
    applicable_to: "ALL",
    status: "ACTIVE",
    ...complusory
  },
  {
    id: uid("lt"),
    name: "Sick Leave",
    code: "SL",
    max_days_per_year: 12,
    is_paid: "true",
    requires_document: "true",
    carry_forward_allowed: "false",
    max_carry_forward_days: 0,
    min_advance_notice_days: 0,
    applicable_to: "ALL",
    status: "ACTIVE",
    ...complusory
  },
  {
    id: uid("lt"),
    name: "Casual Leave",
    code: "CL",
    max_days_per_year: 10,
    is_paid: "true",
    requires_document: "false",
    carry_forward_allowed: "false",
    max_carry_forward_days: 0,
    min_advance_notice_days: 2,
    applicable_to: "ALL",
    status: "ACTIVE",
    ...complusory
  },
  {
    id: uid("lt"),
    name: "Maternity Leave",
    code: "ML",
    max_days_per_year: 90,
    is_paid: "true",
    requires_document: "true",
    carry_forward_allowed: "false",
    max_carry_forward_days: 0,
    min_advance_notice_days: 15,
    applicable_to: "FULL_TIME",
    status: "ACTIVE",
    ...complusory
  },
  {
    id: uid("lt"),
    name: "Paternity Leave",
    code: "PL",
    max_days_per_year: 7,
    is_paid: "true",
    requires_document: "true",
    carry_forward_allowed: "false",
    max_carry_forward_days: 0,
    min_advance_notice_days: 7,
    applicable_to: "FULL_TIME",
    status: "ACTIVE",
    ...complusory
  },
]);

  // ─── DESIGNATIONS ─────────────────────────────────────────────────────────
  ls.set("designations", [
    { id: uid("dsg"), title: "Software Engineer", department: "HR", level: "Mid", pay_grade: "G2", is_active: "true",...complusory },
    { id: uid("dsg"), title: "Senior Engineer", department: "INVENTORY", level: "Senior", pay_grade: "G4", is_active: "true",...complusory },
    { id: uid("dsg"), title: "Sales Executive", department: "FINANCE", level: "Mid", pay_grade: "G3", is_active: "true",...complusory },
    { id: uid("dsg"), title: "Accountant", department: "INVENTORY", level: "Mid", pay_grade: "G3", is_active: "true",...complusory },
  ]);

  // ─── HR ───────────────────────────────────────────────────────────────────

  ls.set("attendance", [
    { id: uid("at"), attendance_date: today(), employee_id: "Ahmed Raza", check_in_time: "09:05", check_out_time: "18:10", expected_in: "09:00", expected_out: "18:00", late_minutes: 5, overtime_minutes: 10, work_hours: 8.08, source: "MANUAL", status: "PRESENT", remarks: "On time", ...complusory},
    { id: uid("at"), attendance_date: today(), employee_id: "Sara Khan", check_in_time: "09:20", check_out_time: "18:00", expected_in: "09:00", expected_out: "18:00", late_minutes: 20, overtime_minutes: 0, work_hours: 7.67, source: "MANUAL", status: "LATE", remarks: "Late arrival", ...complusory},
    { id: uid("at"), attendance_date: today(), employee_id: "Bilal Ahmed", check_in_time: null, check_out_time: null, expected_in: "09:00", expected_out: "18:00", late_minutes: 0, overtime_minutes: 0, work_hours: 0, source: "MANUAL", status: "ABSENT", remarks: "No show",...complusory },
  ]);

  ls.set("leaves", [
    { id: uid("lv"), employee_id: "Sara Khan", leave_type_id: "Casual", start_date: today(), end_date: today(), total_days: 1, reason: "Personal work", approved_by_id: "HR Manager", rejection_reason: null, status: "APPROVED", ...complusory},
  ]);

  ls.set("shifts", [
    { id: uid("sh"), name: "Morning", start: "09:00", end: "18:00", employees: 18, is_active: "true",...complusory },
    { id: uid("sh"), name: "Evening", start: "14:00", end: "23:00", employees: 6, is_active: "true" ,...complusory},
  ]);


  ls.set("performance", [
    { id: uid("pf"), employee_id: "Ahmed Raza", period: "Q1-2026", review_date: "2026-03-31", reviewer_id: "HR Manager", score: 92, kpi_notes: "Exceeded all KPI targets", rating: "Excellent", improvement_plan: "Continue leadership training", ...complusory },
    { id: uid("pf"), employee_id: "Sara Khan", period: "Q1-2026", review_date: "2026-03-31", reviewer_id: "HR Manager", score: 81, kpi_notes: "Met sales targets", rating: "Good", improvement_plan: "Focus on client retention" , ...complusory},
  ]);

  ls.set("recruitment", [
    { id: uid("rc"), name: "Hamza Iqbal", position: "Backend Engineer", department: "Engineering", apply_date: today(), interview_date: "2026-05-10", stage: "Interview", status: "Active", notes: "Strong Python background", ...complusory },
  ]);

  ls.set("exits", [
    { id: uid("ex"), employee_id: "Junaid M.", exit_date: today(), reason: "Resignation", notice_given: "true", final_settlement: 250000, clearance: "Pending", notes: "Moving abroad" , ...complusory},
  ]);

  ls.set("policies", [
    { id: uid("pol"), title: "Leave Policy", category: "HR", version: "v2.1", updated: today(), content: "Leave policy details...", status: "Active" , ...complusory},
    { id: uid("pol"), title: "Code of Conduct", category: "HR", version: "v1.0", updated: today(), content: "Code of conduct details...", status: "Active", ...complusory },
  ]);

  ls.set("compensation", [
    { id: uid("cp"), employee_id: "Ahmed Raza", grade: "G4", basic: 150000, house_rent_allowance: 15000, medical_allowance: 5000, transport_allowance: 10000, allowances: 30000, total: 180000, effective_date: "2024-01-01", ...complusory },
  ]);

  // ─── FINANCE ──────────────────────────────────────────────────────────────

  ls.set("accounts", [
    { id: uid("acc"), account_code: "1001", account_name: "Cash in Hand", parent_id: null, account_type: "ASSET", account_subtype: "CURRENT_ASSET", normal_balance: "DEBIT", is_bank_account: "false", is_cash_account: "true", currency_code: "PKR", description: "Physical cash", balance: 1500000, is_active: "true" ,...complusory},
    { id: uid("acc"), account_code: "1002", account_name: "Bank - Meezan", parent_id: null, account_type: "ASSET", account_subtype: "CURRENT_ASSET", normal_balance: "DEBIT", is_bank_account: "true", is_cash_account: "false", currency_code: "PKR", description: "Meezan Bank current account", balance: 4200000, is_active: "true",...complusory },
    { id: uid("acc"), account_code: "2001", account_name: "Accounts Payable", parent_id: null, account_type: "LIABILITY", account_subtype: "CURRENT_LIABILITY", normal_balance: "CREDIT", is_bank_account: "false", is_cash_account: "false", currency_code: "PKR", description: "Vendor payables", balance: 350000, is_active: "true" ,...complusory},
    { id: uid("acc"), account_code: "4001", account_name: "Sales Revenue", parent_id: null, account_type: "REVENUE", account_subtype: "OPERATING_REVENUE", normal_balance: "CREDIT", is_bank_account: "false", is_cash_account: "false", currency_code: "PKR", description: "Sales income", balance: 8900000, is_active: "true",...complusory },
  ]);

  ls.set("invoices", [
    {
      id: uid("inv"),
      invoice_number: "INV-9001",
      invoice_type: "SALES",
      invoice_date: today(),
      due_date: "2026-05-29",
      customer_id: "Acme Corp",
      vendor_id: null,
      currency_code: "PKR",
      exchange_rate: 1,
      subtotal: 810000,
      discount_type: null,
      discount_value: 0,
      tax_amount: 80000,
      total_amount: 890000,
      paid_amount: 0,
      outstanding_amount: 890000,
      notes: "Corporate bulk order",
      terms: "Net 30",
      status: "SENT",...complusory
    },
    {
      id: uid("inv"),
      invoice_number: "INV-9002",
      invoice_type: "SALES",
      invoice_date: today(),
      due_date: today(),
      customer_id: "Walk-in",
      vendor_id: null,
      currency_code: "PKR",
      exchange_rate: 1,
      subtotal: 290000,
      discount_type: null,
      discount_value: 0,
      tax_amount: 30000,
      total_amount: 320000,
      paid_amount: 320000,
      outstanding_amount: 0,
      notes: "Cash sale",
      terms: "Cash",
      status: "PAID",...complusory
    },
  ]);

  ls.set("expenses", [
    { id: uid("exp"), category: "Utilities", date: today(), amount: 45000, vendor: "K-Electric", account_id: null, submitted_by: "Finance Lead", approved_by: "System Admin", receipt_url: null, description: "Monthly electricity bill", status: "Paid",...complusory },
    { id: uid("exp"), category: "Rent", date: today(), amount: 250000, vendor: "Office Landlord", account_id: null, submitted_by: "Finance Lead", approved_by: "System Admin", receipt_url: null, description: "Monthly office rent", status: "Paid" ,...complusory},
  ]);

  ls.set("payables", [
    { id: uid("pay"), vendor: "TechWorld Distributors", invoice_ref: "PO-1001", due: "2026-05-30", amount: 250000, paid_amount: 0, currency_code: "PKR", status: "Pending" ,...complusory},
  ]);

  ls.set("receivables", [
    { id: uid("rec"), customer: "Acme Corp", invoice_ref: "INV-9001", due: "2026-05-29", amount: 890000, paid_amount: 0, currency_code: "PKR", status: "Pending",...complusory },
  ]);

  ls.set("budgets", [
    { id: uid("bg"), name: "Engineering 2026", budget_type: "ANNUAL", department: "Engineering", period_start: "2026-01-01", period_end: "2026-12-31", total_budgeted: 5000000, total_actual: 1200000, variance: 3800000, approved_by: "System Admin", status: "ACTIVE", notes: "Annual engineering budget" ,...complusory},
    { id: uid("bg"), name: "Sales 2026", budget_type: "ANNUAL", department: "Sales", period_start: "2026-01-01", period_end: "2026-12-31", total_budgeted: 3000000, total_actual: 800000, variance: 2200000, approved_by: "System Admin", status: "ACTIVE", notes: "Annual sales budget" ,...complusory},
  ]);

  ls.set("bankAccounts", [
    { id: uid("ba"), bank: "Meezan", account: "0123-456789", iban: "PK36MEZN0000123456789", branch: "Karachi", account_type: "Current", currency_code: "PKR", balance: 4200000, is_active: "true" ,...complusory},
    { id: uid("ba"), bank: "HBL", account: "9876-543210", iban: "PK36HBL00009876543210", branch: "Lahore", account_type: "Current", currency_code: "PKR", balance: 1800000, is_active: "true" ,...complusory},
  ]);

  ls.set("financeAssets", [
    { id: uid("fa"), name: "Office Vehicle", category: "Vehicle", purchase_date: "2024-01-15", cost_value: 3500000, depreciation_method: "Straight-Line", depreciation: 350000, accumulated_dep: 700000, net_book_value: 2800000, disposal_date: null, status: "Active" ,...complusory},
  ]);

ls.set("taxes", [
  { 
    id: uid("tax"), 
    name: "VAT Standard", 
    type: "VAT", 
    rate: 18, 
    country: "PK", 
    tax_code: "VAT-001",
    effective_from: "2024-01-01",
    effective_to: null,
    is_active: "true",
    description: "Standard VAT for most goods and services",
    ...complusory 
  },
  { 
    id: uid("tax"), 
    name: "VAT Reduced", 
    type: "VAT", 
    rate: 5, 
    country: "PK", 
    tax_code: "VAT-002",
    effective_from: "2024-01-01",
    effective_to: null,
    is_active: "true",
    description: "Reduced VAT for essential items",
    ...complusory 
  },
  { 
    id: uid("tax"), 
    name: "Sales Tax - IT Services", 
    type: "Sales Tax", 
    rate: 15, 
    country: "PK", 
    tax_code: "ST-IT-001",
    effective_from: "2024-01-01",
    effective_to: null,
    is_active: "true",
    description: "Sales tax on IT services",
    ...complusory 
  },
  { 
    id: uid("tax"), 
    name: "Sales Tax - Retail", 
    type: "Sales Tax", 
    rate: 10, 
    country: "PK", 
    tax_code: "ST-RTL-001",
    effective_from: "2024-01-01",
    effective_to: null,
    is_active: "true",
    description: "Sales tax on retail goods",
    ...complusory 
  },
]);

// ─── TAX RULES ──────────────────────────────────────────────────────────────
ls.set("taxRules", [
  { 
    id: uid("rule"), 
    module: "inventory", 
    transaction_type: "invoice", 
    tax_id: "GST Standard (tax_id)", 
    conditions: "{\"product_type\": \"PRODUCT\"}", 
    priority: 1, 
    is_active: "true",
    ...complusory 
  },
  { 
    id: uid("rule"), 
    module: "inventory", 
    transaction_type: "purchase", 
    tax_id: "GST Standard (tax_id)", 
    conditions: "{\"purchase_type\": \"goods\"}", 
    priority: 1, 
    is_active: "true",
    ...complusory 
  },
  { 
    id: uid("rule"), 
    module: "hr", 
    transaction_type: "salary", 
    tax_id: "Income Tax (tax_id)", 
    conditions: null, 
    priority: 1, 
    is_active: "true",
    ...complusory 
  },
  { 
    id: uid("rule"), 
    module: "finance", 
    transaction_type: "expense", 
    tax_id: "Withholding Tax (tax_id)", 
    conditions: "{\"vendor_type\": \"service\"}", 
    priority: 1, 
    is_active: "true",
    ...complusory 
  },
]);

// ─── EMPLOYEE LOANS ─────────────────────────────────────────────────────────
ls.set("employeeLoans", [
  {
    id: uid("loan"),
    employee_id: "Ahmed Raza (employee_id)",
    loan_type: "Salary Advance",
    principal_amount: 50000,
    monthly_deduction: 5000,
    total_months: 10,
    paid_months: 2,
    remaining_amount: 40000,
    start_date: today(),
    end_date: null,
    interest_rate: 0,
    status: "ACTIVE",
    approved_by: "System Admin",
    ...complusory
  },
]);


// ─── PAYROLL RECORDS ────────────────────────────────────────────────────────
ls.set("payroll", []);
ls.set("payrollBatches", []);
ls.set("tax_transactions", []);

  ls.set("forecasts", [
    { id: uid("fc"), period: "Q1-2026", type: "REVENUE", revenue: 8900000, expense: 4200000, profit: 4700000, actual: 8900000, variance: 0, notes: "Q1 actuals" ,...complusory},
    { id: uid("fc"), period: "Q2-2026", type: "REVENUE", revenue: 9500000, expense: 4500000, profit: 5000000, actual: null, variance: null, notes: "Q2 forecast" ,...complusory},
    { id: uid("fc"), period: "Q3-2026", type: "REVENUE", revenue: 10200000, expense: 4800000, profit: 5400000, actual: null, variance: null, notes: "Q3 forecast" ,...complusory},
    { id: uid("fc"), period: "Q4-2026", type: "REVENUE", revenue: 11000000, expense: 5000000, profit: 6000000, actual: null, variance: null, notes: "Q4 forecast" ,...complusory},
  ]);

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  ls.set("settings", {
    theme: "light",
    notifications: true,
    dateFormat: "YYYY-MM-DD",...complusory
  });

  ls.set(SEED_FLAG, true);

  // ─── PERMISSIONS ──────────────────────────────────────────────────────────
  // NOTE: Permissions are seeded here (inside initializeSystem) so they only
  // run once, guarded by SEED_FLAG, and never at module-import time.
  const moduleFeatures = {
    HR: [
      "Employee Management", "Payroll", "Time & Attendance", "Leave Management",
      "Shift Management", "Employee Assets", "Performance", "Recruitment",
      "Exit Management", "HR Policies", "Compensation",
    ],
    INVENTORY: [
      "Products", "Stock Management", "Warehouses", "Purchase Orders",
      "Suppliers", "Sales Orders", "Assets Inventory", "Inventory Transfers",
      "Barcode & QR", "Reports", "Alerts", "POS",
    ],
    FINANCE: [
      "Chart of Accounts", "Invoices", "Expenses", "Payables", "Receivables",
      "Budgets", "Bank & Cash", "Fixed Assets", "Taxes", "Reports", "Forecasting",
    ],
    SETTINGS: [
      "Company Profile", "Users & Roles", "Departments", "Designations", "Preferences",
    ],
  };

  const createPermission = (userId, moduleName, featureName, canCreate, canUpdate, canDelete, canView) => ({
    id: uid("perm"),
    user_id: userId,
    module_name: moduleName,
    feature_name: featureName,
    is_create_access: canCreate ? "true" : "false",
    is_update_access: canUpdate ? "true" : "false",
    is_delete_access: canDelete ? "true" : "false",
    is_view_access: canView ? "true" : "false",
  });

  const seedUsers = ls.get("users", []);
  const permissions = [];

  seedUsers.forEach((user) => {
    if (user.role === "COMPANY_ADMIN") {
      Object.entries(moduleFeatures).forEach(([module, features]) => {
        features.forEach((feature) => {
          permissions.push(createPermission(user.id, module, feature, true, true, true, true));
        });
      });
    } else if (user.role === "BRANCH_ADMIN") {
      const userModule = user.department || "INVENTORY";
      if (moduleFeatures[userModule]) {
        moduleFeatures[userModule].forEach((feature) => {
          permissions.push(createPermission(user.id, userModule, feature, true, true, true, true));
        });
      }
    } else if (user.role === "STAFF") {
      const userModule = user.department || "INVENTORY";
      if (moduleFeatures[userModule]) {
        moduleFeatures[userModule].forEach((feature) => {
          const canCreate = feature === "Expenses" || feature === "Leave Management" || feature === "Attendance";
          const canUpdate = feature === "Expenses" || feature === "Leave Management" || feature === "Time & Attendance";
          permissions.push(createPermission(user.id, userModule, feature, canCreate, canUpdate, false, true));
        });
      }
    }
  });

  const hrUser = seedUsers.find((u) => u.email === "hr@alqaiserit.local");
  const financeUser = seedUsers.find((u) => u.email === "finance@alqaiserit.local");

  if (hrUser) {
    moduleFeatures.HR.forEach((feature) => {
      permissions.push(createPermission(hrUser.id, "HR", feature, true, true, true, true));
    });
  }

  if (financeUser) {
    moduleFeatures.FINANCE.forEach((feature) => {
      permissions.push(createPermission(financeUser.id, "FINANCE", feature, true, true, true, true));
    });
  }

  ls.set("permissions", permissions);
  ls.set("moduleFeatures", moduleFeatures);
}
