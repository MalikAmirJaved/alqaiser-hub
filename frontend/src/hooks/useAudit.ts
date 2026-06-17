import { useQuery } from "@tanstack/react-query";
import { useApi } from "./useApi";

export interface AuditLog {
  id: string;
  user: number;
  user_name: string;
  user_email: string;
  action: string;
  action_display: string;
  model_name: string;
  record_id: string;
  module: string;
  changes: Record<string, { old: any; new: any }>;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
}

export function useAuditLogs(filters?: {
  model_name?: string;
  record_id?: string;
  module?: string;
  action?: string;
  page?: number;
}) {
  const api = useApi();
  const params = new URLSearchParams();
  if (filters?.model_name) params.append("model_name", filters.model_name);
  if (filters?.record_id) params.append("record_id", filters.record_id);
  if (filters?.module) params.append("module", filters.module);
  if (filters?.action) params.append("action", filters.action);
  if (filters?.page) params.append("page", String(filters.page));
  const url = `/api/audit/logs/${params.toString() ? `?${params}` : ""}`;

  return useQuery<{ results: AuditLog[]; count: number }>({
    queryKey: ["audit_logs", filters],
    queryFn: () => api(url),
    staleTime: 30_000,
  });
}