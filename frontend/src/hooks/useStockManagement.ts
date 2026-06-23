// src/hooks/useStockManagement.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// Types (matching backend)
export interface StockItem extends Record<string, unknown> {
  id: string;
  variant_id: string;      // UUID
  variant_sku: string;
  variant_name: string;
  warehouse_id: string;
  warehouse_name: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  bin_location: string;
  version: number;
  updated_at: string;
}

export interface StockHistoryEntry {
  id: string;
  transaction_id: string;
  variant_id: string;
  variant_sku: string;
  warehouse_id: string;
  warehouse_name: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost: string;
  transaction_type: string;
  transaction_type_display: string;
  reason_text: string;
  created_by: number;
  created_at: string;
  created_by_name?: string;
  created_by_email?: string;
}

export interface VariantStockSummary {
  variant_id: string;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  warehouses: {
    warehouse_id: string;
    warehouse_name: string;
    quantity_on_hand: number;
    quantity_reserved: number;
    quantity_available: number;
  }[];
}

// Paginated response
interface PaginatedResponse<T> {
  count: number;
  page: number;
  page_size: number;
  results: T[];
}

// Adjust payload
export interface StockAdjustPayload {
  variant_id: string;
  warehouse_id: string;
  quantity_change: number;
  reason: string;
  transaction_type: "DAMAGE" | "ADJUSTMENT" | "STOCK_TAKE";
}

// ---------- Current Stock (with filters) ----------
export function useCurrentStock(filters?: {
  variant_id?: string;
  warehouse_id?: string;
  low_stock?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}) {
  const api = useApi();

  const params = new URLSearchParams();
  if (filters?.variant_id) params.append("variant_id", filters.variant_id);
  if (filters?.warehouse_id) params.append("warehouse_id", filters.warehouse_id);
  if (filters?.low_stock) params.append("low_stock", "true");
  if (filters?.search) params.append("search", filters.search);
  if (filters?.page) params.append("page", String(filters.page));
  if (filters?.page_size) params.append("page_size", String(filters.page_size));

  const url = `/api/inventory/stock/current_stock/${params.toString() ? `?${params}` : ""}`;

  return useQuery<PaginatedResponse<StockItem>>({
    queryKey: ["inventory_stock", filters],
    queryFn: () => api(url),
    staleTime: 30_000,
  });
}

// ---------- Stock History ----------
export function useStockHistory(filters?: {
  variant_id?: string;
  warehouse_id?: string;
  start_date?: string;
  end_date?: string;
  transaction_type?: string;
  page?: number;
  page_size?: number;
}) {
  const api = useApi();

  const params = new URLSearchParams();
  if (filters?.variant_id) params.append("variant_id", filters.variant_id);
  if (filters?.warehouse_id) params.append("warehouse_id", filters.warehouse_id);
  if (filters?.start_date) params.append("start_date", filters.start_date);
  if (filters?.end_date) params.append("end_date", filters.end_date);
  if (filters?.transaction_type) params.append("transaction_type", filters.transaction_type);
  if (filters?.page) params.append("page", String(filters.page));
  if (filters?.page_size) params.append("page_size", String(filters.page_size));

  const url = `/api/inventory/stock/history/${params.toString() ? `?${params}` : ""}`;

  return useQuery<PaginatedResponse<StockHistoryEntry>>({
    queryKey: ["stockHistory", filters],
    queryFn: () => api(url),
    staleTime: 60_000,
  });
}

// ---------- Adjust Stock ----------
export function useAdjustStock() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: StockAdjustPayload) =>
      api("/api/inventory/stock/adjust/", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      // Invalidate all stock-related queries
      queryClient.invalidateQueries({ queryKey: ["inventory_stock"] });
      queryClient.invalidateQueries({ queryKey: ["stockHistory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_product"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_product"] });
      queryClient.invalidateQueries({ queryKey: ["variantSummary"] });
    },
  });
}

// ---------- Single Stock Item (by record id) ----------
export function useStockItem(id: string | null) {
  const api = useApi();
  return useQuery<StockItem>({
    queryKey: ["inventory_stock", id],
    queryFn: () => api(`/api/inventory/stock/${id}/`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ---------- Variant Summary (by variant_id) ----------
export function useVariantSummary(variantId: string | null) {
  const api = useApi();
  return useQuery<VariantStockSummary>({
    queryKey: ["variantSummary", variantId],
    queryFn: () => api(`/api/inventory/stock/variant_summary/?variant_id=${variantId}`),
    enabled: !!variantId,
    staleTime: 30_000,
  });
}