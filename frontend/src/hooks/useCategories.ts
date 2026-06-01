// src/hooks/useCategories.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Category {
  id: string;
  name: string;
  code: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Fetch all categories
export function useCategories(search?: string) {
  const api = useApi();

  const url = search
    ? `/api/inventory/categories/?search=${encodeURIComponent(search)}`
    : "/api/inventory/categories/";

  return useQuery<
    PaginatedResponse<Category>,
    Error,
    Category[]
  >({
    queryKey: ["inventory_category", search],
    queryFn: () => api<PaginatedResponse<Category>>(url),
    select: (data) => data.results,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}


// Create category
export function useCreateCategory() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (category: Omit<Category, "id" | "created_at" | "updated_at">) =>
      api("/api/inventory/categories/", {
        method: "POST",
        body: JSON.stringify(category),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_category"] });
    },
  });
}

// Update category
export function useUpdateCategory() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Category, "id" | "created_at" | "updated_at">> }) =>
      api(`/api/inventory/categories/${id}/`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_category"] });
    },
  });
}

// Delete category
export function useDeleteCategory() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/inventory/categories/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_category"] });
    },
  });
}