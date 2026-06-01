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
  payment_terms: string;
  credit_limit: number;
  balance: number;
  rating: number;
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
export function useSuppliers() {
  const api = useApi();

  return useQuery<Supplier[]>({
    queryKey: ["inventory_supplier"],
    queryFn: async () => {
      const res = await api<PaginatedResponse<Supplier>>(
        "/api/inventory/suppliers/"
      );

      return res.results;
    },
  });
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