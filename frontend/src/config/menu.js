
import {
  LayoutDashboard, Boxes, Package, Layers, Warehouse, ShoppingCart, Truck, Repeat,
  QrCode, BarChart3, Bell, ScanLine, FileText, Users, Wallet, CalendarClock,
  CalendarDays, Clock, Briefcase, TrendingUp, UserPlus, LogOut as LogOutIcon, Shield,
  HandCoins, BookOpen, Receipt, CreditCard, ArrowDownCircle, ArrowUpCircle, Target,
  Landmark, Coins, Calculator, LineChart, History, Settings, UserCog, Building2,
  Cpu, ClipboardList,
  Calendar,
  Sparkles,
  Tag,
  Eye,
  Camera,
  DoorOpen,
  Video,
} from "lucide-react";

export const menu = [
  { type: "link", title: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },

  {
    type: "group",
    title: "Human Resources",
    icon: Users,
    children: [
      { title: "Employee Management", to: "/hr/employees", icon: Users },
      { title: "Payroll", to: "/hr/payroll", icon: Wallet },
      { title: "Time & Attendance", to: "/hr/attendance", icon: CalendarClock },
      { title: "Leave Management", to: "/hr/leave", icon: CalendarDays },
      {
        title: "Shift Management",
        icon: Clock,
        children: [
          { title: "Shifts", to: "/hr/shifts/list", icon: Layers },
          { title: "Shift Templates", to: "/hr/shifts/templates", icon: Layers },
        ],
      },
      {
        title: "Employee Assets",
        icon: Briefcase,
        children: [
          { title: "Assets", to: "/hr/assets/list", icon: Briefcase },
          { title: "Asset Categories", to: "/hr/assets/categories", icon: Layers },
          { title: "Employee Assignments", to: "/hr/assets/employee-assets", icon: Users },
        ],
      },
      { title: "Performance", to: "/hr/performance", icon: TrendingUp },
      { title: "Recruitment", to: "/hr/recruitment", icon: UserPlus },
      { title: "Exit Management", to: "/hr/exit", icon: LogOutIcon },
      { title: "HR Policies", to: "/hr/policies", icon: Shield },
      { title: "Compensation & Loan", to: "/hr/compensation", icon: HandCoins },
    ],
  },

  {
    type: "group",
    title: "Inventory",
    icon: Boxes,
    children: [
      { title: "Inventory Dashboard", to: "/inventory/dashboard", icon: LayoutDashboard },
      { title: "Categories", to: "/inventory/categories", icon: Layers },
      { title: "Brands", to: "/inventory/brands", icon: Tag },
      { title: "Product Management", to: "/inventory/products", icon: Package },
      { title: "Stock Management", to: "/inventory/stock", icon: Layers },
      { title: "Warehouse Management", to: "/inventory/warehouses", icon: Warehouse },
      { title: "Purchase Management", to: "/inventory/purchases", icon: ShoppingCart },
      { title: "Suppliers & Vendors", to: "/inventory/suppliers", icon: Truck },
      { title: "Sales Integration", to: "/inventory/sales", icon: Receipt },
      { title: "Assets Inventory", to: "/inventory/assets", icon: Cpu },
      { title: "Inventory Transfers", to: "/inventory/transfers", icon: Repeat },
      { title: "Barcode & QR", to: "/inventory/barcode", icon: QrCode },
      { title: "Reports", to: "/inventory/reports", icon: BarChart3 },
      { title: "Alerts", to: "/inventory/alerts", icon: Bell },
      { title: "Selling / POS", to: "/inventory/pos", icon: ScanLine },
      { title: "Audit Logs", to: "/inventory/audit", icon: FileText },
    ],
  },

  {
    type: "group",
    title: "Finance",
    icon: Wallet,
    children: [
      { title: "Finance Dashboard", to: "/finance", icon: LayoutDashboard },
      { title: "Accounts", to: "/finance/accounts", icon: BookOpen },
      { title: "Invoices", to: "/finance/invoices", icon: Receipt },
      { title: "Expenses", to: "/finance/expenses", icon: CreditCard },
      { title: "Payables", to: "/finance/payables", icon: ArrowUpCircle },
      { title: "Receivables", to: "/finance/receivables", icon: ArrowDownCircle },
      { title: "Budgets", to: "/finance/budgets", icon: Target },
      { title: "Bank & Cash", to: "/finance/bank", icon: Landmark },
      { title: "Payroll Finance", to: "/finance/payroll", icon: Wallet },
      { title: "Assets", to: "/finance/assets", icon: Coins },
      { title: "Taxes", to: "/finance/taxes", icon: Calculator },
      { title: "Reports", to: "/finance/reports", icon: BarChart3 },
      { title: "Forecasting", to: "/finance/forecasting", icon: LineChart },
      { title: "Audit Logs", to: "/finance/audit", icon: History },
      { title: "Settings", to: "/finance/settings", icon: Settings },
    ],
  },

    {
    type: "group",
    title: "AI Monitoring",
    icon: Eye,
    children: [
      { title: "Live Dashboard", to: "/monitoring/dashboard", icon: Video },
      { title: "Activity Tracking", to: "/monitoring/activiy-tracking", icon: DoorOpen },
      { title: "Inventory Monitoring", to: "/monitoring/inventory-monitoring", icon: Camera },
      { title: "Workforce Monitoring", to: "/monitoring/workforce-monitoring", icon: Video },
      { title: "Alerts & Events", to: "/monitoring/alerts-events", icon: DoorOpen },
      { title: "Reports & Insights", to: "/monitoring/reports-insights", icon: Camera },
    ],
  },

  {
    type: "group",
    title: "Settings",
    icon: Settings,
    children: [
      { title: "Company Profile", to: "/settings/company", icon: Building2 },
      { title: "Users & Roles", to: "/settings/users", icon: UserCog },
      { title: "Departments", to: "/settings/departments", icon: ClipboardList },
      { title: "Designations", to: "/settings/designations", icon: Briefcase },
      { title: "Leave Types", to: "/settings/leave-types", icon: CalendarDays },
      { title: "Preferences", to: "/settings/preferences", icon: Settings },
    ],
  },
];

