// src/hooks/useSuppliers.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Supplier extends Record<string, unknown> {
  id: string;
  name: string;
  code: string;
  contact_person: string;
  email: string;
  phone: string;
  address_line: string;
  country: string;
  state: string;
  city: string;
  postal_code: string;
  status: "active" | "inactive" | "suspended";
  created_at: string;
  updated_at: string;
  partner_type?: string;
}
export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

// Fetch all suppliers
export function useSuppliers(filters?: Record<string, string>) {
  const api = useApi();
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, val]) => {
      if (val) params.append(key, val);
    });
  }
  const url = `/api/inventory/suppliers/${params.toString() ? `?${params}` : ""}`;

  const query = useQuery<PaginatedResponse<Supplier>>({
    queryKey: ["inventory_supplier", filters],
    queryFn: () => api<PaginatedResponse<Supplier>>(url),
  });

  return {
    ...query,
    data: query.data?.results ?? [],
    totalCount: query.data?.count ?? 0,
  };
}

// Create supplier
export function useCreateSupplier() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Supplier, "id" | "created_at" | "updated_at">) =>
      api("/api/inventory/suppliers/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_supplier"] });
    },
  });
}

// Update supplier
export function useUpdateSupplier() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Supplier> & { id: string }) =>
      api(`/api/inventory/suppliers/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_supplier"] });
    },
  });
}

// Delete supplier
export function useDeleteSupplier() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/inventory/suppliers/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_supplier"] });
    },
  });
}

export function useSupplier(id: string | null) {
  const api = useApi();
  return useQuery<Supplier>({
    queryKey: ["supplier", id],
    queryFn: () => api(`/api/inventory/suppliers/${id}/`),
    enabled: !!id,
  });
}