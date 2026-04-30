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
    branch_id: "BRNCH-0001",
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

  // ─── DESIGNATIONS ─────────────────────────────────────────────────────────
  ls.set("designations", [
    { id: uid("dsg"), title: "Software Engineer", department: null, level: "Mid", pay_grade: "G2", is_active: "true",...complusory },
    { id: uid("dsg"), title: "Senior Engineer", department: null, level: "Senior", pay_grade: "G4", is_active: "true",...complusory },
    { id: uid("dsg"), title: "Sales Executive", department: null, level: "Mid", pay_grade: "G3", is_active: "true",...complusory },
    { id: uid("dsg"), title: "Accountant", department: null, level: "Mid", pay_grade: "G3", is_active: "true",...complusory },
  ]);

  // ─── INVENTORY ────────────────────────────────────────────────────────────

  ls.set("categories", [
    { id: uid("cat"), name: "Laptops", parent_id: null, description: "Laptop computers",...complusory },
    { id: uid("cat"), name: "Mobiles", parent_id: null, description: "Mobile phones",...complusory },
    { id: uid("cat"), name: "Accessories", parent_id: null, description: "Computer accessories",...complusory },
    { id: uid("cat"), name: "Networking", parent_id: null, description: "Networking equipment",...complusory },
  ]);

  ls.set("brands", [
    { id: uid("br"), name: "Dell", country: "USA",...complusory },
    { id: uid("br"), name: "HP", country: "USA",...complusory },
    { id: uid("br"), name: "Apple", country: "USA",...complusory },
    { id: uid("br"), name: "Samsung", country: "Korea",...complusory },
  ]);

  ls.set("warehouses", [
    { id: uid("wh"), name: "Main Warehouse", code: "WH-MAIN", address: "SITE Area, Karachi", city: "Karachi", manager_id: null, phone: "+92-21-1111111", capacity: 5000, is_active: "true",...complusory },
    { id: uid("wh"), name: "Lahore Branch", code: "WH-LHR", address: "Gulberg, Lahore", city: "Lahore", manager_id: null, phone: "+92-42-2222222", capacity: 2000, is_active: "true" ,...complusory},
  ]);

  ls.set("products", [
    {
      id: uid("p"),
      sku: "DLL-XPS-13",
      name: "Dell XPS 13",
      description: "13-inch laptop, 16GB RAM, 512GB SSD",
      category_id: "Laptops",
      brand: "Dell",
      unit_of_measure: "PCS",
      product_type: "PRODUCT",
      cost_price: 280000,
      selling_price: 320000,
      min_selling_price: 290000,
      tax_rate_id: null,
      barcode: "8901234567890",
      barcode_type: "EAN13",
      reorder_point: 3,
      reorder_quantity: 5,
      max_stock_level: 20,
      lead_time_days: 7,
      is_serialised: "true",
      is_batch_tracked: "false",
      is_active: "true",...complusory
    },
    {
      id: uid("p"),
      sku: "HP-PAV-15",
      name: "HP Pavilion 15",
      description: "15.6-inch laptop, 8GB RAM, 256GB SSD",
      category_id: "Laptops",
      brand: "HP",
      unit_of_measure: "PCS",
      product_type: "PRODUCT",
      cost_price: 150000,
      selling_price: 180000,
      min_selling_price: 160000,
      tax_rate_id: null,
      barcode: "8901234567891",
      barcode_type: "EAN13",
      reorder_point: 4,
      reorder_quantity: 6,
      max_stock_level: 15,
      lead_time_days: 5,
      is_serialised: "true",
      is_batch_tracked: "false",
      is_active: "true",...complusory
    },
    {
      id: uid("p"),
      sku: "APL-IP-15",
      name: "iPhone 15",
      description: "Apple iPhone 15, 128GB",
      category_id: "Mobiles",
      brand: "Apple",
      unit_of_measure: "PCS",
      product_type: "PRODUCT",
      cost_price: 360000,
      selling_price: 410000,
      min_selling_price: 370000,
      tax_rate_id: null,
      barcode: "8901234567892",
      barcode_type: "EAN13",
      reorder_point: 2,
      reorder_quantity: 3,
      max_stock_level: 10,
      lead_time_days: 14,
      is_serialised: "true",
      is_batch_tracked: "false",
      is_active: "true",...complusory
    },
    {
      id: uid("p"),
      sku: "SMS-S24",
      name: "Samsung Galaxy S24",
      description: "Samsung Galaxy S24, 256GB",
      category_id: "Mobiles",
      brand: "Samsung",
      unit_of_measure: "PCS",
      product_type: "PRODUCT",
      cost_price: 260000,
      selling_price: 295000,
      min_selling_price: 270000,
      tax_rate_id: null,
      barcode: "8901234567893",
      barcode_type: "EAN13",
      reorder_point: 5,
      reorder_quantity: 8,
      max_stock_level: 15,
      lead_time_days: 10,
      is_serialised: "true",
      is_batch_tracked: "false",
      is_active: "true",...complusory
    },
    {
      id: uid("p"),
      sku: "ACC-MS-01",
      name: "Wireless Mouse",
      description: "Wireless optical mouse, USB receiver",
      category_id: "Accessories",
      brand: "HP",
      unit_of_measure: "PCS",
      product_type: "PRODUCT",
      cost_price: 1500,
      selling_price: 2500,
      min_selling_price: 1800,
      tax_rate_id: null,
      barcode: "8901234567894",
      barcode_type: "EAN13",
      reorder_point: 20,
      reorder_quantity: 50,
      max_stock_level: 200,
      lead_time_days: 3,
      is_serialised: "false",
      is_batch_tracked: "false",
      is_active: "true",...complusory
    },
  ]);

  ls.set("stockLevels", [
    { id: uid("sl"), product_id: "Dell XPS 13", warehouse_id: "Main Warehouse", location_id: null, quantity_on_hand: 12, quantity_reserved: 0, quantity_on_order: 0, batch_number: null, serial_number: null, expiry_date: null, last_counted_at: today() ,...complusory},
    { id: uid("sl"), product_id: "HP Pavilion 15", warehouse_id: "Main Warehouse", location_id: null, quantity_on_hand: 8, quantity_reserved: 0, quantity_on_order: 0, batch_number: null, serial_number: null, expiry_date: null, last_counted_at: today() ,...complusory},
    { id: uid("sl"), product_id: "iPhone 15", warehouse_id: "Main Warehouse", location_id: null, quantity_on_hand: 6, quantity_reserved: 0, quantity_on_order: 0, batch_number: null, serial_number: null, expiry_date: null, last_counted_at: today() ,...complusory},
    { id: uid("sl"), product_id: "Samsung Galaxy S24", warehouse_id: "Main Warehouse", location_id: null, quantity_on_hand: 2, quantity_reserved: 0, quantity_on_order: 0, batch_number: null, serial_number: null, expiry_date: null, last_counted_at: today() ,...complusory},
    { id: uid("sl"), product_id: "Wireless Mouse", warehouse_id: "Main Warehouse", location_id: null, quantity_on_hand: 120, quantity_reserved: 0, quantity_on_order: 0, batch_number: null, serial_number: null, expiry_date: null, last_counted_at: today(),...complusory },
  ]);

  ls.set("stockMoves", [
    { id: uid("sm"), date: today(), type: "STOCK_IN", product_id: "Dell XPS 13", qty: 5, warehouse_id: "Main Warehouse", batch_number: null, serial_number: null, reason: "PO-1001", note: "Restock" ,...complusory},
    { id: uid("sm"), date: today(), type: "STOCK_OUT", product_id: "iPhone 15", qty: 1, warehouse_id: "Main Warehouse", batch_number: null, serial_number: null, reason: "SO-2001", note: "Sale" ,...complusory},
  ]);

  ls.set("suppliers", [
    { id: uid("sup"), name: "TechWorld Distributors", code: "SUP-001", contact: "Mr. Adeel", email: "adeel@techworld.com", phone: "+92-21-1234567", address: "Saddar, Karachi", city: "Karachi", payment_terms: "Net 30", credit_limit: 500000, balance: 250000, rating: "4", status: "Active" ,...complusory},
    { id: uid("sup"), name: "Karachi Computers", code: "SUP-002", contact: "Mr. Faisal", email: "faisal@kc.com", phone: "+92-21-2345678", address: "Gulshan, Karachi", city: "Karachi", payment_terms: "Net 15", credit_limit: 300000, balance: 80000, rating: "5", status: "Active",...complusory },
  ]);

  ls.set("purchaseOrders", [
    {
      id: uid("po"),
      po_number: "PO-1001",
      supplier_id: "TechWorld Distributors",
      order_date: today(),
      expected_delivery_date: "2026-05-15",
      delivery_date: "2026-05-10",
      warehouse_id: "Main Warehouse",
      subtotal: 1120000,
      tax_amount: 80000,
      shipping_cost: 0,
      discount_amount: 0,
      total_amount: 1200000,
      status: "RECEIVED",
      payment_status: "PAID",
      notes: "Regular stock order",
      terms: "Net 30",
      ...complusory
    },
    {
      id: uid("po"),
      po_number: "PO-1002",
      supplier_id: "Karachi Computers",
      order_date: today(),
      expected_delivery_date: "2026-05-20",
      delivery_date: null,
      warehouse_id: "Main Warehouse",
      subtotal: 320000,
      tax_amount: 30000,
      shipping_cost: 0,
      discount_amount: 0,
      total_amount: 350000,
      status: "SENT",
      payment_status: "UNPAID",
      notes: "Accessories order",
      terms: "Net 15",
      ...complusory
    },
  ]);

  ls.set("salesOrders", [
    {
      id: uid("so"),
      code: "SO-2001",
      customer_id: "Walk-in",
      order_date: today(),
      delivery_date: today(),
      subtotal: 290000,
      tax_amount: 30000,
      discount_amount: 0,
      total_amount: 320000,
      status: "DELIVERED",
      payment_status: "Paid",
      notes: "Cash sale",
      ...complusory
    },
    {
      id: uid("so"),
      code: "SO-2002",
      customer_id: "Acme Corp",
      order_date: today(),
      delivery_date: null,
      subtotal: 810000,
      tax_amount: 80000,
      discount_amount: 0,
      total_amount: 890000,
      status: "CONFIRMED",
      payment_status: "Pending",
      notes: "Corporate order",
      ...complusory
    },
  ]);

  ls.set("posReceipts", [
    { id: uid("rcp"), code: "RCP-3001", cashier: "Sara Khan", date: today(), subtotal: 41000, tax_amount: 4000, discount: 0, total: 45000, items: 3, payment: "Cash", customer_id: "Walk-in",...complusory },
  ]);

  ls.set("assetsInv", [
    { id: uid("ai"), name: "MacBook Pro 14", tag: "AST-001", category: "Laptop", serial_number: "SN-2023-001", purchase_date: "2023-01-10", purchase_value: 520000, current_value: 420000, assignedTo: "Ahmed Raza", location: "Main Office", status: "Assigned",...complusory },
    { id: uid("ai"), name: "iPhone 14", tag: "AST-002", category: "Mobile", serial_number: "SN-2023-002", purchase_date: "2023-06-15", purchase_value: 280000, current_value: 220000, assignedTo: "Sara Khan", location: "Main Office", status: "Assigned",...complusory},
  ]);

  ls.set("transfers", [
    { id: uid("tr"), code: "TRF-001", from: "Main Warehouse", to: "Lahore Branch", date: today(), items: 5, approved_by: "System Admin", status: "Completed", notes: "Stock transfer for Lahore branch",...complusory },
  ]);

  ls.set("barcodes", [
    { id: uid("bc"), product_id: "Dell XPS 13", code: "8901234567890", type: "EAN13", printed_at: today() ,...complusory},
    { id: uid("bc"), product_id: "iPhone 15", code: "8901234567892", type: "QR", printed_at: today() ,...complusory},
  ]);

  ls.set("alerts", [
    { id: uid("al"), type: "LOW_STOCK", message: "Samsung Galaxy S24 below reorder level", severity: "High", module: "Inventory", date: today(), resolved: "false",...complusory },
    { id: uid("al"), type: "PENDING_PO", message: "PO-1002 payment pending", severity: "Medium", module: "Inventory", date: today(), resolved: "false" ,...complusory},
  ]);

  ls.set("auditLogs", [
    { id: uid("log"), user_id: "admin@alqaiserit.local", action: "CREATE", module: "System", resource: "System", resource_id: null, old_values: null, new_values: "Seed data created", ip_address: "127.0.0.1", date: new Date().toISOString() ,...complusory},
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

  ls.set("empAssets", [
    { id: uid("ea"), employee_id: "Ahmed Raza", asset: "MacBook Pro 14", asset_tag: "AST-001", assigned_date: "2023-01-10", return_date: null, status: "Active", ...complusory},
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

  ls.set("payroll", [
    { id: uid("pr"), run_code: "PR-2026-04", period_month: 4, period_year: 2026, run_type: "MONTHLY", total_gross: 300000, total_deductions: 7000, total_net: 293000, total_employer_contributions: 15000, approved_by_id: null, paid_at: "2026-04-30", status: "PAID", notes: "April 2026 payroll", ...complusory },
  ]);

  ls.set("payrollSlips", [
    {
      id: uid("psl"),
      payroll_run_id: "PR-2026-04",
      employee_id: "Ahmed Raza",
      basic_salary: 150000,
      house_rent_allowance: 15000,
      medical_allowance: 5000,
      transport_allowance: 10000,
      overtime_hours: 5,
      overtime_amount: 5000,
      bonus: 10000,
      gross_salary: 185000,
      income_tax: 3000,
      eobi_employee: 500,
      eobi_employer: 2500,
      pessi_employee: 300,
      loan_deduction: 0,
      advance_deduction: 0,
      late_deduction: 0,
      absent_deduction: 0,
      total_deductions: 3800,
      net_salary: 181200,
      payment_method: "BANK",
      payment_status: "PAID",
      paid_at: "2026-04-30",
      ...complusory
    },
    {
      id: uid("psl"),
      payroll_run_id: "PR-2026-04",
      employee_id: "Sara Khan",
      basic_salary: 100000,
      house_rent_allowance: 10000,
      medical_allowance: 4000,
      transport_allowance: 6000,
      overtime_hours: 0,
      overtime_amount: 0,
      bonus: 5000,
      gross_salary: 120000,
      income_tax: 1500,
      eobi_employee: 400,
      eobi_employer: 2000,
      pessi_employee: 250,
      loan_deduction: 0,
      advance_deduction: 0,
      late_deduction: 200,
      absent_deduction: 0,
      total_deductions: 2350,
      net_salary: 117650,
      payment_method: "BANK",
      payment_status: "PAID",
      paid_at: "2026-04-30",...complusory
    },
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
    { id: uid("tx"), name: "Sales Tax", tax_type: "Sales Tax", rate: 17, period: "2026", amount: 1500000, account_id: null, is_active: "true",...complusory },
  ]);

  ls.set("forecasts", [
    { id: uid("fc"), period: "Q1-2026", type: "REVENUE", revenue: 8900000, expense: 4200000, profit: 4700000, actual: 8900000, variance: 0, notes: "Q1 actuals" ,...complusory},
    { id: uid("fc"), period: "Q2-2026", type: "REVENUE", revenue: 9500000, expense: 4500000, profit: 5000000, actual: null, variance: null, notes: "Q2 forecast" ,...complusory},
    { id: uid("fc"), period: "Q3-2026", type: "REVENUE", revenue: 10200000, expense: 4800000, profit: 5400000, actual: null, variance: null, notes: "Q3 forecast" ,...complusory},
    { id: uid("fc"), period: "Q4-2026", type: "REVENUE", revenue: 11000000, expense: 5000000, profit: 6000000, actual: null, variance: null, notes: "Q4 forecast" ,...complusory},
  ]);

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  ls.set("settings", {
    theme: "dark",
    notifications: true,
    dateFormat: "YYYY-MM-DD",...complusory
  });

  ls.set(SEED_FLAG, true);
}


// Pre-define features per module for UI reference
const moduleFeatures = {
  HR: [
    "Employee Management", "Payroll", "Time & Attendance", "Leave Management",
    "Shift Management", "Employee Assets", "Performance", "Recruitment",
    "Exit Management", "HR Policies", "Compensation"
  ],
  INVENTORY: [
    "Products", "Stock Management", "Warehouses", "Purchase Orders",
    "Suppliers", "Sales Orders", "Assets Inventory", "Inventory Transfers",
    "Barcode & QR", "Reports", "Alerts", "POS"
  ],
  FINANCE: [
    "Chart of Accounts", "Invoices", "Expenses", "Payables", "Receivables",
    "Budgets", "Bank & Cash", "Fixed Assets", "Taxes", "Reports", "Forecasting"
  ],
  SETTINGS: [
    "Company Profile", "Users & Roles", "Departments", "Designations", "Preferences"
  ]
};

// Get all users to assign permissions
const users = ls.get("users", []);
const permissions = [];

// Helper to create permission entry
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

// Assign permissions per user
users.forEach((user) => {
  if (user.role === "COMPANY_ADMIN") {
    // Company Admin gets FULL ACCESS to everything
    Object.entries(moduleFeatures).forEach(([module, features]) => {
      features.forEach((feature) => {
        permissions.push(createPermission(user.id, module, feature, true, true, true, true));
      });
    });
  } else if (user.role === "BRANCH_ADMIN") {
    // Branch Admin gets FULL ACCESS but only to their assigned module
    const userModule = user.department || "INVENTORY";
    if (moduleFeatures[userModule]) {
      moduleFeatures[userModule].forEach((feature) => {
        permissions.push(createPermission(user.id, userModule, feature, true, true, true, true));
      });
    }
  } else if (user.role === "STAFF") {
    // Staff gets VIEW and limited CREATE/UPDATE based on department
    const userModule = user.department || "INVENTORY";
    if (moduleFeatures[userModule]) {
      moduleFeatures[userModule].forEach((feature) => {
        // Staff can view everything, create/update limited to their area
        const canCreate = feature === "Expenses" || feature === "Leave Management" || feature === "Attendance";
        const canUpdate = feature === "Expenses" || feature === "Leave Management" || feature === "Time & Attendance";
        permissions.push(createPermission(user.id, userModule, feature, canCreate, canUpdate, false, true));
      });
    }
  }
});

// Add some specific overrides for demo
const adminUser = users.find(u => u.email === "admin@alqaiserit.local");
const hrUser = users.find(u => u.email === "hr@alqaiserit.local");
const financeUser = users.find(u => u.email === "finance@alqaiserit.local");

if (adminUser) {
  // Admin already has full access from above
}

if (hrUser) {
  // HR gets additional permissions for HR module
  moduleFeatures.HR.forEach((feature) => {
    permissions.push(createPermission(hrUser.id, "HR", feature, true, true, true, true));
  });
}

if (financeUser) {
  // Finance gets additional permissions
  moduleFeatures.FINANCE.forEach((feature) => {
    permissions.push(createPermission(financeUser.id, "FINANCE", feature, true, true, true, true));
  });
}

ls.set("permissions", permissions);

// Also store feature list for dropdowns
ls.set("moduleFeatures", moduleFeatures);