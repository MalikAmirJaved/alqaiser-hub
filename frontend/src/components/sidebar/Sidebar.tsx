// components/sidebar/Sidebar.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { ChevronDown, ChevronRight } from "lucide-react";
import { menu } from "@/config/menu";
import { motion, AnimatePresence } from "framer-motion";

export default function Sidebar({ open, onClose }) {
  const path = usePathname() || "";
  const permissions = useSelector((state: RootState) => state.permissions.permissions);

  // Case‑insensitive permission check
  const hasPermission = (permCode: string) =>
    permissions.some(p => p.toLowerCase() === permCode.toLowerCase());

  const getPermissionForMenuItem = useMemo(() => {
    const mapping: Record<string, string | null> = {
      Dashboard: null,
      // HR
      "Employee Management": "HR:employee:view",
      Payroll: "HR:payroll:view",
      "Time & Attendance": "HR:attendance:view",
      "Leave Management": "HR:leave:view",
      Performance: "HR:performance:view",
      Recruitment: "HR:recruitment:view",
      "Exit Management": "HR:exit:view",
      "HR Policies": "HR:policy:view",
      "Compensation & Loan": "HR:compensation:view",
      // HR nested items
      Shifts: "HR:shift_override:view",
      "Shift Templates": "HR:shift_template:view",
      "HR Assets": "HR:asset:view",          // renamed to avoid duplicate
      "Asset Kits": "HR:asset_category:view",
      "Employee Assignments": "HR:asset:assign",
      // Inventory
      "Inventory Dashboard": "INVENTORY:dashboard:view",
      Categories: "INVENTORY:category:view",
      Brands: "INVENTORY:brand:view",
      "Product Management": "INVENTORY:product:view",
      "Stock Management": "INVENTORY:stock:view",
      "Warehouse Management": "INVENTORY:warehouse:view",
      "Purchase Management": "INVENTORY:purchase_order:view",
      "Suppliers & Vendors": "INVENTORY:supplier:view",
      "Assets Inventory": "INVENTORY:asset:view",
      "Inventory Transfers": "INVENTORY:stock_transfer:view",
      "Barcode & QR": "INVENTORY:barcode:view",
      Reports: "INVENTORY:report:view",
      Alerts: "INVENTORY:alert:view",
      Customers: "INVENTORY:customer:view",
      "Selling / POS": "INVENTORY:sales_order:create",
      "Audit Logs": "INVENTORY:audit_log:view",
      // Finance
      "Finance Dashboard": "FINANCE:dashboard:view",
      Accounts: "FINANCE:account:view",
      Invoices: "FINANCE:invoice:view",
      Expenses: "FINANCE:expense:view",
      Payables: "FINANCE:payable:view",
      Receivables: "FINANCE:receivable:view",
      Budgets: "FINANCE:budget:view",
      "Bank & Cash": "FINANCE:bank:view",
      "Payroll Finance": "FINANCE:payroll:view",
      "Finance Assets": "FINANCE:asset:view", // renamed to avoid duplicate
      Taxes: "FINANCE:tax:view",
      Forecasting: "FINANCE:forecast:view",
      "Finance Settings": "FINANCE:setting:view",
      // AI Monitoring
      "Live Dashboard": "AI_MONITORING:live_dashboard:view",
      "Activity Tracking": "AI_MONITORING:activity:view",
      "Inventory Monitoring": "AI_MONITORING:inventory_monitoring:view",
      "Workforce Monitoring": "AI_MONITORING:workforce:view",
      "Alerts & Events": "AI_MONITORING:alert:view",
      "Reports & Insights": "AI_MONITORING:report:view",
      // Settings
      "Company Profile": "SETTINGS:company:view",
      "Users & Roles": "SETTINGS:user:view",
      Departments: "SETTINGS:department:view",
      Designations: "SETTINGS:designation:view",
      Preferences: "SETTINGS:preference:view",
    };
    return (title: string, parentTitle?: string) => {
      // Exact match
      if (mapping[title]) return mapping[title];
      // Fallback for nested groups
      if (parentTitle === "Shift Management") {
        if (title === "Shifts") return mapping["Shifts"];
        if (title === "Shift Templates") return mapping["Shift Templates"];
      }
      if (parentTitle === "Employee Assets") {
        if (title === "Assets") return mapping["HR Assets"];
        if (title === "Asset Kits") return mapping["Asset Kits"];
        if (title === "Employee Assignments") return mapping["Employee Assignments"];
      }
      return null;
    };
  }, []);

  // Recursively filter menu items – treat items with 'to' as links
  const filteredMenu = useMemo(() => {
    const filterItems = (items: any[], parentTitle?: string): any[] => {
      return items.reduce((acc: any[], item) => {
        const isLink = !!item.to;
        const isGroup = !isLink && item.children && item.children.length > 0;

        if (isLink) {
          const perm = getPermissionForMenuItem(item.title, parentTitle);
          if (!perm) {
            acc.push(item);               // Dashboard
          } else if (hasPermission(perm)) {
            acc.push(item);
          } else {
          }
        } else if (isGroup) {
          const filteredChildren = filterItems(item.children, item.title);
          if (filteredChildren.length > 0) {
            acc.push({ ...item, children: filteredChildren });
          } else {
          }
        }
        return acc;
      }, []);
    };
    return filterItems(menu);
  }, [permissions, getPermissionForMenuItem]);

  // Expanded groups state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    const findAndOpenGroups = (items: any[], parentIndex: string | null = null) => {
      items.forEach((m, i) => {
        const groupKey = parentIndex !== null ? `${parentIndex}-${i}` : String(i);
        if (m.children && m.children.length) {
          const hasActiveChild = m.children.some((c: any) =>
            c.to && (path === c.to || path.startsWith(c.to + "/"))
          );
          if (hasActiveChild) initial[groupKey] = true;
          // nested groups
          m.children.forEach((child: any, childIndex: number) => {
            if (child.children) {
              const nestedKey = `${groupKey}-${childIndex}`;
              if (child.children.some((subC: any) => path.startsWith(subC.to))) {
                initial[nestedKey] = true;
                initial[groupKey] = true;
              }
            }
          });
        }
      });
    };
    findAndOpenGroups(filteredMenu);
    setOpenGroups(initial);
  }, [path, filteredMenu]);

  const toggle = (key: string) => setOpenGroups((s) => ({ ...s, [key]: !s[key] }));
  const isActive = (to: string) => path === to || (to !== "/dashboard" && path.startsWith(to + "/"));

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-50 transition-transform duration-200 flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">C</div>
            <div className="font-semibold text-sm">Company Name</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {filteredMenu.map((item, i) =>
            item.to ? (
              <Link
                key={item.title}
                href={item.to}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                  isActive(item.to)
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.title}</span>
              </Link>
            ) : (
              <div key={item.title}>
                <button
                  onClick={() => toggle(String(i))}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent"
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="w-4 h-4" />
                    {item.title}
                  </span>
                  {openGroups[String(i)] ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {openGroups[String(i)] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden ml-3 border-l border-sidebar-border pl-2"
                    >
                      {item.children.map((c: any, childIndex: number) => {
                        if (c.children && c.children.length) {
                          // Nested group (Shift Management / Employee Assets)
                          const nestedKey = `${String(i)}-${childIndex}`;
                          const isNestedOpen = openGroups[nestedKey];
                          return (
                            <div key={c.title}>
                              <button
                                onClick={() => toggle(nestedKey)}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 my-0.5 rounded-md text-[13px] hover:bg-sidebar-accent"
                              >
                                <span className="flex items-center gap-2">
                                  <c.icon className="w-3.5 h-3.5" />
                                  {c.title}
                                </span>
                                {isNestedOpen ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <AnimatePresence>
                                {isNestedOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="overflow-hidden ml-3 border-l border-sidebar-border pl-2"
                                  >
                                    {c.children.map((subC: any) => {
                                      const subPerm = getPermissionForMenuItem(subC.title, c.title);
                                      if (subPerm && !hasPermission(subPerm)) return null;
                                      return (
                                        <Link
                                          key={subC.to}
                                          href={subC.to}
                                          onClick={onClose}
                                          className={`flex items-center gap-2 px-3 py-2 my-0.5 rounded-md text-[13px] transition ${
                                            isActive(subC.to)
                                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                              : "hover:bg-sidebar-accent text-sidebar-foreground/85"
                                          }`}
                                        >
                                          <subC.icon className="w-3.5 h-3.5" />
                                          {subC.title}
                                        </Link>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        }
                        // Regular child link
                        const perm = getPermissionForMenuItem(c.title, item.title);
                        if (perm && !hasPermission(perm)) return null;
                        return (
                          <Link
                            key={c.to}
                            href={c.to}
                            onClick={onClose}
                            className={`flex items-center gap-2 px-3 py-2 my-0.5 rounded-md text-[13px] transition ${
                              isActive(c.to)
                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                : "hover:bg-sidebar-accent text-sidebar-foreground/85"
                            }`}
                          >
                            <c.icon className="w-3.5 h-3.5" />
                            {c.title}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          )}
        </nav>
      </aside>
    </>
  );
}