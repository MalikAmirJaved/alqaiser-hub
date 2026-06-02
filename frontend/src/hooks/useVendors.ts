// src/hooks/useVendors.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import type { Supplier } from "./useSuppliers";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type Vendor = Supplier; // same fields



export function useVendors() {
  const api = useApi();
  return useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: async () => {
      const res = await api<PaginatedResponse<Vendor>>("/api/inventory/vendors/");
      return res.results; // 👈 FIX HERE
    },
  });
}

export function useCreateVendor() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Vendor, "id" | "created_at" | "updated_at">) =>
      api("/api/inventory/vendors/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  });
}

export function useUpdateVendor() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Vendor> & { id: string }) =>
      api(`/api/inventory/vendors/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  });
}

export function useDeleteVendor() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/inventory/vendors/${id}/`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  });
}