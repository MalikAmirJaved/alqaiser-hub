import { ls, uid } from "../services/localStorageService";

const SEED_FLAG = "seeded_v1";

const today = () => new Date().toISOString().slice(0, 10);

export function initializeSystem() {
  if (ls.get(SEED_FLAG)) return;

  ls.set("company", {
    name: "Al Qaiser IT Company",
    system: "Clickmasters BOS",
    address: "Karachi, Pakistan",
    email: "info@alqaiserit.local",
    phone: "+92-300-0000000",
    currency: "PKR",
    taxId: "AQT-9087-IT",
  });

  ls.set("users", [
    { id: uid("u"), name: "System Admin", email: "admin@alqaiserit.local", password: "admin123", role: "Admin", status: "Active" },
    { id: uid("u"), name: "HR Manager", email: "hr@alqaiserit.local", password: "hr12345", role: "HR", status: "Active" },
    { id: uid("u"), name: "Finance Lead", email: "finance@alqaiserit.local", password: "fin12345", role: "Finance", status: "Active" },
  ]);

  ls.set("departments", [
    { id: uid("dep"), name: "Engineering", head: "Ahmed Raza", employees: 12 },
    { id: uid("dep"), name: "Sales", head: "Sara Khan", employees: 8 },
    { id: uid("dep"), name: "Support", head: "Bilal Ahmed", employees: 6 },
    { id: uid("dep"), name: "Finance", head: "Nadia Ali", employees: 4 },
  ]);

  ls.set("designations", [
    { id: uid("dsg"), title: "Software Engineer", level: "Mid" },
    { id: uid("dsg"), title: "Senior Engineer", level: "Senior" },
    { id: uid("dsg"), title: "Sales Executive", level: "Mid" },
    { id: uid("dsg"), title: "Accountant", level: "Mid" },
  ]);

  ls.set("employees", [
    { id: uid("emp"), code: "EMP-001", name: "Ahmed Raza", department: "Engineering", designation: "Senior Engineer", email: "ahmed@alqaiserit.local", phone: "+92-301-1111111", salary: 180000, joinDate: "2022-03-01", status: "Active" },
    { id: uid("emp"), code: "EMP-002", name: "Sara Khan", department: "Sales", designation: "Sales Executive", email: "sara@alqaiserit.local", phone: "+92-301-2222222", salary: 120000, joinDate: "2023-01-15", status: "Active" },
    { id: uid("emp"), code: "EMP-003", name: "Bilal Ahmed", department: "Support", designation: "Software Engineer", email: "bilal@alqaiserit.local", phone: "+92-301-3333333", salary: 95000, joinDate: "2023-08-10", status: "Active" },
    { id: uid("emp"), code: "EMP-004", name: "Nadia Ali", department: "Finance", designation: "Accountant", email: "nadia@alqaiserit.local", phone: "+92-301-4444444", salary: 110000, joinDate: "2021-11-20", status: "Active" },
  ]);

  ls.set("categories", [
    { id: uid("cat"), name: "Laptops", parent: "-" },
    { id: uid("cat"), name: "Mobiles", parent: "-" },
    { id: uid("cat"), name: "Accessories", parent: "-" },
    { id: uid("cat"), name: "Networking", parent: "-" },
  ]);

  ls.set("brands", [
    { id: uid("br"), name: "Dell", country: "USA" },
    { id: uid("br"), name: "HP", country: "USA" },
    { id: uid("br"), name: "Apple", country: "USA" },
    { id: uid("br"), name: "Samsung", country: "Korea" },
  ]);

  ls.set("warehouses", [
    { id: uid("wh"), name: "Main Warehouse", location: "Karachi", manager: "Ahmed Raza", capacity: 5000 },
    { id: uid("wh"), name: "Lahore Branch", location: "Lahore", manager: "Sara Khan", capacity: 2000 },
  ]);

  ls.set("products", [
    { id: uid("p"), sku: "DLL-XPS-13", name: "Dell XPS 13", category: "Laptops", brand: "Dell", price: 320000, cost: 280000, stock: 12, reorder: 3, status: "Active" },
    { id: uid("p"), sku: "HP-PAV-15", name: "HP Pavilion 15", category: "Laptops", brand: "HP", price: 180000, cost: 150000, stock: 8, reorder: 4, status: "Active" },
    { id: uid("p"), sku: "APL-IP-15", name: "iPhone 15", category: "Mobiles", brand: "Apple", price: 410000, cost: 360000, stock: 6, reorder: 2, status: "Active" },
    { id: uid("p"), sku: "SMS-S24", name: "Samsung Galaxy S24", category: "Mobiles", brand: "Samsung", price: 295000, cost: 260000, stock: 2, reorder: 5, status: "Low" },
    { id: uid("p"), sku: "ACC-MS-01", name: "Wireless Mouse", category: "Accessories", brand: "HP", price: 2500, cost: 1500, stock: 120, reorder: 20, status: "Active" },
  ]);

  ls.set("stockMoves", [
    { id: uid("sm"), date: today(), type: "IN", product: "Dell XPS 13", qty: 5, warehouse: "Main Warehouse", note: "Restock" },
    { id: uid("sm"), date: today(), type: "OUT", product: "iPhone 15", qty: 1, warehouse: "Main Warehouse", note: "Sale" },
  ]);

  ls.set("suppliers", [
    { id: uid("sup"), name: "TechWorld Distributors", contact: "Mr. Adeel", email: "adeel@techworld.com", phone: "+92-21-1234567", balance: 250000, status: "Active" },
    { id: uid("sup"), name: "Karachi Computers", contact: "Mr. Faisal", email: "faisal@kc.com", phone: "+92-21-2345678", balance: 80000, status: "Active" },
  ]);

  ls.set("purchaseOrders", [
    { id: uid("po"), code: "PO-1001", supplier: "TechWorld Distributors", date: today(), total: 1200000, status: "Received" },
    { id: uid("po"), code: "PO-1002", supplier: "Karachi Computers", date: today(), total: 350000, status: "Pending" },
  ]);

  ls.set("salesOrders", [
    { id: uid("so"), code: "SO-2001", customer: "Walk-in", date: today(), total: 320000, status: "Paid" },
    { id: uid("so"), code: "SO-2002", customer: "Acme Corp", date: today(), total: 890000, status: "Pending" },
  ]);

  ls.set("posReceipts", [
    { id: uid("rcp"), code: "RCP-3001", cashier: "Sara Khan", date: today(), total: 45000, items: 3, payment: "Cash" },
  ]);

  ls.set("assetsInv", [
    { id: uid("ai"), name: "MacBook Pro 14", tag: "AST-001", category: "Laptop", assignedTo: "Ahmed Raza", value: 520000, status: "Assigned" },
    { id: uid("ai"), name: "iPhone 14", tag: "AST-002", category: "Mobile", assignedTo: "Sara Khan", value: 280000, status: "Assigned" },
  ]);

  ls.set("transfers", [
    { id: uid("tr"), code: "TRF-001", from: "Main Warehouse", to: "Lahore Branch", date: today(), items: 5, status: "Completed" },
  ]);

  ls.set("barcodes", [
    { id: uid("bc"), product: "Dell XPS 13", code: "DLL-XPS-13", type: "Barcode" },
    { id: uid("bc"), product: "iPhone 15", code: "APL-IP-15", type: "QR" },
  ]);

  ls.set("alerts", [
    { id: uid("al"), type: "Low Stock", message: "Samsung Galaxy S24 below reorder level", severity: "High", date: today() },
    { id: uid("al"), type: "Payment Due", message: "PO-1002 payment pending", severity: "Medium", date: today() },
  ]);

  ls.set("auditLogs", [
    { id: uid("log"), user: "admin@alqaiserit.local", action: "System Initialized", module: "System", date: new Date().toISOString() },
  ]);

  // HR
  ls.set("attendance", [
    { id: uid("at"), date: today(), employee: "Ahmed Raza", checkIn: "09:05", checkOut: "18:10", status: "Present" },
    { id: uid("at"), date: today(), employee: "Sara Khan", checkIn: "09:20", checkOut: "18:00", status: "Present" },
    { id: uid("at"), date: today(), employee: "Bilal Ahmed", checkIn: "-", checkOut: "-", status: "Absent" },
  ]);
  ls.set("leaves", [
    { id: uid("lv"), employee: "Sara Khan", type: "Casual", from: today(), to: today(), days: 1, status: "Approved" },
  ]);
  ls.set("shifts", [
    { id: uid("sh"), name: "Morning", start: "09:00", end: "18:00", employees: 18 },
    { id: uid("sh"), name: "Evening", start: "14:00", end: "23:00", employees: 6 },
  ]);
  ls.set("empAssets", [
    { id: uid("ea"), employee: "Ahmed Raza", asset: "MacBook Pro 14", date: today(), status: "Active" },
  ]);
  ls.set("performance", [
    { id: uid("pf"), employee: "Ahmed Raza", period: "Q1-2026", score: 92, rating: "Excellent" },
    { id: uid("pf"), employee: "Sara Khan", period: "Q1-2026", score: 81, rating: "Good" },
  ]);
  ls.set("recruitment", [
    { id: uid("rc"), name: "Hamza Iqbal", position: "Backend Engineer", stage: "Interview", date: today(), status: "Active" },
  ]);
  ls.set("exits", [
    { id: uid("ex"), employee: "Junaid M.", date: today(), reason: "Resigned", clearance: "Pending" },
  ]);
  ls.set("policies", [
    { id: uid("pol"), title: "Leave Policy", category: "HR", updated: today(), status: "Active" },
    { id: uid("pol"), title: "Code of Conduct", category: "HR", updated: today(), status: "Active" },
  ]);
  ls.set("compensation", [
    { id: uid("cp"), employee: "Ahmed Raza", basic: 150000, allowances: 30000, total: 180000 },
  ]);
  ls.set("payroll", [
    { id: uid("pr"), employee: "Ahmed Raza", month: "2026-04", basic: 150000, bonus: 10000, deduction: 5000, net: 155000, status: "Paid" },
    { id: uid("pr"), employee: "Sara Khan", month: "2026-04", basic: 100000, bonus: 5000, deduction: 2000, net: 103000, status: "Paid" },
  ]);

  // Finance
  ls.set("accounts", [
    { id: uid("acc"), code: "1001", name: "Cash", type: "Asset", balance: 1500000 },
    { id: uid("acc"), code: "1002", name: "Bank - Meezan", type: "Asset", balance: 4200000 },
    { id: uid("acc"), code: "2001", name: "Accounts Payable", type: "Liability", balance: 350000 },
    { id: uid("acc"), code: "4001", name: "Sales Revenue", type: "Income", balance: 8900000 },
  ]);
  ls.set("invoices", [
    { id: uid("inv"), code: "INV-9001", customer: "Acme Corp", date: today(), amount: 890000, status: "Pending" },
    { id: uid("inv"), code: "INV-9002", customer: "Walk-in", date: today(), amount: 320000, status: "Paid" },
  ]);
  ls.set("expenses", [
    { id: uid("ex"), category: "Utilities", date: today(), amount: 45000, vendor: "K-Electric", status: "Paid" },
    { id: uid("ex"), category: "Rent", date: today(), amount: 250000, vendor: "Office Landlord", status: "Paid" },
  ]);
  ls.set("payables", [
    { id: uid("pay"), vendor: "TechWorld Distributors", due: today(), amount: 250000, status: "Pending" },
  ]);
  ls.set("receivables", [
    { id: uid("rec"), customer: "Acme Corp", due: today(), amount: 890000, status: "Pending" },
  ]);
  ls.set("budgets", [
    { id: uid("bg"), department: "Engineering", period: "2026", allocated: 5000000, spent: 1200000 },
    { id: uid("bg"), department: "Sales", period: "2026", allocated: 3000000, spent: 800000 },
  ]);
  ls.set("bankAccounts", [
    { id: uid("ba"), bank: "Meezan", account: "0123-456789", branch: "Karachi", balance: 4200000 },
    { id: uid("ba"), bank: "HBL", account: "9876-543210", branch: "Lahore", balance: 1800000 },
  ]);
  ls.set("financeAssets", [
    { id: uid("fa"), name: "Office Vehicle", value: 3500000, depreciation: 350000, status: "Active" },
  ]);
  ls.set("taxes", [
    { id: uid("tx"), name: "Sales Tax", rate: 17, period: "2026", amount: 1500000 },
  ]);
  ls.set("forecasts", [
    { id: uid("fc"), period: "Q1-2026", revenue: 8900000, expense: 4200000, profit: 4700000 },
    { id: uid("fc"), period: "Q2-2026", revenue: 9500000, expense: 4500000, profit: 5000000 },
    { id: uid("fc"), period: "Q3-2026", revenue: 10200000, expense: 4800000, profit: 5400000 },
    { id: uid("fc"), period: "Q4-2026", revenue: 11000000, expense: 5000000, profit: 6000000 },
  ]);

  ls.set("settings", {
    theme: "dark",
    notifications: true,
    dateFormat: "YYYY-MM-DD",
  });

  ls.set(SEED_FLAG, true);
}
