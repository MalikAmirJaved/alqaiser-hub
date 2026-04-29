import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { menu } from "../../config/menu";
import { motion, AnimatePresence } from "framer-motion";

export default function Sidebar({ open, onClose }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    menu.forEach((m, i) => {
      if (m.type === "group" && m.children?.some((c) => path.startsWith(c.to))) initial[i] = true;
    });
    return initial;
  });

  const toggle = (i) => setOpenGroups((s) => ({ ...s, [i]: !s[i] }));
  const isActive = (to) => path === to || (to !== "/dashboard" && path.startsWith(to + "/")) || path === to;

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
          {menu.map((item, i) =>
            item.type === "link" ? (
              <Link
                key={item.title}
                to={item.to}
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
                  onClick={() => toggle(i)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent"
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="w-4 h-4" />
                    {item.title}
                  </span>
                  {openGroups[i] ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {openGroups[i] && (
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
                          to={c.to}
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
