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
import { getPermissionForMenuItem, menuPermissionMapping } from "@/config/routePermissions";

export default function Sidebar({ open, onClose }) {
  const path = usePathname() || "";
  const permissions = useSelector((state: RootState) => state.permissions.permissions);
  const user = useSelector((state: RootState) => state.auth.user);
  const { data } = useSelector((state: RootState) => state.companySettings);

  const isCompanyAdmin = user?.role === "COMPANY_ADMIN";
  const hasPermission = (permCode: string) =>
    permissions.some(p => p.toLowerCase() === permCode.toLowerCase());

  const hasAnyModulePermission = (moduleCode: string) =>
    permissions.some(p => p.toLowerCase().startsWith(moduleCode.toLowerCase() + ":"));

  // Helper to check if a menu item is allowed based on role
  const isMenuAllowedForRole = (title: string): boolean => {
    if (title === "Permissions") {
      return isCompanyAdmin; // only admin can see this
    }
    return true;
  };
  // Helper to get module code from group title
  const getModuleCodeFromTitle = (title: string): string => {
    const map: Record<string, string> = {
      "Human Resources": "HR",
      "Inventory": "INVENTORY",
      "Sales": "SALES",
      "Finance": "FINANCE",
      "AI Monitoring": "AI_MONITORING",
      "Settings": "SETTINGS",
    };
    return map[title] || title.toUpperCase();
  };
  // Filter menu using the shared mapping
  const filteredMenu = useMemo(() => {
    const filterItems = (items: any[], parentTitle?: string): any[] => {
      return items.reduce((acc: any[], item) => {
        const isLink = !!item.to;
        const isGroup = !isLink && item.children && item.children.length > 0;

        if (isLink) {
          if (item.title === "Dashboard") {
            acc.push(item);
            return acc;
          }
          const perm = getPermissionForMenuItem(item.title, parentTitle);
          if (isMenuAllowedForRole(item.title)) {
            if (!perm || hasPermission(perm)) {
              acc.push(item);
            }
          }
        } else if (isGroup) {
          const moduleCode = getModuleCodeFromTitle(item.title);
          const hasModuleAccess = hasAnyModulePermission(moduleCode);
          const filteredChildren = filterItems(item.children, item.title);

          if (filteredChildren.length > 0 || hasModuleAccess) {
            let children = filteredChildren;
            // If module is accessible but dashboard not yet present, add it automatically
            if (hasModuleAccess && !children.some(c => c.title === "Dashboard")) {
              const dashboardItem = item.children?.find(c => c.title === "Dashboard");
              if (dashboardItem) children = [dashboardItem, ...children];
            }
            acc.push({ ...item, children });
          }
        }
        return acc;
      }, []);
    };
    return filterItems(menu);
  }, [permissions]);

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
            <div className="font-semibold text-sm">{data?.companyName || "Alpha"}</div>
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
                                      if (!isMenuAllowedForRole(subC.title)) return null;
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
                        const perm = getPermissionForMenuItem(c.title, item.title);
                        if (!isMenuAllowedForRole(c.title)) return null;
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