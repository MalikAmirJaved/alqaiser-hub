// src/hooks/useVendors.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import type { Supplier } from "./useSuppliers";

export type Vendor = Supplier; // same fields

export function useVendors() {
  const api = useApi();
  return useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: () => api("/api/inventory/vendors/"),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
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
    mutationFn: ({ id, ...data }: Partial<Vendor> & { id: number }) =>
      api(`/api/inventory/vendors/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  });
}

export function useDeleteVendor() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/inventory/vendors/${id}/`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  });
}