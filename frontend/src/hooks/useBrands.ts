// src/hooks/useBrands.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Brand {
  id: string;
  name: string;
  code: string;
  description: string;
  country_of_origin: string;
  created_at?: string;
  updated_at?: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Fetch all brands
// Backward compatible: accepts string (search) or object (filters)
export function useBrands(filters?: Record<string, string> | string) {
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
  const url = `/api/inventory/brands/${queryString ? `?${queryString}` : ""}`;

  return useQuery<
    PaginatedResponse<Brand>,
    Error,
    Brand[]
  >({
    queryKey: ["inventory_brand", filters],
    queryFn: () => api<PaginatedResponse<Brand>>(url),
    select: (data) => data.results,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

  
// Create brand
export function useCreateBrand() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (brand: Omit<Brand, "id" | "created_at" | "updated_at">) =>
      api("/api/inventory/brands/", {
        method: "POST",
        body: JSON.stringify(brand),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_brand"] });
    },
  });
}

// Update brand
export function useUpdateBrand() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Brand, "id" | "created_at" | "updated_at">> }) =>
      api(`/api/inventory/brands/${id}/`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_brand"] });
    },
  });
}

// Delete brand
export function useDeleteBrand() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/inventory/brands/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_brand"] });
    },
  });
}