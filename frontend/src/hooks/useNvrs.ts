"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Nvr {
  id: string;
  site_id: string;
  site_name: string;
  nvr_name: string;
  nvr_username: string;
  ip: string;
  port: number;
  camera_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface NvrFormData {
  site: string;
  nvr_name: string;
  nvr_username: string;
  password?: string;
  ip: string;
  port: number;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useNvrs(siteId?: string, options?: { enabled?: boolean }) {
  const api = useApi();
  const params = siteId ? `?site=${siteId}` : "";
  return useQuery<PaginatedResponse<Nvr>, Error, Nvr[]>({
    queryKey: ["monitoring_nvrs", siteId],
    queryFn: () => api(`/api/monitoring/nvrs/${params}`),
    select: (data) => data.results,
    staleTime: 30 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateNvr() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NvrFormData) =>
      api("/api/monitoring/nvrs/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring_nvrs"] });
    },
  });
}

export function useUpdateNvr() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NvrFormData> }) =>
      api(`/api/monitoring/nvrs/${id}/`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring_nvrs"] });
    },
  });
}

export function useDeleteNvr() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/monitoring/nvrs/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring_nvrs"] });
    },
  });
}
