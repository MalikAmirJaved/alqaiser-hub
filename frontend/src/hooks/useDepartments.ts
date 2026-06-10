// frontend/src/hooks/useDepartments.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DepartmentDesignation {
  _id: string;
  name: string;
  department: string;
  is_active: boolean;
}

export interface DepartmentEmployee {
  _id: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  designation: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Fetch all departments (raw)
export function useDepartments(filters?: { search?: string }) {
  const api = useApi();
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  const url = `/api/organization/departments/${params.toString() ? `?${params}` : ""}`;

  return useQuery<PaginatedResponse<Department>, Error, Department[]>({
    queryKey: ["departments", filters],
    queryFn: () => api(url),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}

// Helper hook: returns department options for dropdowns
export function useDepartmentOptions() {
  const { data: departments, isLoading } = useDepartments();
  const options = (departments || [])
    .filter(d => d.is_active)
    .map(d => ({ value: d.name, label: d.name }));
  return { options, isLoading };
}

// Fetch single department
export function useDepartment(id: string | null) {
  const api = useApi();
  return useQuery<Department>({
    queryKey: ["department", id],
    queryFn: () => api(`/api/organization/departments/${id}/`),
    enabled: !!id,
  });
}

// Create department
export function useCreateDepartment() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Department, "id" | "created_at" | "updated_at">) =>
      api("/api/organization/departments/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });
}

// Update department
export function useUpdateDepartment() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Department, "id" | "created_at" | "updated_at">> }) =>
      api(`/api/organization/departments/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["department", id] });
    },
  });
}

// Delete department
export function useDeleteDepartment() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/organization/departments/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });
}

// Get designations for a department
export function useDepartmentDesignations(departmentId: string | null) {
  const api = useApi();
  return useQuery<DepartmentDesignation[]>({
    queryKey: ["departmentDesignations", departmentId],
    queryFn: () => api(`/api/organization/departments/${departmentId}/designations/`),
    enabled: !!departmentId,
    staleTime: 60_000,
  });
}

// Get employees for a department
export function useDepartmentEmployees(departmentId: string | null) {
  const api = useApi();
  return useQuery<DepartmentEmployee[]>({
    queryKey: ["departmentEmployees", departmentId],
    queryFn: () => api(`/api/organization/departments/${departmentId}/employees/`),
    enabled: !!departmentId,
    staleTime: 60_000,
  });
}