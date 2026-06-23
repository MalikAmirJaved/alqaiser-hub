// src/hooks/useShiftTemplates.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  description?: string;
  is_active: boolean;
  workingHours?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface PaginatedResponse<T> {
  count: number;
  total_pages: number;
  current_page: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Fetch all shift templates
export function useShiftTemplates() {
  const api = useApi();
  const query = useQuery<PaginatedResponse<ShiftTemplate>>({
    queryKey: ["shiftTemplates"],
    queryFn: () => api("/api/hr/shift-templates/"),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
  return {
    ...query,
    data: query.data?.results ?? [],
  };
}

// Fetch shift templates with server-side pagination, search, and ordering
export function useShiftTemplatesPaginated(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  const query = useQuery<PaginatedResponse<ShiftTemplate>>({
    queryKey: ["shiftTemplatesPaginated", params],
    queryFn: () => api(`/api/hr/shift-templates/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
  return {
    ...query,
    data: query.data?.results ?? [],
    totalCount: query.data?.count ?? 0,
    totalPages: query.data?.total_pages ?? 0,
    currentPage: query.data?.current_page ?? 1,
  };
}

// Create shift template
export function useCreateShiftTemplate() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (template: Omit<ShiftTemplate, "id" | "_id" | "createdAt" | "updatedAt" | "workingHours">) =>
      api("/api/hr/shift-templates/", {
        method: "POST",
        body: JSON.stringify(template),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shiftTemplates"] });
    },
  });
}

// Update shift template
export function useUpdateShiftTemplate() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (template: Partial<ShiftTemplate> & { id: string }) =>
      api("/api/hr/shift-templates/", {
        method: "PATCH",
        body: JSON.stringify(template),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shiftTemplates"] });
    },
  });
}

// Delete shift template
export function useDeleteShiftTemplate() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api("/api/hr/shift-templates/", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shiftTemplates"] });
    },
  });
}