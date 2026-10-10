// frontend/src/app/(app)/settings/trash/page.tsx
"use client";

import { useMemo, useState } from "react";
import {
  ArchiveRestore,
  AlertTriangle,
  Clock,
  Loader2,
  MoreVertical,
  RefreshCw,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";

import { Card, PageHeader, ToolbarButton } from "@/components/finance/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { usePagination } from "@/hooks/usePagination";
import {
  type TrashEntry,
  useEmptyTrash,
  usePurgeExpiredTrash,
  usePurgeTrashEntry,
  useRestoreTrashEntry,
  useTrash,
  useTrashSummary,
} from "@/hooks/useTrash";

import TrashTypeFilter from "@/components/settings/trash/TrashTypeFilter";
import TrashPurgeModal, {
  TrashBulkPurgeModal,
} from "@/components/settings/trash/TrashPurgeModal";
import {
  daysLeftTone,
  formatBytes,
  formatDateTime,
  formatDaysLeft,
  formatRelative,
} from "@/components/settings/trash/trashDisplay";
import { cn } from "@/lib/utils";

export default function TrashPage() {
  const pagination = usePagination();
  const [activeType, setActiveType] = useState("");
  const [search, setSearch] = useState("");
  const [showExpiredOnly, setShowExpiredOnly] = useState(false);

  const [purgeTarget, setPurgeTarget] = useState<TrashEntry | null>(null);
  const [bulkAction, setBulkAction] = useState<"empty" | "expired" | null>(null);

  const permissions = useFeaturePermissions("SETTINGS", "trash");
  const canDelete = !!permissions.delete;
  const canRestore = !!permissions.restore;

  const filters = useMemo(
    () => ({
      type: activeType || undefined,
      search: search.trim() || undefined,
      expired: showExpiredOnly || undefined,
      page: pagination.page,
      page_size: 20,
    }),
    [activeType, search, showExpiredOnly, pagination.page],
  );

  const { data: entries, isLoading, totalCount, retentionDays, refetch, isFetching } =
    useTrash(filters);
  const { summary, isLoading: summaryLoading, refetch: refetchSummary } = useTrashSummary();

  const purgeEntry = usePurgeTrashEntry();
  const restoreEntry = useRestoreTrashEntry();
  const purgeExpired = usePurgeExpiredTrash();
  const emptyTrash = useEmptyTrash();

  const types = summary?.types ?? [];
  const expiredCount = summary?.expired ?? 0;

  const resetPage = () => pagination.resetPage();

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchSummary()]);
  };

  const handleRestore = async (entry: TrashEntry) => {
    await restoreEntry.mutateAsync({ type: entry.type_key, id: entry._id });
    await refetchSummary();
  };

  const handleConfirmPurge = async () => {
    if (!purgeTarget) return;
    await purgeEntry.mutateAsync({ type: purgeTarget.type_key, id: purgeTarget._id });
    setPurgeTarget(null);
    await refetchSummary();
  };

  const handleConfirmBulk = async () => {
    if (bulkAction === "empty") {
      await emptyTrash.mutateAsync(activeType || undefined);
    } else if (bulkAction === "expired") {
      await purgeExpired.mutateAsync(activeType || undefined);
    }
    setBulkAction(null);
    await refetchSummary();
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / 20));
  const safePage = Math.min(pagination.page, totalPages);
  const rangeStart = totalCount === 0 ? 0 : (safePage - 1) * 20 + 1;
  const rangeEnd = Math.min(safePage * 20, totalCount);

  return (
    <>
      <PageHeader
        breadcrumbs={["Settings", "Trash"]}
        title="Trash"
        description={`Deleted records are kept for ${retentionDays} days, then permanently removed automatically.`}
        actions={
          <>
            <ToolbarButton
              icon={isFetching ? Loader2 : RefreshCw}
              variant="ghost"
              onClick={handleRefresh}
              disabled={isFetching}
            >
              Refresh
            </ToolbarButton>
            {canDelete && expiredCount > 0 && (
              <ToolbarButton
                icon={AlertTriangle}
                variant="default"
                onClick={() => setBulkAction("expired")}
              >
                Purge expired ({expiredCount})
              </ToolbarButton>
            )}
            {canDelete && totalCount > 0 && (
              <ToolbarButton
                icon={Trash2}
                variant="primary"
                onClick={() => setBulkAction("empty")}
              >
                Empty trash
              </ToolbarButton>
            )}
          </>
        }
      />

      <div className="pt-6 space-y-6">
        {/* ── KPIs ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summaryLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="px-5 py-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-7 w-16" />
              </Card>
            ))
          ) : (
            <>
              <KpiCard label="Items in trash" value={summary?.total ?? 0} icon={Trash2} />
              <KpiCard
                label="Expired"
                value={summary?.expired ?? 0}
                icon={AlertTriangle}
                tone={summary?.expired ? "destructive" : undefined}
                sub={summary?.expired ? "past retention — purge now" : "none past retention"}
              />
              <KpiCard
                label="Within retention"
                value={summary?.within_retention ?? 0}
                icon={Clock}
                sub={`auto-removed after ${retentionDays} days`}
              />
              <KpiCard
                label="Reclaimable"
                value={formatBytes(summary?.size_bytes ?? 0)}
                icon={ArchiveRestore}
                sub="stored files on deleted rows"
              />
            </>
          )}
        </div>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
              placeholder="Search deleted records…"
              className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-surface text-sm outline-none focus:border-primary/60"
            />
          </div>
          <TrashTypeFilter
            types={types}
            activeType={activeType}
            totalCount={summary?.total ?? 0}
            expiredCount={expiredCount}
            onSelect={(type) => {
              setActiveType(type);
              resetPage();
            }}
            showExpiredOnly={showExpiredOnly}
            onToggleExpired={() => {
              setShowExpiredOnly((v) => !v);
              resetPage();
            }}
          />
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Record</th>
                  <th className="px-4 py-2.5 text-left font-medium">Deleted by</th>
                  <th className="px-4 py-2.5 text-left font-medium">Deleted at</th>
                  <th className="px-4 py-2.5 text-left font-medium">Auto-delete</th>
                  <th className="px-4 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/60">
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-24" />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-6 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Trash2 className="h-8 w-8 opacity-40" />
                        <p className="text-sm font-medium">
                          {showExpiredOnly
                            ? "Nothing has expired yet"
                            : search || activeType
                              ? "No deleted records match your filters"
                              : "The trash is empty"}
                        </p>
                        <p className="text-xs">
                          Deleted records from across the system appear here.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const rowId = `${entry.type_key}:${entry._id}`;
                    const hasActions = canRestore || canDelete;
                    return (
                      <tr
                        key={rowId}
                        className={cn(
                          "border-b border-border/60 hover:bg-surface-2/50",
                          entry.is_expired && "bg-destructive/[0.04]",
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">{entry.type_label}</span>
                            {entry.is_expired && (
                              <span
                                className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-destructive/30 text-destructive bg-destructive/10"
                                title="Past the retention window — will be purged on the next run"
                              >
                                expired
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">{entry.group}</span>
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
                          {entry.deleted_by ?? "—"}
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">
                          <div>{formatDateTime(entry.deleted_at)}</div>
                          <div className="text-[11px]">{formatRelative(entry.deleted_at)}</div>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[11px] font-medium",
                              daysLeftTone(entry.days_left, entry.is_expired),
                            )}
                            title={entry.expires_at ? `Expires ${formatDateTime(entry.expires_at)}` : undefined}
                          >
                            {formatDaysLeft(entry.days_left, entry.is_expired)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          {hasActions && (
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
                                  <DropdownMenuItem onClick={() => handleRestore(entry)}>
                                    <Undo2 className="w-4 h-4 mr-2" /> Restore
                                  </DropdownMenuItem>
                                )}
                                {canRestore && canDelete && <DropdownMenuSeparator />}
                                {canDelete && (
                                  <DropdownMenuItem
                                    onClick={() => setPurgeTarget(entry)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete permanently
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ─────────────────────────────────────────────── */}
          {totalCount > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
              <span>
                Showing {rangeStart}–{rangeEnd} of {totalCount}
              </span>
              <div className="flex items-center gap-2">
                <span>
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => pagination.setPage(safePage - 1)}
                  disabled={safePage === 1}
                  className="px-2.5 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => pagination.setPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                  className="px-2.5 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <TrashPurgeModal
        isOpen={!!purgeTarget}
        onClose={() => setPurgeTarget(null)}
        onConfirm={handleConfirmPurge}
        typeKey={purgeTarget?.type_key ?? null}
        entryId={purgeTarget?._id ?? null}
        displayName={purgeTarget?.display_name ?? ""}
        isLoading={purgeEntry.isPending}
      />

      <TrashBulkPurgeModal
        isOpen={bulkAction === "empty"}
        onClose={() => setBulkAction(null)}
        onConfirm={handleConfirmBulk}
        title="Empty the trash?"
        count={totalCount}
        scopeLabel={activeType ? `of type “${activeType}”` : "in the trash"}
        isLoading={emptyTrash.isPending}
      />

      <TrashBulkPurgeModal
        isOpen={bulkAction === "expired"}
        onClose={() => setBulkAction(null)}
        onConfirm={handleConfirmBulk}
        title="Purge expired items?"
        count={expiredCount}
        scopeLabel={`older than ${retentionDays} days`}
        isLoading={purgeExpired.isPending}
      />
    </>
  );
}

// ─── Small KPI card ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "destructive";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          {label}
        </div>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div
        className={cn(
          "text-2xl font-semibold num tracking-tight mt-1",
          tone === "destructive" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}
