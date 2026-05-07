"use client";
// ============================================
// FILE: src/components/sidebar/Sidebar.jsx (UPDATED - Supports Nested Groups)
// ============================================

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { menu } from "@/config/menu";
import { motion, AnimatePresence } from "framer-motion";
import { permissionService } from "@/services/permissionService";

export default function Sidebar({ open, onClose }) {
  const path = usePathname() || "";
  const [filteredMenu, setFilteredMenu] = useState([]);
  const [openGroups, setOpenGroups] = useState({});

  // Map menu titles to module names and features
  const getModuleAndFeature = (title, parentTitle) => {
    const moduleMapping = {
      "Human Resources": { module: "HR", feature: null },
      "Inventory": { module: "INVENTORY", feature: null },
      "Finance": { module: "FINANCE", feature: null },
      "Settings": { module: "SETTINGS", feature: null },
    };

    const featureMapping = {
      // HR Features
      "Employee Management": { module: "HR", feature: "Employee Management" },
      "Payroll": { module: "HR", feature: "Payroll" },
      "Time & Attendance": { module: "HR", feature: "Time & Attendance" },
      "Leave Management": { module: "HR", feature: "Leave Management" },
      "Shift Management": { module: "HR", feature: "Shift Management" },
      "Shift Templates": { module: "HR", feature: "Shift Management" },
      "Shift Assignments": { module: "HR", feature: "Shift Management" },
      "Auto Scheduler": { module: "HR", feature: "Shift Management" },
      "Employee Assets": { module: "HR", feature: "Employee Assets" },
      "Performance": { module: "HR", feature: "Performance" },
      "Recruitment": { module: "HR", feature: "Recruitment" },
      "Exit Management": { module: "HR", feature: "Exit Management" },
      "HR Policies": { module: "HR", feature: "HR Policies" },
      "Compensation & Loan": { module: "HR", feature: "Compensation" },
      // Inventory Features
      "Inventory Dashboard": { module: "INVENTORY", feature: null },
      "Product Management": { module: "INVENTORY", feature: "Products" },
      "Stock Management": { module: "INVENTORY", feature: "Stock Management" },
      "Warehouse Management": { module: "INVENTORY", feature: "Warehouses" },
      "Purchase Management": { module: "INVENTORY", feature: "Purchase Orders" },
      "Suppliers & Vendors": { module: "INVENTORY", feature: "Suppliers" },
      "Sales Integration": { module: "INVENTORY", feature: "Sales Orders" },
      "Assets Inventory": { module: "INVENTORY", feature: "Assets Inventory" },
      "Inventory Transfers": { module: "INVENTORY", feature: "Inventory Transfers" },
      "Barcode & QR": { module: "INVENTORY", feature: "Barcode & QR" },
      "Reports": { module: "INVENTORY", feature: "Reports" },
      "Alerts": { module: "INVENTORY", feature: "Alerts" },
      "Selling / POS": { module: "INVENTORY", feature: "POS" },
      "Audit Logs": { module: "INVENTORY", feature: "Audit Logs" },
      // Finance Features
      "Finance Dashboard": { module: "FINANCE", feature: null },
      "Accounts": { module: "FINANCE", feature: "Chart of Accounts" },
      "Invoices": { module: "FINANCE", feature: "Invoices" },
      "Expenses": { module: "FINANCE", feature: "Expenses" },
      "Payables": { module: "FINANCE", feature: "Payables" },
      "Receivables": { module: "FINANCE", feature: "Receivables" },
      "Budgets": { module: "FINANCE", feature: "Budgets" },
      "Bank & Cash": { module: "FINANCE", feature: "Bank & Cash" },
      "Payroll Finance": { module: "FINANCE", feature: "Payroll" },
      "Assets": { module: "FINANCE", feature: "Fixed Assets" },
      "Taxes": { module: "FINANCE", feature: "Taxes" },
      "Forecasting": { module: "FINANCE", feature: "Forecasting" },
      "Finance Settings": { module: "FINANCE", feature: "Settings" },
      // Settings Features
      "Company Profile": { module: "SETTINGS", feature: "Company Profile" },
      "Users & Roles": { module: "SETTINGS", feature: "Users & Roles" },
      "Departments": { module: "SETTINGS", feature: "Departments" },
      "Designations": { module: "SETTINGS", feature: "Designations" },
      "Leave Types": { module: "SETTINGS", feature: "Leave Types" },
      "Preferences": { module: "SETTINGS", feature: "Preferences" },
    };

    if (parentTitle && moduleMapping[parentTitle]) {
      return { module: moduleMapping[parentTitle].module, feature: null };
    }

    return featureMapping[title] || { module: null, feature: null };
  };

  // Check if a menu item has nested children
  const hasNestedChildren = (item) => {
    return item.children && item.children.length > 0 && item.children.some(c => c.children);
  };

  // Filter menu items based on permissions (recursive)
  const filterMenuByPermissions = (items) => {
    const user = permissionService.getCurrentUser();
    
    if (user?.role === "COMPANY_ADMIN") {
      return items;
    }

    const accessibleModules = permissionService.getAccessibleModules();
    const accessibleFeatures = new Set();
    
    accessibleModules.forEach(module => {
      const features = permissionService.getAccessibleFeatures(module, "view");
      features.forEach(f => accessibleFeatures.add(f));
    });

    return items
      .map(item => {
        if (item.type === "link") {
          const { module, feature } = getModuleAndFeature(item.title);
          if (module && accessibleModules.includes(module)) {
            if (!feature || accessibleFeatures.has(feature)) {
              return item;
            }
          }
          return null;
        } else if (item.type === "group") {
          const { module } = getModuleAndFeature(item.title);
          if (module && !accessibleModules.includes(module)) {
            return null;
          }

          const filteredChildren = filterMenuByPermissions(item.children || []);
          
          if (filteredChildren.length === 0) return null;
          
          return {
            ...item,
            children: filteredChildren,
          };
        }
        return item;
      })
      .filter(Boolean);
  };

  // Filter menu based on user permissions
  useEffect(() => {
    permissionService.init();
    const filtered = filterMenuByPermissions(menu);
    setFilteredMenu(filtered);

    // Initialize open groups based on current path
    const initial = {};
    const findAndOpenGroups = (items, parentIndex = null) => {
      items.forEach((m, i) => {
        const groupKey = parentIndex !== null ? `${parentIndex}-${i}` : String(i);
        
        if (m.type === "group" && m.children) {
          // Check if any child matches current path
          const hasActiveChild = m.children.some(c => {
            if (c.children) {
              return c.children.some(subC => path.startsWith(subC.to));
            }
            return c.to && path.startsWith(c.to);
          });
          
          if (hasActiveChild) {
            initial[groupKey] = true;
          }
          
          // Recurse into nested children
          m.children.forEach((child, childIndex) => {
            if (child.children) {
              const nestedKey = `${groupKey}-${childIndex}`;
              if (child.children.some(subC => path.startsWith(subC.to))) {
                initial[nestedKey] = true;
                initial[groupKey] = true; // Also open parent
              }
            }
          });
        }
      });
    };
    
    findAndOpenGroups(filtered);
    setOpenGroups(initial);
  }, [path]);

  const toggle = (key) => setOpenGroups((s) => ({ ...s, [key]: !s[key] }));
  const isActive = (to) => path === to || (to !== "/dashboard" && path.startsWith(to + "/")) || path === to;

  // Render a nested group item (like Shift Management)
  const renderNestedGroup = (item, groupKey) => {
    const isOpen = openGroups[groupKey];
    const hasActiveChild = item.children.some(c => 
      c.to && (path.startsWith(c.to) || path === c.to)
    );

    return (
      <div key={item.title}>
        <button
          onClick={() => toggle(groupKey)}
          className={`w-full flex items-center justify-between gap-3 px-3 py-2 my-0.5 rounded-md text-[13px] transition ${
            hasActiveChild
              ? "bg-sidebar-primary/20 text-sidebar-foreground/85"
              : "hover:bg-sidebar-accent text-sidebar-foreground/85"
          }`}
        >
          <span className="flex items-center gap-2">
            <item.icon className="w-3.5 h-3.5" />
            {item.title}
          </span>
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden ml-3 border-l border-sidebar-border pl-2"
            >
              {item.children.map((c) => (
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
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-50 transition-transform duration-200 flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">
              C
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">Clickmasters BOS</div>
              <div className="text-[11px] text-muted-foreground">Al Qaiser IT Company</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {filteredMenu.map((item, i) =>
            item.type === "link" ? (
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
                      {item.children.map((c, childIndex) => {
                        // Check if this child has its own children (nested group)
                        if (c.children) {
                          return renderNestedGroup(c, `${i}-${childIndex}`);
                        }
                        // Regular link
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

        <div className="p-3 border-t border-sidebar-border text-[11px] text-muted-foreground">
          v1.0 · Internal BOS
        </div>
      </aside>
    </>
  );
}