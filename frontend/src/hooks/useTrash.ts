// frontend/src/hooks/useTrash.ts
/**
 * Settings → Trash data access.
 *
 * Backend: `apps/compsetting/trash/` (mounted at /api/company/settings/trash/).
 * Every mutation response carries { success, message, data } and apiFetch already
 * toasts `message`, so hooks must not duplicate toasts.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrashEntry {
  type_key: string;
  type_label: string;
  group: string;
  _id: string;
  display_name: string;
  deleted_at: string;
  deleted_by: string | null;
  expires_at: string | null;
  days_left: number | null;
  is_expired: boolean;
  size_bytes: number;
  meta: Record<string, string | number | boolean>;
}

export interface TrashTypeCount {
  key: string;
  label: string;
  group: string;
  count: number;
  expired: number;
}

export interface TrashGroupCount {
  group: string;
  count: number;
  types: string[];
}

export interface TrashSummary {
  total: number;
  expired: number;
  within_retention: number;
  size_bytes: number;
  retention_days: number;
  types: TrashTypeCount[];
  groups: TrashGroupCount[];
  /** Rows that can never be purged while immutable records reference them. */
  blocked: number;
  blocked_samples: {
    type: string;
    id: string;
    display_name: string;
    blocked_by: TrashBlocker[];
  }[];
}

export type TrashSort = "newest" | "oldest" | "expiring" | "name" | "type";

export interface TrashListResponse {
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  next: number | null;
  previous: number | null;
  retention_days: number;
  sort: TrashSort;
  results: TrashEntry[];
}

export interface TrashDependency {
  model: string;
  count: number;
  soft_deleted: number;
  fields: string[];
}

export interface TrashBlocker {
  model: string;
  field: string;
  count: number;
  blocked_by_type?: string;
}

export interface TrashDependencyReport {
  id: string;
  type: string;
  display_name: string;
  dependencies: TrashDependency[];
  total_related: number;
  blocked_by: TrashBlocker[];
  can_purge: boolean;
  /** CASCADE children that will also be brought back on restore. */
  restorable: Array<{ model: string; count: number }>;
  total_restorable: number;
}

/** Result of a bulk purge / empty-trash action. */
export interface TrashBulkResult {
  purged: number;
  /** Items kept because immutable records still reference them (PROTECT). */
  blocked: number;
  blockers: string[];
  by_type: Record<string, number>;
  errors: string[];
}

/** apiFetch returns the whole envelope; unwrap `data` for convenience. */
interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface TrashFilters {
  type?: string;
  group?: string;
  search?: string;
  page?: number;
  page_size?: number;
  expired?: boolean;
  sort?: TrashSort;
  date_from?: string;
  date_to?: string;
}

const BASE = "/api/company/settings/trash";

function buildQuery(filters: TrashFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.type) params.append("type", filters.type);
  if (filters.group) params.append("group", filters.group);
  if (filters.search) params.append("search", filters.search);
  if (filters.page) params.append("page", String(filters.page));
  if (filters.page_size) params.append("page_size", String(filters.page_size));
  if (filters.expired) params.append("expired", "true");
  if (filters.sort && filters.sort !== "newest") params.append("sort", filters.sort);
  if (filters.date_from) params.append("date_from", filters.date_from);
  if (filters.date_to) params.append("date_to", filters.date_to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const trashKeys = {
  all: ["trash"] as const,
  list: (filters: TrashFilters) => ["trash", "list", filters] as const,
  summary: () => ["trash", "summary"] as const,
  dependencies: (type: string, id: string) => ["trash", "dependencies", type, id] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useTrash(filters: TrashFilters = {}) {
  const api = useApi();
  const query = useQuery<Envelope<TrashListResponse>>({
    queryKey: trashKeys.list(filters),
    queryFn: () => api<Envelope<TrashListResponse>>(`${BASE}/${buildQuery(filters)}`),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  return {
    ...query,
    data: query.data?.data?.results ?? [],
    totalCount: query.data?.data?.count ?? 0,
    totalPages: query.data?.data?.total_pages ?? 1,
    retentionDays: query.data?.data?.retention_days ?? 30,
  };
}

export function useTrashSummary() {
  const api = useApi();
  const query = useQuery<Envelope<TrashSummary>>({
    queryKey: trashKeys.summary(),
    queryFn: () => api<Envelope<TrashSummary>>(`${BASE}/summary/`),
    staleTime: 15_000,
  });
  return { ...query, summary: query.data?.data };
}

export function useTrashDependencies(typeKey: string | null, id: string | null) {
  const api = useApi();
  return useQuery<Envelope<TrashDependencyReport>>({
    queryKey: trashKeys.dependencies(typeKey ?? "", id ?? ""),
    queryFn: () =>
      api<Envelope<TrashDependencyReport>>(`${BASE}/${typeKey}/${id}/dependencies/`),
    enabled: !!typeKey && !!id,
    staleTime: 0,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Invalidate every trash view (list + summary + dependency previews). */
function useTrashInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: trashKeys.all });
  };
}

/** Permanently delete one entry — irreversible. */
export function usePurgeTrashEntry() {
  const api = useApi();
  const invalidate = useTrashInvalidate();
  return useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) =>
      api<Envelope<{ id: string; display_name: string; related_removed: number }>>(
        `${BASE}/${type}/${id}/`,
        { method: "DELETE" },
      ),
    onSuccess: invalidate,
  });
}
/** Restore one entry back to its module. */
export function useRestoreTrashEntry() {
  const api = useApi();
  const invalidate = useTrashInvalidate();
  return useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) =>
      api<
        Envelope<{
          id: string;
          type: string;
          display_name: string;
          restored: boolean;
          related_restored: number;
          related_breakdown: Array<{ model: string; count: number }>;
        }>
      >(`${BASE}/${type}/${id}/restore/`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

/**
 * Permanently delete everything older than the retention window.
 * Scope with a module `group`, a single `type`, or nothing (whole trash).
 */
export function usePurgeExpiredTrash() {
  const api = useApi();
  const invalidate = useTrashInvalidate();
  return useMutation({
    mutationFn: (scope?: { type?: string; group?: string }) =>
      api<Envelope<TrashBulkResult & { retention_days: number }>>(
        `${BASE}/purge-expired/`,
        {
          method: "POST",
          body: JSON.stringify({
            ...(scope?.type ? { type: scope.type } : {}),
            ...(scope?.group ? { group: scope.group } : {}),
          }),
        },
      ),
    onSuccess: invalidate,
  });
}

/**
 * Empty the trash, optionally limited to a module `group` or a set of `type`
 * registry keys. Irreversible.
 */
export function useEmptyTrash() {
  const api = useApi();
  const invalidate = useTrashInvalidate();
  return useMutation({
    mutationFn: (scope?: { type?: string; group?: string }) => {
      const params = new URLSearchParams();
      if (scope?.type) params.append("type", scope.type);
      if (scope?.group) params.append("group", scope.group);
      const qs = params.toString();
      return api<Envelope<TrashBulkResult>>(
        `${BASE}/${qs ? `?${qs}` : ""}`,
        { method: "DELETE" },
      );
    },
    onSuccess: invalidate,
  });
}
