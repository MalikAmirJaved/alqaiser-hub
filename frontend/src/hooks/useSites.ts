"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Site {
  id: string;
  name: string;
  location: string;
  description: string;
  nvr_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface SiteFormData {
  name: string;
  location?: string;
  description?: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useSites() {
  const api = useApi();
  return useQuery<PaginatedResponse<Site>, Error, Site[]>({
    queryKey: ["monitoring_sites"],
    queryFn: () => api("/api/monitoring/sites/"),
    select: (data) => data.results,
    staleTime: 30 * 1000,
  });
}

export function useCreateSite() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SiteFormData) =>
      api("/api/monitoring/sites/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring_sites"] });
    },
  });
}

export function useUpdateSite() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SiteFormData> }) =>
      api(`/api/monitoring/sites/${id}/`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring_sites"] });
    },
  });
}

export function useDeleteSite() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/monitoring/sites/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring_sites"] });
    },
  });
}
