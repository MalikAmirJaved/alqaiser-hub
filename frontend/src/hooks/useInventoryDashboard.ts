// src/hooks/useInventoryDashboard.ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// Types
export interface OverallSummary {
  total_stock_value: number;
  total_variants: number;
  low_stock_count: number;
  total_purchase_amount: number;
  total_sales_amount: number;
  total_warehouses: number;
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

export interface StockItemReport {
  variant_sku: string;
  variant_name: string;
  warehouse_name: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  unit_cost: number;
  total_value: number;
}

export interface InventoryTransaction {
  id: string;
  transaction_id: string;
  variant_id: string;
  variant_sku: string;
  warehouse_name: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost: number;
  transaction_type: string;
  transaction_type_display: string;
  reason_text: string;
  created_at: string;
  created_by_name: string;
  created_by_email: string;
}

export interface PurchaseOrder {
  _id: string;
  order_number: string;
  supplier_name: string;
  total_amount: number;
  status: string;
  expected_delivery_date: string;
}

export interface SalesOrder {
  _id: string;
  order_number: string;
  customer_name: string;
  total_amount: number;
  status: string;
  order_date: string;
}

export interface StockTransfer {
  _id: string;
  transfer_number: string;
  variant_sku: string;
  source_warehouse_name: string;
  destination_warehouse_name: string;
  quantity: number;
  status: string;
  planned_date: string;
}

export interface Alert {
  id: string;
  type: string;
  type_display: string;
  severity: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
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

// 1. Overall Summary
export function useOverallSummary(startDate?: string, endDate?: string, warehouseId?: string) {
  const api = useApi();
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  if (warehouseId) params.append("warehouse_id", warehouseId);
  const url = `/api/inventory/reports/overall-summary/${params.toString() ? `?${params}` : ""}`;
  return useQuery<OverallSummary>({
    queryKey: ["dashboard_overall_summary", startDate, endDate, warehouseId],
    queryFn: () => api(url),
    staleTime: 60 * 1000,
  });
}

// 2. Stock Movement (last 30 days by default)
export function useStockMovement(startDate?: string, endDate?: string) {
  const api = useApi();
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  const url = `/api/inventory/reports/stock-movement/${params.toString() ? `?${params}` : ""}`;
  return useQuery<StockMovementItem[]>({
    queryKey: ["dashboard_stock_movement", startDate, endDate],
    queryFn: () => api(url),
    staleTime: 60 * 1000,
  });
}

// 3. Sales vs Purchase
export function useSalesVsPurchase(startDate?: string, endDate?: string) {
  const api = useApi();
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  const url = `/api/inventory/reports/sales-vs-purchase/${params.toString() ? `?${params}` : ""}`;
  return useQuery<SalesVsPurchaseItem[]>({
    queryKey: ["dashboard_sales_vs_purchase", startDate, endDate],
    queryFn: () => api(url),
    staleTime: 60 * 1000,
  });
}

// 4. Profit & Loss (Top 10)
export function useProfitLoss() {
  const api = useApi();
  return useQuery<ProfitLossItem[]>({
    queryKey: ["dashboard_profit_loss"],
    queryFn: () => api("/api/inventory/reports/profit-loss/"),
    staleTime: 60 * 1000,
    select: (data) => data.slice(0, 10),
  });
}

// 5. Low Stock Items (first 10)
export function useLowStockItems() {
  const api = useApi();
  return useQuery<StockItemReport[]>({
    queryKey: ["dashboard_low_stock"],
    queryFn: () => api("/api/inventory/stock/current-stock/?low_stock=true&page_size=10"),
    staleTime: 30 * 1000,
    select: (data: any) => data.results,
  });
}

// 6. Recent Inventory Transactions (last 10)
export function useRecentTransactions() {
  const api = useApi();
  return useQuery<InventoryTransaction[]>({
    queryKey: ["dashboard_recent_transactions"],
    queryFn: () => api("/api/inventory/stock/history/?page_size=10"),
    staleTime: 30 * 1000,
    select: (data: any) => data.results,
  });
}

// 7. Pending Purchase Orders
export function usePendingPurchaseOrders() {
  const api = useApi();
  return useQuery<PurchaseOrder[]>({
    queryKey: ["dashboard_pending_po"],
    queryFn: () => api("/api/inventory/purchase-orders/?status=CONFIRMED"),
    staleTime: 30 * 1000,
    select: (data: any) => data.results,
  });
}

// 8. Pending Sales Orders (DRAFT or PENDING)
export function usePendingSalesOrders() {
  const api = useApi();
  return useQuery<SalesOrder[]>({
    queryKey: ["dashboard_pending_so"],
    queryFn: () => api("/api/inventory/sales-orders/?status=PENDING"),
    staleTime: 30 * 1000,
    select: (data: any) => data.results,
  });
}

// 9. Active Stock Transfers
export function useActiveTransfers() {
  const api = useApi();
  return useQuery<StockTransfer[]>({
    queryKey: ["dashboard_active_transfers"],
    queryFn: () => api("/api/inventory/transfers/?status=PENDING"),
    staleTime: 30 * 1000,
    select: (data: any) => data.results,
  });
}

// 10. Unread Alerts (limit 5)
export function useUnreadAlerts() {
  const api = useApi();
  return useQuery<Alert[]>({
    queryKey: ["dashboard_alerts"],
    queryFn: () => api("/api/inventory/alerts/?is_read=false&page_size=5"),
    staleTime: 20 * 1000,
    select: (data: any) => data.results,
  });
}

// 11. Reorder Planning (top urgent)
export function useReorderPlanning() {
  const api = useApi();
  return useQuery<ReorderPlanningItem[]>({
    queryKey: ["dashboard_reorder_planning"],
    queryFn: () => api("/api/inventory/reports/reorder-planning/"),
    staleTime: 60 * 1000,
    select: (data) => data.slice(0, 5),
  });
}