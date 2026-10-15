// frontend/src/app/(app)/settings/trash/page.tsx
"use client";

import { useMemo, useState } from "react";
import {
  ArchiveRestore,
  AlertTriangle,
  ArrowDownUp,
  CalendarRange,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Card, PageHeader, ToolbarButton } from "@/components/finance/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { usePagination } from "@/hooks/usePagination";
import {
  type TrashEntry,
  type TrashSort,
  useEmptyTrash,
  usePurgeExpiredTrash,
  usePurgeTrashEntry,
  useRestoreTrashEntry,
  useTrash,
  useTrashSummary,
} from "@/hooks/useTrash";

import TrashTypeFilter from "@/components/settings/trash/TrashTypeFilter";
import TrashGroupedTable from "@/components/settings/trash/TrashGroupedTable";
import TrashPurgeModal, {
  TrashBulkPurgeModal,
  TrashRestoreModal,
} from "@/components/settings/trash/TrashPurgeModal";
import { formatBytes } from "@/components/settings/trash/trashDisplay";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: TrashSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "expiring", label: "Expiring soonest" },
  { value: "name", label: "Name (A–Z)" },
  { value: "type", label: "Module & type" },
];

export default function TrashPage() {
  const pagination = usePagination();
  const [activeGroup, setActiveGroup] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<TrashSort>("newest");
  const [showExpiredOnly, setShowExpiredOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [purgeTarget, setPurgeTarget] = useState<TrashEntry | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<TrashEntry | null>(null);
  const [bulkAction, setBulkAction] = useState<"empty" | "expired" | null>(null);

  const permissions = useFeaturePermissions("SETTINGS", "trash");
  const canDelete = !!permissions.delete;
  const canRestore = !!permissions.restore;

  const filters = useMemo(
    () => ({
      group: activeGroup || undefined,
      search: search.trim() || undefined,
      expired: showExpiredOnly || undefined,
      sort,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page: pagination.page,
      page_size: PAGE_SIZE,
    }),
    [activeGroup, search, showExpiredOnly, sort, dateFrom, dateTo, pagination.page],
  );

  const { data: entries, isLoading, totalCount, refetch, isFetching } = useTrash(filters);
  const { summary, isLoading: summaryLoading, refetch: refetchSummary } = useTrashSummary();

  const purgeEntry = usePurgeTrashEntry();
  const restoreEntry = useRestoreTrashEntry();
  const purgeExpired = usePurgeExpiredTrash();
  const emptyTrash = useEmptyTrash();

  const groups = summary?.groups ?? [];
  const expiredCount = summary?.expired ?? 0;
  const blockedCount = summary?.blocked ?? 0;
  const retentionDays = summary?.retention_days ?? 30;

  const hasActiveFilters =
    !!activeGroup || !!search.trim() || showExpiredOnly || !!dateFrom || !!dateTo;

  const resetPage = () => pagination.resetPage();

  const clearFilters = () => {
    setActiveGroup("");
    setSearch("");
    setSort("newest");
    setShowExpiredOnly(false);
    setDateFrom("");
    setDateTo("");
    resetPage();
  };

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchSummary()]);
  };

  const handleRestore = async (entry: TrashEntry) => {
    setRestoreTarget(entry);
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    await restoreEntry.mutateAsync({ type: restoreTarget.type_key, id: restoreTarget._id });
    setRestoreTarget(null);
    await refetchSummary();
  };

  const handleConfirmPurge = async () => {
    if (!purgeTarget) return;
    await purgeEntry.mutateAsync({ type: purgeTarget.type_key, id: purgeTarget._id });
    setPurgeTarget(null);
    await refetchSummary();
  };

  const handleConfirmBulk = async () => {
    const scope = activeGroup ? { group: activeGroup } : undefined;
    if (bulkAction === "empty") {
      await emptyTrash.mutateAsync(scope);
    } else if (bulkAction === "expired") {
      await purgeExpired.mutateAsync(scope);
    }
    setBulkAction(null);
    await refetchSummary();
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(pagination.page, totalPages);
  const rangeStart = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, totalCount);

  return (
    <>
      <PageHeader
        breadcrumbs={["Settings", "Trash"]}
        title="Trash"
        description="Deleted records stay here until they are restored or permanently deleted."
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
                sub={`deleted within the last ${retentionDays} days`}
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
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

            {/* Sort */}
            <label className="inline-flex items-center gap-1.5 h-9 px-2 rounded-md border border-border bg-surface text-xs">
              <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as TrashSort);
                  resetPage();
                }}
                className="bg-transparent text-xs outline-none"
                aria-label="Sort trash"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Deleted-date range */}
            <label className="inline-flex items-center gap-1.5 h-9 px-2 rounded-md border border-border bg-surface text-xs">
              <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  resetPage();
                }}
                className="bg-transparent text-xs outline-none"
                aria-label="Deleted from date"
              />
              <span className="text-muted-foreground">→</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  resetPage();
                }}
                className="bg-transparent text-xs outline-none"
                aria-label="Deleted to date"
              />
            </label>

            {/* Expired toggle */}
            {expiredCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowExpiredOnly((v) => !v);
                  resetPage();
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium transition-colors",
                  showExpiredOnly
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
                title="Show only items past the retention window"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Expired only
                <span className="num opacity-70">{expiredCount}</span>
              </button>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          <TrashTypeFilter
            groups={groups}
            activeGroup={activeGroup}
            totalCount={summary?.total ?? 0}
            onSelect={(group) => {
              setActiveGroup(group);
              resetPage();
            }}
          />
        </div>

        {/* ── Grouped records ──────────────────────────────────────────── */}
        <TrashGroupedTable
          entries={entries}
          groups={groups}
          isLoading={isLoading}
          canRestore={canRestore}
          canDelete={canDelete}
          hasActiveFilters={hasActiveFilters}
          filteredTotal={totalCount}
          onRestore={handleRestore}
          onPurge={setPurgeTarget}
        />

        {/* ── Pagination ───────────────────────────────────────────────── */}
        {totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border border-border rounded-xl text-xs text-muted-foreground">
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

      <TrashRestoreModal
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleConfirmRestore}
        typeKey={restoreTarget?.type_key ?? null}
        entryId={restoreTarget?._id ?? null}
        displayName={restoreTarget?.display_name ?? ""}
        isLoading={restoreEntry.isPending}
      />

      <TrashBulkPurgeModal
        isOpen={bulkAction === "empty"}
        onClose={() => setBulkAction(null)}
        onConfirm={handleConfirmBulk}
        title="Empty the trash?"
        count={totalCount}
        scopeLabel={activeGroup ? `in ${activeGroup}` : "in the trash"}
        blockedCount={blockedCount}
        blockerHint="They stay listed in the trash."
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
