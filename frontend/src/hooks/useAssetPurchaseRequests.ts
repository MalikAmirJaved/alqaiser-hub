"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface AssetPurchaseRequest {
  id: string;
  asset: string;
  asset_name: string;
  asset_brand?: string;
  asset_serial?: string;
  requested_by?: string;
  requested_by_name?: string;
  employee?: string;
  quantity: number;
  reason: string;
  under_date: string;
  status: "PENDING" | "APPROVED" | "PURCHASE_ORDER_CREATED" | "CANCELLED";
  purchase_order?: string;
  purchase_order_id?: string;
  purchase_order_number?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export function useAssetPurchaseRequests(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? "?" + new URLSearchParams(params).toString() : "";

  return useQuery<AssetPurchaseRequest[]>({
    queryKey: ["assetPurchaseRequests", params],
    queryFn: () => api(`/api/hr/asset-purchase-requests/${queryString}`),
    staleTime: 30 * 1000,
  });
}

export function useCreateAssetPurchaseRequest() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      asset: string;
      quantity: number;
      reason: string;
      under_date: string;
      notes?: string;
      employee?: string;
    }) =>
      api("/api/hr/asset-purchase-requests/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assetPurchaseRequests"] });
    },
  });
}

export function useUpdateAssetPurchaseRequest() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<AssetPurchaseRequest> & { id: string }) =>
      api("/api/hr/asset-purchase-requests/", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assetPurchaseRequests"] });
    },
  });
}

export function useDeleteAssetPurchaseRequest() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api("/api/hr/asset-purchase-requests/", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assetPurchaseRequests"] });
    },
  });
}
