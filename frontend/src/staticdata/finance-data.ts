// Mock finance data for UI demonstration only
export const fmtCurrency = (n: number, c = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

export const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

export const kpis = {
  revenue: 12_487_320,
  revenueDelta: 8.4,
  expenses: 7_124_980,
  expensesDelta: 3.2,
  netProfit: 5_362_340,
  netProfitDelta: 14.1,
  cash: 9_842_110,
  cashDelta: -2.3,
  receivables: 2_184_500,
  payables: 1_402_700,
  outstandingInvoices: 184,
  overdueBills: 27,
};

export const revenueTrend = [
  { m: "Jan", rev: 820, exp: 540 }, { m: "Feb", rev: 910, exp: 580 },
  { m: "Mar", rev: 880, exp: 600 }, { m: "Apr", rev: 1020, exp: 640 },
  { m: "May", rev: 1180, exp: 690 }, { m: "Jun", rev: 1240, exp: 720 },
  { m: "Jul", rev: 1310, exp: 780 }, { m: "Aug", rev: 1280, exp: 760 },
  { m: "Sep", rev: 1390, exp: 810 }, { m: "Oct", rev: 1420, exp: 840 },
  { m: "Nov", rev: 1510, exp: 880 }, { m: "Dec", rev: 1620, exp: 920 },
];

export const cashflowData = [
  { m: "Jan", inflow: 920, outflow: -640 }, { m: "Feb", inflow: 980, outflow: -700 },
  { m: "Mar", inflow: 1040, outflow: -720 }, { m: "Apr", inflow: 1120, outflow: -760 },
  { m: "May", inflow: 1240, outflow: -820 }, { m: "Jun", inflow: 1310, outflow: -870 },
];

export const expenseBreakdown = [
  { name: "Payroll", value: 3120000 },
  { name: "Operations", value: 1480000 },
  { name: "Marketing", value: 980000 },
  { name: "R&D", value: 760000 },
  { name: "Admin", value: 420000 },
  { name: "Travel", value: 364980 },
];

export const departmentSpend = [
  { dep: "Engineering", actual: 1820, budget: 2000 },
  { dep: "Sales", actual: 1240, budget: 1100 },
  { dep: "Marketing", actual: 980, budget: 1200 },
  { dep: "Operations", actual: 1480, budget: 1500 },
  { dep: "Finance", actual: 420, budget: 500 },
  { dep: "HR", actual: 360, budget: 400 },
];

export const recentTransactions = [
  { id: "JE-10428", date: "2026-06-02", account: "Bank — Chase Operating", desc: "Payroll batch #214", debit: 0, credit: 312_400, status: "Posted" },
  { id: "INV-5821", date: "2026-06-02", account: "Accounts Receivable", desc: "Acme Corp — Invoice #5821", debit: 84_200, credit: 0, status: "Sent" },
  { id: "BILL-2204", date: "2026-06-01", account: "Accounts Payable", desc: "AWS Cloud Services — May", debit: 0, credit: 42_180, status: "Approved" },
  { id: "JE-10427", date: "2026-06-01", account: "Office Rent Expense", desc: "HQ rent — June", debit: 38_000, credit: 0, status: "Posted" },
  { id: "EXP-0912", date: "2026-05-31", account: "Travel Expense", desc: "Reimbursement — J. Patel", debit: 2_480, credit: 0, status: "Pending" },
  { id: "PAY-7741", date: "2026-05-31", account: "Bank — Wells Fargo", desc: "Vendor batch — May W4", debit: 0, credit: 184_900, status: "Cleared" },
  { id: "INV-5820", date: "2026-05-30", account: "Accounts Receivable", desc: "Globex Ltd — Invoice #5820", debit: 162_000, credit: 0, status: "Paid" },
  { id: "JE-10426", date: "2026-05-30", account: "Depreciation Expense", desc: "Monthly depreciation run", debit: 24_300, credit: 0, status: "Posted" },
];

export const pendingApprovals = [
  { id: "BILL-2210", type: "Bill", title: "Salesforce — Annual subscription", amount: 184_000, requester: "M. Hughes", age: "2h" },
  { id: "EXP-0915", type: "Expense", title: "Client dinner — Tokyo", amount: 2_140, requester: "K. Nakamura", age: "5h" },
  { id: "JE-10429", type: "Journal", title: "Reclassification — Q2 accruals", amount: 412_000, requester: "S. Romero", age: "1d" },
  { id: "PAY-7745", type: "Payment", title: "Vendor batch — June W1", amount: 612_400, requester: "Treasury Bot", age: "1d" },
  { id: "BUD-0042", type: "Budget", title: "Marketing — Q3 uplift", amount: 240_000, requester: "L. Park", age: "2d" },
];

export const bankBalances = [
  { name: "Chase — Operating", currency: "USD", balance: 4_218_400 },
  { name: "Wells Fargo — Payroll", currency: "USD", balance: 1_842_900 },
  { name: "HSBC — UK", currency: "GBP", balance: 982_100 },
  { name: "DBS — APAC", currency: "SGD", balance: 1_412_500 },
  { name: "Deutsche — EU", currency: "EUR", balance: 1_386_210 },
];

export const customerInvoices = Array.from({ length: 14 }).map((_, i) => {
  const statuses = ["Paid", "Sent", "Overdue", "Draft", "Partial"] as const;
  const customers = ["Acme Corp", "Globex Ltd", "Initech", "Umbrella Co", "Soylent Inc", "Wayne Enterprises", "Stark Industries", "Tyrell Corp"];
  const amount = 12_000 + Math.round(Math.random() * 220_000);
  return {
    id: `INV-${5800 + i}`,
    customer: customers[i % customers.length],
    issued: `2026-05-${String(28 - i).padStart(2, "0")}`,
    due: `2026-06-${String(15 - (i % 14)).padStart(2, "0")}`,
    amount,
    balance: i % 3 === 0 ? 0 : Math.round(amount * (Math.random() * 0.6)),
    currency: "USD",
    status: statuses[i % statuses.length],
  };
});

export const supplierBills = Array.from({ length: 12 }).map((_, i) => {
  const statuses = ["Approved", "Pending", "Paid", "Overdue", "Draft"] as const;
  const vendors = ["AWS", "Salesforce", "Adobe", "Slack", "Stripe", "WeWork", "FedEx", "Oracle"];
  return {
    id: `BILL-${2200 + i}`,
    vendor: vendors[i % vendors.length],
    received: `2026-05-${String(28 - i).padStart(2, "0")}`,
    due: `2026-06-${String(20 - (i % 18)).padStart(2, "0")}`,
    amount: 4_000 + Math.round(Math.random() * 120_000),
    currency: "USD",
    status: statuses[i % statuses.length],
  };
});

export const chartOfAccounts = [
  { code: "1000", name: "Assets", type: "Asset", balance: 18_420_000, children: [
    { code: "1100", name: "Current Assets", type: "Asset", balance: 11_240_000, children: [
      { code: "1110", name: "Cash & Cash Equivalents", type: "Asset", balance: 9_842_110 },
      { code: "1120", name: "Accounts Receivable", type: "Asset", balance: 2_184_500 },
      { code: "1130", name: "Inventory", type: "Asset", balance: 1_213_390 },
    ]},
    { code: "1500", name: "Fixed Assets", type: "Asset", balance: 7_180_000, children: [
      { code: "1510", name: "Buildings", type: "Asset", balance: 4_200_000 },
      { code: "1520", name: "Equipment", type: "Asset", balance: 2_980_000 },
    ]},
  ]},
  { code: "2000", name: "Liabilities", type: "Liability", balance: 6_120_000, children: [
    { code: "2100", name: "Current Liabilities", type: "Liability", balance: 3_240_000, children: [
      { code: "2110", name: "Accounts Payable", type: "Liability", balance: 1_402_700 },
      { code: "2120", name: "Accrued Expenses", type: "Liability", balance: 842_300 },
    ]},
    { code: "2500", name: "Long-Term Debt", type: "Liability", balance: 2_880_000 },
  ]},
  { code: "3000", name: "Equity", type: "Equity", balance: 12_300_000 },
  { code: "4000", name: "Revenue", type: "Revenue", balance: 12_487_320 },
  { code: "5000", name: "Expenses", type: "Expense", balance: 7_124_980 },
];
