import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useApi } from "@/hooks/useApi";

export interface SalesForecast {
  id: string;               // UUID, not integer
  variant: string;          // variant UUID
  variant_sku: string;
  forecast_date: string;
  predicted_quantity: string;
  confidence: number;
  method_used: string;
}

export interface StockForecast {
  id: string;
  variant: string;
  variant_sku: string;
  warehouse: string;
  warehouse_name?: string;
  forecast_date: string;
  projected_closing_stock: string;
  required_purchase_qty: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

async function getSalesForecasts(params?: {
  variant?: string;
  forecast_date?: string;
  page?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.variant) searchParams.append("variant", params.variant);
  if (params?.forecast_date) searchParams.append("forecast_date", params.forecast_date);
  if (params?.page) searchParams.append("page", String(params.page));
  const url = `/api/forecast/sales-forecast/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<SalesForecast>>(url);
}

export function useSalesForecast(filters?: {
  variant?: string;
  forecast_date?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: ["sales-forecast", filters],
    queryFn: () => getSalesForecasts(filters),
    select: (data) => data.results,
    staleTime: 60_000,
  });
}

async function getStockForecasts(params?: {
  variant?: string;
  warehouse?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.variant) searchParams.append("variant", params.variant);
  if (params?.warehouse) searchParams.append("warehouse", params.warehouse);
  const url = `/api/forecast/stock-forecast/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<StockForecast>>(url);
}

export function useStockForecast(filters?: { variant?: string; warehouse?: string }) {
  return useQuery({
    queryKey: ["stock-forecast", filters],
    queryFn: () => getStockForecasts(filters),
    select: (data) => data.results,
    staleTime: 60_000,
  });
}

// ---------- Analytics types ----------
export interface ForecastTimelinePoint {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
  count: number;
}
export interface ForecastTopSku {
  sku: string;
  predicted: number;
  confidence_avg: number;
  share: number;
}
export interface ForecastMethodMix {
  name: string;
  value: number;
}
export interface ForecastConfidenceBucket {
  bucket: string;
  count: number;
}
export interface ForecastTotals {
  predicted_total: number;
  lower_total: number;
  upper_total: number;
  confidence_avg: number;
  records: number;
  skus: number;
  date_start: string;
  date_end: string;
}
export interface SalesForecastAnalytics {
  timeline: ForecastTimelinePoint[];
  top_skus: ForecastTopSku[];
  method_mix: ForecastMethodMix[];
  confidence: ForecastConfidenceBucket[];
  totals: ForecastTotals;
  granularity: "daily" | "weekly" | "monthly";
}

export interface StockForecastByWarehouse {
  name: string;
  projected: number;
  reorder: number;
}
export interface StockForecastTopReorder {
  sku: string;
  warehouse: string;
  projected: number;
  required: number;
}
export interface StockForecastSummary {
  by_warehouse: StockForecastByWarehouse[];
  top_reorder: StockForecastTopReorder[];
  totals: {
    reorder_total: number;
    projected_total: number;
    warehouses: number;
    items: number;
  };
}

// ---------- Analytics hooks ----------
export function useSalesForecastAnalytics(params?: {
  granularity?: "daily" | "weekly" | "monthly";
  variant?: string;
  top_n?: number;
}) {
  const api = useApi();
  const search = new URLSearchParams();
  if (params?.granularity) search.append("granularity", params.granularity);
  if (params?.variant) search.append("variant", params.variant);
  if (params?.top_n) search.append("top_n", String(params.top_n));
  const qs = search.toString();
  return useQuery<SalesForecastAnalytics>({
    queryKey: ["sales-forecast-analytics", params],
    queryFn: () => api<SalesForecastAnalytics>(`/api/forecast/sales-forecast/analytics/${qs ? `?${qs}` : ""}`),
    staleTime: 60_000,
  });
}

export function useStockForecastSummary(params?: { variant?: string; warehouse?: string }) {
  const api = useApi();
  const search = new URLSearchParams();
  if (params?.variant) search.append("variant", params.variant);
  if (params?.warehouse) search.append("warehouse", params.warehouse);
  const qs = search.toString();
  return useQuery<StockForecastSummary>({
    queryKey: ["stock-forecast-summary", params],
    queryFn: () => api<StockForecastSummary>(`/api/forecast/stock-forecast/summary/${qs ? `?${qs}` : ""}`),
    staleTime: 60_000,
  });
}

// ---------- Mutations ----------
export function useRegenerateSalesForecast() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ status: string }>("/api/forecast/sales-forecast/regenerate/", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-forecast"] });
      qc.invalidateQueries({ queryKey: ["sales-forecast-analytics"] });
    },
  });
}

export function useRegenerateStockForecast() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ status: string }>("/api/forecast/stock-forecast/regenerate/", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-forecast"] });
      qc.invalidateQueries({ queryKey: ["stock-forecast-summary"] });
    },
  });
}
