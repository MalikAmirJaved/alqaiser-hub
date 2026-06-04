"use client";

import type { ReactNode } from "react";
import { useState, useMemo } from "react";
import { PageHeader, Card, TableToolbar, ToolbarButton } from "@/components/finance/ui";
import { Plus, Download, Pencil, Trash2, Send } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";

export type Column<T = any> = {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (value: any, row: T) => ReactNode;
  mono?: boolean;
  sortable?: boolean;
  sortAccessor?: (row: T) => string | number;
};

export interface Kpi {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "success" | "warning" | "destructive" | "info";
  isCurrency?: boolean
}

export interface ModulePermissions {
  create: boolean;
  update: boolean;
  delete: boolean;
  view: boolean;
  export?: boolean;
}

interface Actions<T> {
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onPost?: (item: T) => void;

  canPost?: (item: T) => boolean;
}


interface DynamicModulePageProps<T> {
  breadcrumbs: string[];
  title: string;
  description?: string;
  data: T[];
  isLoading: boolean;
  columns: Column<T>[];
  kpis?: Kpi[] | ((data: T[]) => Kpi[]);
  getRowId: (item: T) => string;
  emptyMessage?: string;
  permissions: ModulePermissions;
  primaryActionLabel?: string;
  onCreate?: () => void;
  actions?: Actions<T>;
  exportEnabled?: boolean;
  onExport?: () => void;
  onRowSelect?: (selectedIds: string[]) => void;
  batchActions?: ReactNode;
  onRowClick?: (item: T) => void;
}

