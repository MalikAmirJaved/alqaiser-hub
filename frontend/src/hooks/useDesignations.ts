// src/hooks/useDesignations.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Designation {
  id: number;
  _id?: string;
  name: string;
  department?: string;
  payGrade?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Fetch all designations
export function useDesignations() {
  const api = useApi();
  return useQuery<Designation[]>({
    queryKey: ["designations"],
    queryFn: () => api("/api/company/settings/designations/"),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// Create designation
export function useCreateDesignation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (designation: Omit<Designation, "id" | "_id" | "createdAt" | "updatedAt">) =>
      api("/api/company/settings/designations/", {
        method: "POST",
        body: JSON.stringify(designation),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designations"] });
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

// Update designation
export function useUpdateDesignation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (designation: Partial<Designation> & { id: number }) =>
      api("/api/company/settings/designations/", {
        method: "PATCH",
        body: JSON.stringify(designation),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designations"] });
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

// Delete designation
export function useDeleteDesignation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api("/api/company/settings/designations/", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designations"] });
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}