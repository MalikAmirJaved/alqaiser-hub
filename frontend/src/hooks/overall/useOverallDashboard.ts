"use client";

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface OverallSummary {
  finance: {
    revenue_mtd: string;
    expenses_mtd: string;
    net_profit_mtd: string;
    cash_position: string;
    receivables: string;
    payables: string;
  };
  inventory: {
    total_variants: number;
    total_stock_value: string;
    low_stock_count: number;
    total_sales_amount_ytd: string;
    total_purchase_amount_ytd: string;
  };
  sales: {
    total_leads: number;
    new_leads_mtd: number;
    total_quotes: number;
    quote_value: string;
    conversion_rate: number;
  };
}

export interface TrendItem {
  month: string;
  revenue: number;
  expense: number;
}

export interface SalesPurchaseItem {
  month: string;
  sales: number;
  purchases: number;
}

export interface StockMovementItem {
  month: string;
  incoming: number;
  outgoing: number;
}

export interface PaymentActivity {
  id: string;
  type: string;
  amount: string;
  date: string;
  reference: string;
}

export interface SalesOrderActivity {
  id: string;
  number: string;
  total: string;
  date: string;
  customer: string | null;
}

export interface StockTxActivity {
  id: string;
  variant: string;
  change: number;
  type: string;
  date: string;
}

export interface LeadActivity {
  id: string;
  name: string;
  status: string;
  date: string;
}

export interface QuoteActivity {
  id: string;
  number: string;
  total: string;
  status: string;
  date: string;
}

export interface Alert {
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
}

export function useOverallSummary() {
  const api = useApi();
  return useQuery<OverallSummary>({
    queryKey: ["overall_dashboard_summary"],
    queryFn: () => api("/api/overall/dashboard/summary/"),
    staleTime: 60_000,
  });
}

export function useOverallTrends() {
  const api = useApi();
  return useQuery<{
    revenue_expense: TrendItem[];
    sales_purchases: SalesPurchaseItem[];
    stock_movement: StockMovementItem[];
  }>({
    queryKey: ["overall_dashboard_trends"],
    queryFn: () => api("/api/overall/dashboard/trends/"),
    staleTime: 60_000,
  });
}

export function useOverallRecentActivity() {
  const api = useApi();
  return useQuery<{
    payments: PaymentActivity[];
    sales_orders: SalesOrderActivity[];
    stock_transactions: StockTxActivity[];
    leads: LeadActivity[];
    quotes: QuoteActivity[];
  }>({
    queryKey: ["overall_dashboard_recent_activity"],
    queryFn: () => api("/api/overall/dashboard/recent_activity/"),
    staleTime: 30_000,
  });
}

export function useOverallAlerts() {
  const api = useApi();
  return useQuery<Alert[]>({
    queryKey: ["overall_dashboard_alerts"],
    queryFn: () => api("/api/overall/dashboard/alerts/"),
    staleTime: 30_000,
  });
}