export function DynamicModulePage<T>({
  breadcrumbs,
  title,
  description,
  data,
  isLoading,
  columns,
  kpis,
  getRowId,
  emptyMessage = "No records found",
  permissions,
  primaryActionLabel = "New",
  onCreate,
  actions,
  exportEnabled = true,
  onExport,
  onRowSelect,
  batchActions,
  onRowClick,
}: DynamicModulePageProps<T>) {
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const computedKpis = typeof kpis === "function" ? kpis(data) : kpis;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    const column = columns.find((c) => c.key === sortKey);
    return [...data].sort((a, b) => {
      let av: any;
      let bv: any;

      if (column?.sortAccessor) {
        av = column.sortAccessor(a);
        bv = column.sortAccessor(b);
      } else {
        av = (a as any)[sortKey];
        bv = (b as any)[sortKey];
      }

      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      if (typeof av === "string" && typeof bv === "string") {
        const cmp = av.toLowerCase().localeCompare(bv.toLowerCase());
        return sortDir === "asc" ? cmp : -cmp;
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir, columns]);

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
    onRowSelect?.(Array.from(newSelected));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = data.map((item) => getRowId(item));
      setSelectedIds(new Set(allIds));
      onRowSelect?.(allIds);
    } else {
      setSelectedIds(new Set());
      onRowSelect?.([]);
    }
  };

  const isAllSelected = data.length > 0 && data.every((item) => selectedIds.has(getRowId(item)));
  const isIndeterminate = !isAllSelected && data.some((item) => selectedIds.has(getRowId(item)));

  const handleDelete = (item: T) => {
    if (!actions?.onDelete) return;
    confirm({
      title: `Delete ${title.slice(0, -1) || "Item"}`,
      message: "This action cannot be undone.",
      onConfirm: () => actions.onDelete!(item),
    });
  };

  const showActionsColumn = (actions?.onEdit || actions?.onDelete || actions?.onPost) && (permissions.update || permissions.delete);
  const showCheckboxColumn = permissions.delete || onRowSelect;

  return (
    <>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        description={description}
        actions={
          <>
            {exportEnabled && permissions.export !== false && onExport && (
              <ToolbarButton icon={Download} variant="ghost" onClick={onExport}>
                Export
              </ToolbarButton>
            )}
            {permissions.create && onCreate && (
              <ToolbarButton icon={Plus} variant="primary" onClick={onCreate}>
                {primaryActionLabel}
              </ToolbarButton>
            )}
          </>
        }
      />
      <div className="pt-6 space-y-6">
        {computedKpis && computedKpis.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {computedKpis.map((k) => {
              const toneColor =
                k.tone === "success"
                  ? "text-success"
                  : k.tone === "warning"
                    ? "text-warning"
                    : k.tone === "destructive"
                      ? "text-destructive"
                      : k.tone === "info"
                        ? "text-info"
                        : "text-foreground";
              const formattedValue = k.isCurrency !== false && typeof k.value === "number"
                ? formatCurrency(k.value)
                : String(k.value);

              return (
                <Card key={k.label} className="px-5 py-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{k.label}</div>
                  <div className={`text-2xl font-semibold num tracking-tight mt-1 ${toneColor}`}>
                    {formattedValue}
                  </div>
                  {k.sub && <div className="text-xs text-muted-foreground mt-1">{k.sub}</div>}
                </Card>
              );
            })}
          </div>
        )}

        {batchActions && selectedIds.size > 0 && (
          <div className="bg-surface/80 rounded-lg px-4 py-2 flex items-center gap-4 border border-border">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            {batchActions}
          </div>
        )}

        <Card>
          <TableToolbar />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
                <tr>
                  {showCheckboxColumn && (
                    <th className="px-4 py-2.5 w-8">
                      <input
                        type="checkbox"
                        className="rounded border-border cursor-pointer"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isIndeterminate;
                        }}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                  )}
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-2.5 font-medium ${col.align === "right" ? "text-right" : "text-left"} ${col.sortable ? "cursor-pointer select-none hover:text-foreground" : ""
                        }`}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && sortKey === col.key && (
                          <span className="text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </span>
                    </th>
                  ))}
                  {showActionsColumn && <th className="px-4 py-2.5 w-12"></th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="px-4 py-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="px-4 py-8 text-center text-muted-foreground">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  sortedData.map((item) => {
                    const rowId = getRowId(item);
                    const isSelected = selectedIds.has(rowId);
                    return (
                      <tr key={rowId} onClick={() => onRowClick?.(item)} className={`border-b border-border/60 hover:bg-surface-2/50 ${isSelected ? "bg-primary/5" : ""}`}>
                        {showCheckboxColumn && (
                          <td className="px-4 py-2.5">
                            <input
                              type="checkbox"
                              className="rounded border-border cursor-pointer"
                              checked={isSelected}
                              onChange={(e) => handleSelectRow(rowId, e.target.checked)}
                            />
                          </td>
                        )}
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={`px-4 py-2.5 ${col.align === "right" ? "text-right num" : ""} ${col.mono ? "font-mono text-xs text-primary" : ""
                              }`}
                          >
                            {col.render ? col.render((item as any)[col.key], item) : String((item as any)[col.key] ?? "")}
                          </td>
                        ))}
                        {showActionsColumn && (
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                            
                              {actions?.onPost &&
                                permissions.update &&
                                (actions.canPost?.(item) ?? true) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      actions.onPost!(item);
                                    }}
                                    className="p-1 rounded-md hover:bg-muted"
                                    title="Post"
                                  >
                                    <Send className="w-4 h-4" />
                                  </button>
                                )}
                              {actions?.onEdit && permissions.update && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    actions.onEdit!(item);
                                  }}
                                  className="p-1 rounded-md hover:bg-muted"
                                  title="Edit"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              {actions?.onDelete && permissions.delete && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(item);
                                  }}
                                  className="p-1 rounded-md hover:bg-destructive/10 text-destructive"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
            <span>
              Showing {sortedData.length} of {data.length} records
            </span>
            <div className="flex items-center gap-2">{/* Pagination can be added later */}</div>
          </div>
        </Card>
      </div>
      <ConfirmModal />
    </>
  );
}