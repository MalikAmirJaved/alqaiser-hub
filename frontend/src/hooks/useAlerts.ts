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

export function useAlerts(page = 1, pageSize = 20) {
  const api = useApi();

  return useQuery<AlertsResponse>({
    queryKey: ["alerts", page, pageSize],
    queryFn: () =>
      api<AlertsResponse>(
        `/api/inventory/alerts/?page=${page}&page_size=${pageSize}`
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