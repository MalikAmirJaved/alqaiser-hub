// src/hooks/useAssets.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Asset {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  serial_number?: string;           // ← snake_case
  description?: string;
  category?: string;
  purchase_date?: string;           // ← snake_case
  purchase_price?: number;          // ← snake_case
  warranty_until?: string;          // ← snake_case
  available_quantity?: number;      // ← snake_case
  total_quantity?: number;          // ← snake_case
  assigned_to?: string;             // ← snake_case if needed
  vendor?: string;
  is_active: boolean;
  is_assigned: boolean;
  warranty_status?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface AssetStats {
  totalAssets: number;
  withSerialNumbers: number;
  totalValue: number;
  assignedAssets: number;
  availableAssets: number;
  uniqueVendors: number;
  activeWarranty: number;
  expiredWarranty: number;
}

// Fetch all assets
export function useAssets(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  
  return useQuery<Asset[]>({
    queryKey: ["assets", params],
    queryFn: () => api(`/api/hr/assets/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    placeholderData: (previousData) => previousData,
  });
}

export function useAsset(id: string | null) {
  const api = useApi();
  return useQuery<Asset>({
    queryKey: ["asset", id],
    queryFn: () => api(`/api/hr/assets/${id}/`),
    enabled: !!id,
  });
}

// Fetch asset stats
export function useAssetStats() {
  const api = useApi();
  return useQuery<AssetStats>({
    queryKey: ["assetStats"],
    queryFn: () => api("/api/hr/assets/stats/"),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// Create asset
export function useCreateAsset() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (asset: Omit<Asset, "id" | "created_at" | "updated_at" | "warranty_status" | "is_assigned">) =>
      api("/api/hr/assets/", {
        method: "POST",
        body: JSON.stringify(asset),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["assetStats"] });
    },
  });
}

// Update asset
export function useUpdateAsset() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (asset: Record<string, any> & { id: string }) =>
      api("/api/hr/assets/", {
        method: "PATCH",
        body: JSON.stringify(asset),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["assetStats"] });
    },
  });
}

// Delete asset
export function useDeleteAsset() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api("/api/hr/assets/", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["assetStats"] });
    },
  });
}