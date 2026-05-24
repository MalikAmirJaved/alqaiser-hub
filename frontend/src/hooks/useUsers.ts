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
  full_name: string;
  role: string;
  department: string;
  designation: string;
  phone_number: string;
  company: number | null;
  branch: number | null;
  branch_id?: string;
  branch_name?: string;
  employee_id: string;
  status: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
}

export interface UserFormData {
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  department?: string;
  designation?: string;
  phone_number?: string;
  is_active: boolean;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Fetch all users (handles pagination)
export function useUsers() {
  const api = useApi();

  return useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await api<PaginatedResponse<User>>("/api/organization/users/");
      return response.results || [];
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
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
    mutationFn: (userData: UserFormData) =>
      api<User>("/api/organization/users/", {
        method: "POST",
        body: JSON.stringify(userData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

// Update user
export function useUpdateUser() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UserFormData> }) =>
      api<User>(`/api/organization/users/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
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