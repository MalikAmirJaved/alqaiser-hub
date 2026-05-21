"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface OverallSummary {
  total_stock_value: number;
  total_variants: number;
  low_stock_count: number;
  total_purchase_amount: number;
  total_sales_amount: number;
  total_warehouses: number;
}

export interface StockReportItem {
  variant_sku: string;
  variant_name: string;
  warehouse_name: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  unit_cost: number;
  total_value: number;
}

export interface StockSummaryItem {
  product_name: string;
  category_name: string;
  warehouse_name: string;
  variant_sku: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  unit_cost: number;
  total_value: number;
}

export interface ValuationReport {
  methodology: string;
  total_quantity: number;
  total_value: number;
  average_unit_cost: number;
}

export interface StockMovementItem {
  period: string;
  transaction_type: string;
  total_quantity: number;
  transaction_count: number;
}

export interface SalesVsPurchaseItem {
  period: string;
  sales_amount: number;
  purchase_amount: number;
}

export interface ProfitLossItem {
  product_name: string;
  variant_sku: string;
  sales_quantity: number;
  sales_revenue: number;
  cogs: number;
  gross_profit: number;
  margin_percent: number;
}

export interface SlowMovingItem {
  product_name: string;
  variant_sku: string;
  warehouse_name: string;
  quantity_on_hand: number;
  days_since_last_sale: number;
  status: string;
}

export interface ReorderPlanningItem {
  product_name: string;
  variant_sku: string;
  quantity_on_hand: number;
  min_stock_level: number;
  max_stock_level: number;
  recommended_reorder_qty: number;
  urgency_score: number;
  suggested_supplier_name: string;
}

export interface SupplierPerformanceItem {
  supplier_name: string;
  supplier_code: string;
  fulfillment_rate: number;
  average_lead_time_days: number;
  total_purchase_amount: number;
  orders_count: number;
  performance_score: number;
}

export function useOverallSummary(filters: {
  start_date?: string;
  end_date?: string;
  warehouse_id?: string;
}) {
  const api = useApi();
  const params = new URLSearchParams();
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);
  if (filters.warehouse_id) params.append("warehouse_id", filters.warehouse_id);

  const url = `/api/inventory/reports/overall-summary/${params.toString() ? `?${params}` : ""}`;
  return useQuery<OverallSummary>({
    queryKey: ["overall-summary", filters],
    queryFn: () => api(url),
    staleTime: 60_000,
  });
}

export function useStockReport(warehouse_id?: string) {
  const api = useApi();
  const url = `/api/inventory/reports/stock-report/${warehouse_id ? `?warehouse_id=${warehouse_id}` : ""}`;
  return useQuery<StockReportItem[]>({
    queryKey: ["stock-report", warehouse_id],
    queryFn: () => api(url),
    staleTime: 60_000,
  });
}

export function useStockSummaryReport(warehouse_id?: string) {
  const api = useApi();
  const url = `/api/inventory/reports/stock-summary/${warehouse_id ? `?warehouse_id=${warehouse_id}` : ""}`;
  return useQuery<StockSummaryItem[]>({
    queryKey: ["stock-summary-report", warehouse_id],
    queryFn: () => api(url),
    staleTime: 60_000,
  });
}

export function useInventoryValuationReport(warehouse_id?: string) {
  const api = useApi();
  const url = `/api/inventory/reports/inventory-valuation/${warehouse_id ? `?warehouse_id=${warehouse_id}` : ""}`;
  return useQuery<ValuationReport>({
    queryKey: ["inventory-valuation-report", warehouse_id],
    queryFn: () => api(url),
    staleTime: 60_000,
  });
}

export function useStockMovementReport(filters: {
  start_date?: string;
  end_date?: string;
}) {
  const api = useApi();
  const params = new URLSearchParams();
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);

  const url = `/api/inventory/reports/stock-movement/${params.toString() ? `?${params}` : ""}`;
  return useQuery<StockMovementItem[]>({
    queryKey: ["stock-movement-report", filters],
    queryFn: () => api(url),
    staleTime: 60_000,
  });
}

export function useSalesVsPurchaseReport(filters: {
  start_date?: string;
  end_date?: string;
}) {
  const api = useApi();
  const params = new URLSearchParams();
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);

  const url = `/api/inventory/reports/sales-vs-purchase/${params.toString() ? `?${params}` : ""}`;
  return useQuery<SalesVsPurchaseItem[]>({
    queryKey: ["sales-vs-purchase-report", filters],
    queryFn: () => api(url),
    staleTime: 60_000,
  });
}

export function useProfitLossReport(warehouse_id?: string) {
  const api = useApi();
  const url = `/api/inventory/reports/profit-loss/${warehouse_id ? `?warehouse_id=${warehouse_id}` : ""}`;
  return useQuery<ProfitLossItem[]>({
    queryKey: ["profit-loss-report", warehouse_id],
    queryFn: () => api(url),
    staleTime: 60_000,
  });
}

export function useSlowMovingReport(warehouse_id?: string) {
  const api = useApi();
  const url = `/api/inventory/reports/slow-moving/${warehouse_id ? `?warehouse_id=${warehouse_id}` : ""}`;
  return useQuery<SlowMovingItem[]>({
    queryKey: ["slow-moving-report", warehouse_id],
    queryFn: () => api(url),
    staleTime: 60_000,
  });
}

export function useReorderPlanningReport(warehouse_id?: string) {
  const api = useApi();
  const url = `/api/inventory/reports/reorder-planning/${warehouse_id ? `?warehouse_id=${warehouse_id}` : ""}`;
  return useQuery<ReorderPlanningItem[]>({
    queryKey: ["reorder-planning-report", warehouse_id],
    queryFn: () => api(url),
    staleTime: 60_000,
  });
}

export function useSupplierPerformanceReport() {
  const api = useApi();
  const url = `/api/inventory/reports/supplier-performance/`;
  return useQuery<SupplierPerformanceItem[]>({
    queryKey: ["supplier-performance-report"],
    queryFn: () => api(url),
    staleTime: 60_000,
  });
}