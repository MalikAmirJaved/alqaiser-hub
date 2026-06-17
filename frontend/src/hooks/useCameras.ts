"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Camera {
  id: string;
  nvr_id: string;
  nvr_name: string;
  camera: string;
  channel: number;
  zone: string;
  purpose: string;
  created_at?: string;
  updated_at?: string;
}

export interface CameraFormData {
  nvr: string;
  camera: string;
  channel: number;
  zone?: string;
  purpose?: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useCameras(nvrId?: string, options?: { enabled?: boolean }) {
  const api = useApi();
  const params = nvrId ? `?nvr=${nvrId}` : "";
  return useQuery<PaginatedResponse<Camera>, Error, Camera[]>({
    queryKey: ["monitoring_cameras", nvrId],
    queryFn: () => api(`/api/monitoring/cameras/${params}`),
    select: (data) => data.results,
    staleTime: 30 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateCamera() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CameraFormData) =>
      api("/api/monitoring/cameras/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring_cameras"] });
    },
  });
}

export function useUpdateCamera() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CameraFormData> }) =>
      api(`/api/monitoring/cameras/${id}/`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring_cameras"] });
    },
  });
}

export function useDeleteCamera() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/monitoring/cameras/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring_cameras"] });
    },
  });
}
