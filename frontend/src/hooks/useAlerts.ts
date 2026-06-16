import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi";

export interface Alert {
  id: string;
  type: string;
  type_display: string;
  severity: string;
  severity_display: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
type AlertsResponse = PaginatedResponse<Alert>;

export interface AlertFilters {
  search?: string;
  severity?: string;
  is_read?: string;
}

export function useAlerts(page = 1, pageSize = 20, filters?: AlertFilters) {
  const api = useApi();

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (filters?.search) params.set("search", filters.search);
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.is_read) params.set("is_read", filters.is_read);

  return useQuery<AlertsResponse>({
    queryKey: ["alerts", page, pageSize, filters],
    queryFn: () =>
      api<AlertsResponse>(
        `/api/inventory/alerts/?${params.toString()}`
      ),
  });
}

export function useUnreadCount() {
  const api = useApi();
  return useQuery({
    queryKey: ["alerts", "unread"],
    queryFn: () => api<{ unread_count: number }>("/api/inventory/alerts/unread_count/"),
    refetchInterval: 30000, // every 30s
  });
}

export function useMarkAlertsRead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertIds: string[]) => api("/api/inventory/alerts/mark_read/", {
      method: "POST",
      body: JSON.stringify({ alert_ids: alertIds }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alerts", "unread"] });
    },
  });
}