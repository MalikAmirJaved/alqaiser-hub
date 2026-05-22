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
export function useBrands(search?: string) {
  const api = useApi();

  const url = search
    ? `/api/inventory/brands/?search=${encodeURIComponent(search)}`
    : "/api/inventory/brands/";

  return useQuery<
    PaginatedResponse<Brand>,
    Error,
    Brand[]
  >({
    queryKey: ["brands", search],
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
      queryClient.invalidateQueries({ queryKey: ["brands"] });
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
      queryClient.invalidateQueries({ queryKey: ["brands"] });
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
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    },
  });
}