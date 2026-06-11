// ============================================
// FILE: src/components/reuseable/TableGridView.tsx
// ============================================

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "./Checkbox";
import InboxIcon from "./InboxIcon";

export interface Column<T = Record<string, unknown>> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
}

export function TableView<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  selectedRows,
  onRowSelect,
  onRowClick,
  actions,
  emptyMessage = "No data found",
  className,
  stickyHeader = true,
}: {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  selectedRows?: Set<number>;
  onRowSelect?: (rows: Set<number>) => void;
  onRowClick?: (row: T, idx: number) => void;
  actions?: (row: T, idx: number) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
  stickyHeader?: boolean;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // Memoize sorted data to avoid recalculation on every render
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      
      // Handle null/undefined values
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      
      // Handle string comparison with case insensitivity
      if (typeof av === 'string' && typeof bv === 'string') {
        const cmp = av.toLowerCase().localeCompare(bv.toLowerCase());
        return sortDir === "asc" ? cmp : -cmp;
      }
      
      // Handle number and other types
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  // Get the original index for a sorted item
  const getOriginalIndex = (sortedIndex: number) => {
    if (!sortKey) return sortedIndex;
    const sortedItem = sortedData[sortedIndex];
    return data.findIndex(item => item === sortedItem);
  };

  // Handle header checkbox selection (selects all visible items)
const handleSelectAll = (checked: boolean) => {
  if (!onRowSelect) return;

  const newSelected = new Set(selectedRows);

  sortedData.forEach((_, sortedIdx) => {
    const originalIdx = getOriginalIndex(sortedIdx);

    if (checked) {
      newSelected.add(originalIdx);
    } else {
      newSelected.delete(originalIdx);
    }
  });

  onRowSelect(newSelected);
};

  // Check if all visible items are selected
  const isAllSelected = sortedData.length > 0 && sortedData.every((_, sortedIdx) => {
    const originalIdx = getOriginalIndex(sortedIdx);
    return selectedRows?.has(originalIdx);
  });

  // Check if some items are selected (for indeterminate state)
  const isIndeterminate = !isAllSelected && sortedData.some((_, sortedIdx) => {
    const originalIdx = getOriginalIndex(sortedIdx);
    return selectedRows?.has(originalIdx);
  });

  return (
    <div className={cn("rounded-[var(--radius-xl)] border border-[var(--border)] overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={cn(
            "bg-[var(--muted)]/50 border-b border-[var(--border)]",
            stickyHeader && "sticky top-0 z-10"
          )}>
            <tr>
              {onRowSelect && (
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={isIndeterminate}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(
                    "px-4 py-3 text-left font-medium text-[var(--muted-foreground)] whitespace-nowrap",
                    col.sortable && "cursor-pointer select-none hover:text-[var(--foreground)] transition-colors"
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && (
                      <span className={cn("opacity-40", sortKey === col.key && "opacity-100 text-[var(--primary)]")}>
                        {sortKey === col.key && sortDir === "desc" ? "↓" : "↑"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-right text-[var(--muted-foreground)]">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="bg-[var(--card)]">
                  {onRowSelect && <td className="px-4 py-3"><div className="w-4 h-4 rounded bg-[var(--muted)] animate-pulse" /></td>}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 rounded bg-[var(--muted)] animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                  {actions && <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-[var(--muted)] animate-pulse ml-auto" /></td>}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onRowSelect ? 1 : 0) + (actions ? 1 : 0)} className="px-4 py-12 text-center text-[var(--muted-foreground)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, sortedIdx) => {
                const originalIdx = getOriginalIndex(sortedIdx);
                const isSelected = selectedRows?.has(originalIdx) ?? false;
                
                return (
                  <tr
                    key={(row as any).id ?? originalIdx}
                    onClick={() => onRowClick?.(row, originalIdx)}
                    className={cn(
                      "bg-[var(--card)] transition-colors",
                      onRowClick && "cursor-pointer hover:bg-[var(--accent)]",
                      isSelected && "bg-[var(--primary)]/5"
                    )}
                  >
                    {onRowSelect && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onChange={(v) => {
  const newSelected = new Set(selectedRows);

  if (v) {
    newSelected.add(originalIdx);
  } else {
    newSelected.delete(originalIdx);
  }

  onRowSelect(newSelected);
}}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-[var(--foreground)] whitespace-nowrap">
                        {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "")}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {actions(row, originalIdx)}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GRID VIEW (Card grid)
// ─────────────────────────────────────────────────────────────

export function GridView<T extends Record<string, unknown>>({
  data,
  renderCard,
  loading,
  emptyMessage = "No items found",
  columns = 3,
  gap = 4,
  className,
}: {
  data: T[];
  renderCard: (item: T, idx: number) => React.ReactNode;
  loading?: boolean;
  emptyMessage?: string;
  columns?: 2 | 3 | 4 | 5 | 6;
  gap?: number;
  className?: string;
}) {
  const colClass: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
  };

  if (loading) {
    return (
      <div className={cn("grid", colClass[columns], `gap-${gap}`, className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-3">
            <div className="h-32 rounded-[var(--radius-lg)] bg-[var(--muted)] animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-[var(--muted)] animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-[var(--muted)] animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--muted-foreground)]">
        <div className="w-12 h-12 rounded-full bg-[var(--muted)] flex items-center justify-center">
          <InboxIcon />
        </div>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("grid", colClass[columns], `gap-${gap}`, className)}>
      {data.map((item, i) => renderCard(item, i))}
    </div>
  );
}