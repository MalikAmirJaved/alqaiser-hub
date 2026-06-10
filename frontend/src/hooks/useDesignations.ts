// src/hooks/useDesignations.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Designation {
  id: string;           // UUID as string
  _id: string;
  name: string;
  department?: string;
  pay_grade?: string | null;   // snake_case to match API
  description?: string;
  isActive: boolean;
  created_at: string;          // snake_case
  updated_at: string;          // snake_case
}

export interface DesignationDetail {
  id: string;
  name: string;
  department: string;
  pay_grade: string;
  description: string;
  isActive: boolean;
  created_at: string;
  updated_at: string;
}

export interface DesignationEmployee {
  _id: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  department: string;
}

// Fetch all designations
export function useDesignations() {
  const api = useApi();
  return useQuery<Designation[]>({
    queryKey: ["designations"],
    queryFn: async () => {
      const response = await api("/api/company/designations/") as any;;
      // If response has 'results' property (paginated), return that, else assume array
      return response.results ?? response;
    },
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
    mutationFn: (designation: Omit<Designation, "id" | "_id" | "created_at" | "updated_at">) =>
      api("/api/company/designations/", { // ✅ Fixed: removed '/settings/'
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
    mutationFn: (designation: Partial<Designation> & { id: string }) =>
      api(`/api/company/designations/${designation.id}/`, { // ✅ Fixed: detail endpoint with id
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
    mutationFn: (id: string) =>
      api(`/api/company/designations/${id}/`, { // ✅ Fixed: detail endpoint with id, no body needed
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designations"] });
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

// Fetch single designation by ID
export function useDesignation(id: string | null) {
  const api = useApi();
  return useQuery<DesignationDetail>({
    queryKey: ["designation", id],
    queryFn: () => api(`/api/company/designations/${id}/`), // ✅ Fixed: detail endpoint
    enabled: !!id,
  });
}

// Fetch employees under a designation (this URL is correct per backend)
export function useDesignationEmployees(designationId: string | null) {
  const api = useApi();
  return useQuery<DesignationEmployee[]>({
    queryKey: ["designationEmployees", designationId],
    queryFn: () => api(`/api/company/settings/designations/${designationId}/employees/`),
    enabled: !!designationId,
    staleTime: 60_000,
  });
}