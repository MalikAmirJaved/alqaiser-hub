// src/hooks/useAssets.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Asset {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  description?: string;
  purchaseDate?: string;
  purchasePrice?: string;
  warrantyUntil?: string;
  vendor?: string;
  isActive: boolean;
  isAssigned: boolean;
  warrantyStatus?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
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
    mutationFn: (asset: Omit<Asset, "id" | "_id" | "createdAt" | "updatedAt" | "warrantyStatus" | "isAssigned">) =>
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
    mutationFn: (asset: Partial<Asset> & { id: string }) =>
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