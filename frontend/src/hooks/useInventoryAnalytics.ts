"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface AnalyticsProductItem {
  product_name: string;
  variant_sku: string;
  total_stock_value: number;
  total_sales_qty: number;
  total_sales_revenue: number;
  total_purchase_qty: number;
  total_purchase_cost: number;
  margin: number;
  margin_percent: number;
  category_name: string;
  brand_name: string;
}

export interface AnalyticsBrandItem {
  brand_name: string;
  product_count: number;
  total_stock_value: number;
  total_sales_revenue: number;
  total_sales_qty: number;
  total_purchase_cost: number;
}

export interface AnalyticsCategoryItem {
  category_name: string;
  product_count: number;
  total_stock_value: number;
  total_sales_revenue: number;
  total_sales_qty: number;
}

export interface AnalyticsCustomerItem {
  customer_name: string;
  total_orders: number;
  total_revenue: number;
  total_products: number;
  last_order_date: string | null;
}

export interface AnalyticsWarehouseItem {
  warehouse_name: string;
  total_stock_value: number;
  total_on_hand: number;
  unique_variants: number;
  total_sales: number;
  total_transfers_out: number;
  total_transfers_in: number;
}

export interface AnalyticsMovementItem {
  transaction_type: string;
  total_qty: number;
  total_count: number;
}

export interface AnalyticsTransferItem {
  status: string;
  total_count: number;
  total_quantity: number;
}

export interface AnalyticsAlertItem {
  type: string;
  severity: string;
  count: number;
}

export interface AnalyticsPosItem {
  source: string;
  total_orders: number;
  total_revenue: number;
}

export interface InventoryAnalytics {
  top_products_by_value: AnalyticsProductItem[];
  top_products_by_sales: AnalyticsProductItem[];
  top_products_by_purchase: AnalyticsProductItem[];
  low_stock_products: AnalyticsProductItem[];
  products_summary: {
    total_products: number;
    total_variants: number;
    active_products: number;
    total_customers: number;
  };
  brands: AnalyticsBrandItem[];
  categories: AnalyticsCategoryItem[];
  top_customers: AnalyticsCustomerItem[];
  top_suppliers: any[];
  warehouses: AnalyticsWarehouseItem[];
  movement_by_type: AnalyticsMovementItem[];
  transfers: AnalyticsTransferItem[];
  alerts: AnalyticsAlertItem[];
  pos_summary: AnalyticsPosItem[];
}

export function useInventoryAnalytics(filters: {
  start_date?: string;
  end_date?: string;
  warehouse_id?: string;
}) {
  const api = useApi();
  const params = new URLSearchParams();
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);
  if (filters.warehouse_id) params.append("warehouse_id", filters.warehouse_id);

  const url = `/api/inventory/reports/analytics/${params.toString() ? `?${params}` : ""}`;
  return useQuery<InventoryAnalytics>({
    queryKey: ["inventory-analytics", filters],
    queryFn: () => api(url),
    staleTime: 60_000,
  });
}
