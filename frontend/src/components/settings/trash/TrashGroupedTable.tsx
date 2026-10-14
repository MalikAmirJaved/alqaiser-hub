// frontend/src/components/settings/trash/TrashGroupedTable.tsx
"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  MoreVertical,
  Trash2,
  Undo2,
} from "lucide-react";

import { Card } from "@/components/finance/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrashEntry, TrashGroupCount } from "@/hooks/useTrash";
import { cn } from "@/lib/utils";

import {
  formatDateTime,
  formatRelative,
} from "./trashDisplay";

interface TrashGroupedTableProps {
  entries: TrashEntry[];
  groups: TrashGroupCount[];
  isLoading: boolean;
  canRestore: boolean;
  canDelete: boolean;
  hasActiveFilters: boolean;
  /**
   * Total rows matching the current filters (all pages). Section counts come
   * from the summary, which ignores filters, so when a filter is active we
   * report what is actually being shown instead of a wildly larger number.
   */
  filteredTotal: number;
  onRestore: (entry: TrashEntry) => void;
  onPurge: (entry: TrashEntry) => void;
}

/**
 * Trash records grouped into collapsible per-module sections.
 *
 * Section headers use the summary's *global* counts so a group always reports
 * its true size, while the rows shown are the current page's slice.
 */
export default function TrashGroupedTable({
  entries,
  groups,
  isLoading,
  canRestore,
  canDelete,
  hasActiveFilters,
  filteredTotal,
  onRestore,
  onPurge,
}: TrashGroupedTableProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (isLoading) {
    return <TrashTableSkeleton />;
  }

  if (entries.length === 0) {
    return (
      <Card>
        <div className="px-4 py-14 text-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Trash2 className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">
              {hasActiveFilters
                ? "No deleted records match your filters"
                : "The trash is empty"}
            </p>
            <p className="text-xs">
              Deleted records from across the system appear here.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Build sections in the order given by the summary, then anything left over.
  const order: string[] = [];
  const byGroup = new Map<string, TrashEntry[]>();
  for (const entry of entries) {
    if (!byGroup.has(entry.group)) {
      byGroup.set(entry.group, []);
      order.push(entry.group);
    }
    byGroup.get(entry.group)!.push(entry);
  }

  const globalCounts = new Map(groups.map((g) => [g.group, g.count]));
  const sections = order
    .map((group) => ({
      group,
      // With filters active the summary is not authoritative — use the filtered
      // total so the header never claims more rows than the query returned.
      total: hasActiveFilters
        ? byGroup.get(group)!.length
        : globalCounts.get(group) ?? byGroup.get(group)!.length,
      rows: byGroup.get(group)!,
    }))
    .sort((a, b) => b.total - a.total || a.group.localeCompare(b.group));

  const toggle = (group: string) =>
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));

  const anyActions = canRestore || canDelete;

  return (
    <div className="space-y-4">
      {sections.map(({ group, total, rows }) => {
        const isCollapsed = !!collapsed[group];
        const groupExpired = rows.filter((r) => r.is_expired).length;

        return (
          <Card key={group}>
            <button
              type="button"
              onClick={() => toggle(group)}
              className="w-full flex items-center gap-2 px-4 py-3 border-b border-border text-left hover:bg-surface-2/40 transition-colors"
              aria-expanded={!isCollapsed}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isCollapsed && "-rotate-90",
                )}
              />
              <span className="text-sm font-semibold">{group}</span>
              <span className="text-xs text-muted-foreground num">
                {total} {total === 1 ? "item" : "items"}
              </span>
              {groupExpired > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-destructive/30 bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  {groupExpired} expired
                </span>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {hasActiveFilters
                  ? `${rows.length} of ${filteredTotal} matching`
                  : `showing ${rows.length}`}
              </span>
            </button>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">Type</th>
                      <th className="px-4 py-2.5 text-left font-medium">Record</th>
                      <th className="px-4 py-2.5 text-left font-medium">Deleted by</th>
                      <th className="px-4 py-2.5 text-left font-medium">Deleted at</th>
                      {anyActions && <th className="px-4 py-2.5 w-12" />}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((entry) => (
                      <tr
                        key={`${entry.type_key}:${entry._id}`}
                        className={cn(
                          "border-b border-border/60 last:border-b-0 hover:bg-surface-2/50",
                          entry.is_expired && "bg-destructive/[0.04]",
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">{entry.type_label}</span>
                            {entry.is_expired && (
                              <span
                                className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-destructive/30 text-destructive bg-destructive/10"
                                title="Past the retention window — can be manually purged"
                              >
                                expired
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-medium">{entry.display_name}</span>
                          {Object.keys(entry.meta ?? {}).length > 0 && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {Object.entries(entry.meta)
                                .map(([key, value]) => `${key}: ${value}`)
                                .join(" · ")}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">
                          {entry.deleted_by ?? (
                            <span
                              className="text-xs italic"
                              title="This record was stored as deleted (for example by an import), so no user is recorded."
                            >
                              Unknown (legacy)
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">
                          <div>{formatDateTime(entry.deleted_at)}</div>
                          <div className="text-[11px]">{formatRelative(entry.deleted_at)}</div>
                        </td>

                        {anyActions && (
                          <td className="px-4 py-3 text-right">
                            {(
                              canRestore ||
                              (canDelete && entry.can_purge && !entry.has_related_records)
                            ) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="p-1 rounded-md hover:bg-muted transition"
                                    aria-label="Trash actions"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canRestore && (
                                    <DropdownMenuItem onClick={() => onRestore(entry)}>
                                      <Undo2 className="w-4 h-4 mr-2" /> Restore
                                    </DropdownMenuItem>
                                  )}
                                  {canRestore &&
                                    canDelete &&
                                    entry.can_purge &&
                                    !entry.has_related_records && (
                                    <DropdownMenuSeparator />
                                  )}
                                  {canDelete &&
                                    entry.can_purge &&
                                    !entry.has_related_records && (
                                    <DropdownMenuItem
                                      onClick={() => onPurge(entry)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" /> Delete permanently
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function TrashTableSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((section) => (
        <Card key={section}>
          <div className="px-4 py-3 border-b border-border">
            <Skeleton className="h-4 w-40" />
          </div>
          {Array.from({ length: 3 }).map((_, row) => (
            <div key={row} className="flex gap-4 px-4 py-3 border-b border-border/60">
              {Array.from({ length: 5 }).map((__, cell) => (
                <Skeleton key={cell} className="h-4 w-28" />
              ))}
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
