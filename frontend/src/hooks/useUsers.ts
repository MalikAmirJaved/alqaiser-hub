// src/hooks/useUsers.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface User {
  id: number;
  _id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  department: string;
  department_id?: string;
  department_name?: string;
  designation: string;
  designation_id?: string;
  designation_name?: string;
  phone_number: string;
  is_active: boolean;
  branch_id?: string;
  branch_name?: string;
  created_at: string;
  updated_at: string;
  // Link to employee if created from an employee
  isfrom_employee_id?: string;
}

export interface UserFormData {
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  department?: string;
  designation?: string;
  phone_number?: string;
  password?: string;  // Added password field
  is_active?: boolean;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Fetch only active users (for dropdowns)
export function useActiveUsers() {
  const api = useApi();
  return useQuery<User[]>({
    queryKey: ["users", "active"],
    queryFn: () => api("/api/organization/users/active/"),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// Fetch all users
export function useUsers(filters?: Record<string, string>) {
  const api = useApi();
  const queryString = filters && Object.keys(filters).length > 0
    ? '?' + new URLSearchParams(filters).toString()
    : '';

  const query = useQuery<PaginatedResponse<User>>({
    queryKey: ["users", filters],
    queryFn: () => api<PaginatedResponse<User>>(`/api/organization/users/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    ...query,
    data: query.data?.results ?? [],
    totalCount: query.data?.count ?? 0,
  };
}

// Fetch single user
export function useUser(id: number | null) {
  const api = useApi();

  return useQuery<User>({
    queryKey: ["user", id],
    queryFn: () => api(`/api/organization/users/${id}/`),
    enabled: !!id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// Create user
export function useCreateUser() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userData: UserFormData) => {
      // Remove any undefined or empty password for update
      const data = { ...userData };
      if (!data.password) {
        delete data.password;
      }
      return api<User>("/api/organization/users/", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      // Refresh employees so UI reflects new isfrom_user links when users are created from employees
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employeeStats"] });
    },
  });
}

// Update user
export function useUpdateUser() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UserFormData> }) => {
      // Remove any undefined or empty password for update
      const updateData = { ...data };
      if (!updateData.password) {
        delete updateData.password;
      }
      return api<User>(`/api/organization/users/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user", variables.id] });
    },
  });
}

// Delete user (soft delete)
export function useDeleteUser() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api(`/api/organization/users/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}