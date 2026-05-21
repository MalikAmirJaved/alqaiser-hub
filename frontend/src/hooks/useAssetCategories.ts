// src/hooks/useAssetCategories.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface AssetCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  assetIds: string[];
  assetCount: number;
  assets?: {
    id: string;
    name: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AssetCategoryStats {
  totalCategories: number;
  activeCategories: number;
  totalAssetsInCategories: number;
  averageAssetsPerCategory: number;
}

// Fetch all asset categories
export function useAssetCategories(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  
  return useQuery<AssetCategory[]>({
    queryKey: ["assetCategories", params],
    queryFn: () => api(`/api/hr/asset-categories/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// Fetch asset category stats
export function useAssetCategoryStats() {
  const api = useApi();
  return useQuery<AssetCategoryStats>({
    queryKey: ["assetCategoryStats"],
    queryFn: () => api("/api/hr/asset-categories/stats/"),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// Create asset category
export function useCreateAssetCategory() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (category: { 
      name: string; 
      description?: string; 
      isActive?: boolean; 
      assetIds?: string[] 
    }) =>
      api("/api/hr/asset-categories/", {
        method: "POST",
        body: JSON.stringify(category),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assetCategories"] });
      queryClient.invalidateQueries({ queryKey: ["assetCategoryStats"] });
    },
  });
}

// Update asset category
export function useUpdateAssetCategory() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (category: Partial<AssetCategory> & { id: string }) =>
      api("/api/hr/asset-categories/", {
        method: "PATCH",
        body: JSON.stringify(category),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assetCategories"] });
      queryClient.invalidateQueries({ queryKey: ["assetCategoryStats"] });
    },
  });
}

// Delete asset category
export function useDeleteAssetCategory() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api("/api/hr/asset-categories/", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assetCategories"] });
      queryClient.invalidateQueries({ queryKey: ["assetCategoryStats"] });
    },
  });
}