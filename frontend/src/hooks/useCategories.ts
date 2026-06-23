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
// Backward compatible: accepts string (search) or object (filters)
export function useCategories(filters?: Record<string, string> | string) {
  const api = useApi();
  
  // Support old string-based usage
  if (typeof filters === 'string') {
    filters = { search: filters };
  }
  if (!filters) {
    filters = {};
  }
  
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, val]) => {
    if (val) params.append(key, val);
  });
  const queryString = params.toString();
  const url = `/api/inventory/categories/${queryString ? `?${queryString}` : ""}`;

  const query = useQuery<PaginatedResponse<Category>>({
    queryKey: ["inventory_category", filters],
    queryFn: () => api<PaginatedResponse<Category>>(url),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });

  return { ...query, data: query.data?.results ?? [], totalCount: query.data?.count ?? 0 };
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