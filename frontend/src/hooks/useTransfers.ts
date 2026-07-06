// src/hooks/useTransfers.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface StockTransfer {
  id: string;
  transfer_number: string;
  variant_id: string;
  variant_sku: string;
  variant_name: string;
  source_warehouse_id: string;
  source_warehouse_name: string;
  destination_warehouse_id: string;
  destination_warehouse_name: string;
  quantity: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  notes: string;
  planned_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferStats {
  total: number;
  pending: number;
  completed: number;
  cancelled: number;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface CreateTransferPayload {
  variant_id: string;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  quantity: number;
  planned_date?: string;
  notes?: string;
}

export function useTransfers(filters?: { status?: string; variant_id?: string; source_warehouse?: string; destination_warehouse?: string; page?: number }) {
  const api = useApi();
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.variant_id) params.append("variant_id", filters.variant_id);
  if (filters?.source_warehouse) params.append("source_warehouse", filters.source_warehouse);
  if (filters?.destination_warehouse) params.append("destination_warehouse", filters.destination_warehouse);
  if (filters?.page) params.append("page", String(filters.page));
  const queryString = params.toString();
  const url = `/api/inventory/transfers/${queryString ? `?${queryString}` : ""}`;

  const query = useQuery<PaginatedResponse<StockTransfer>>({
    queryKey: ["inventory_stock_transfer", filters],
    queryFn: () => api<PaginatedResponse<StockTransfer>>(url),
    staleTime: 30 * 1000,
  });

  return { ...query, data: query.data?.results ?? [], totalCount: query.data?.count ?? 0 };
}

export function useTransfer(id: string | null) {
  const api = useApi();
  return useQuery<StockTransfer>({
    queryKey: ["transfer", id],
    queryFn: () => api<StockTransfer>(`/api/inventory/transfers/${id}/`),
    enabled: !!id,
  });
}

export function useTransferStats() {
  const api = useApi();
  const { data: transfers } = useTransfers({});

  return useQuery<TransferStats>({
    queryKey: ["transferStats"],
    queryFn: async () => {
      const allTransfers = transfers || [];
      return {
        total: allTransfers.length,
        pending: allTransfers.filter((t) => t.status === "PENDING").length,
        completed: allTransfers.filter((t) => t.status === "COMPLETED").length,
        cancelled: allTransfers.filter((t) => t.status === "CANCELLED").length,
      };
    },
    enabled: !!transfers,
    staleTime: 30 * 1000,
  });
}

export function useCreateTransfer() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransferPayload) =>
      api("/api/inventory/transfers/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_stock_transfer"] });
      queryClient.invalidateQueries({ queryKey: ["transferStats"] });
    },
  });
}

export function useConfirmTransfer() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/inventory/transfers/${id}/confirm/`, { method: "POST" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_stock_transfer"] });
      queryClient.invalidateQueries({ queryKey: ["transfer", id] });
      queryClient.invalidateQueries({ queryKey: ["transferStats"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_variant"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_stock"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_product"] });
    },
  });
}

export function useCancelTransfer() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/inventory/transfers/${id}/cancel/`, { method: "POST" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_stock_transfer"] });
      queryClient.invalidateQueries({ queryKey: ["transfer", id] });
      queryClient.invalidateQueries({ queryKey: ["transferStats"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_variant"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_stock"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_product"] });
    },
  });
}