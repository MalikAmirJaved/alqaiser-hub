// hooks/useAuditLogs.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface AuditFieldChange {
  id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;           // UUID from backend
  user_id: number;
  user_name: string | null;
  user_email: string | null;
  action: string;
  action_display: string;
  entity_type: string;
  entity_id: string;
  source_module: string;
  reference_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  company_id: number;
  branch_id: number;
  field_changes: AuditFieldChange[];
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface AuditFilters {
  entity_type?: string;
  action?: string;
  user_id?: number;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

// Fetch audit logs with filters
export function useAuditLogs(filters: AuditFilters = {}) {
  const api = useApi();
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });
  
  const url = `/api/inventory/audit-logs/?${params.toString()}`;
  
  return useQuery<PaginatedResponse<AuditLog>, Error>({
    queryKey: ["auditLogs", filters],
    queryFn: () => api<PaginatedResponse<AuditLog>>(url),
    staleTime: 30_000,
    retry: 2,
  });
}

// Fetch single audit log detail
export function useAuditLogDetail(id: string) {
  const api = useApi();
  return useQuery<AuditLog, Error>({
    queryKey: ["auditLog", id],
    queryFn: () => api<AuditLog>(`/api/inventory/audit-logs/${id}/`),
    enabled: !!id,
    staleTime: 60_000,
  });
}