// src/hooks/useShiftTemplates.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface ShiftTemplate {
  id: number;
  _id?: string;
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

// Fetch all shift templates
export function useShiftTemplates() {
  const api = useApi();
  return useQuery<ShiftTemplate[]>({
    queryKey: ["shiftTemplates"],
    queryFn: () => api("/api/hr/shift-templates/"),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
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
    mutationFn: (template: Partial<ShiftTemplate> & { id: number }) =>
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
    mutationFn: (id: number) =>
      api("/api/hr/shift-templates/", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shiftTemplates"] });
    },
  });
}