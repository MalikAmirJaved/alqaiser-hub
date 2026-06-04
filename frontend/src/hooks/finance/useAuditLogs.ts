import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface AuditFieldChange {
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: number;
  username?: string;
  created_at: string;
  source_module: string;
  field_changes: AuditFieldChange[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useAuditLogs(filters?: {
  entity_type?: string;
  action?: string;
  start_date?: string;
  end_date?: string;
  source_module?: string;
  page?: number;
}) {
  const params = new URLSearchParams();

  if (filters?.entity_type) params.append("entity_type", filters.entity_type);
  if (filters?.action) params.append("action", filters.action);
  if (filters?.start_date) params.append("created_at__gte", filters.start_date);
  if (filters?.end_date) params.append("created_at__lte", filters.end_date);
  if (filters?.source_module) params.append("source_module", filters.source_module);
  if (filters?.page) params.append("page", String(filters.page));

  const url = `/api/inventory/audit-logs/${params.toString() ? `?${params}` : ""}`;

  return useQuery({
    queryKey: ["audit_logs", filters],
    queryFn: () => apiFetch<PaginatedResponse<AuditLog>>(url),
    staleTime: 60_000,
  });
}