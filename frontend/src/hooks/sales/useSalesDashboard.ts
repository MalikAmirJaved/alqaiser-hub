"use client";

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface SalesDashboardKpis {
  total_leads: number;
  new_leads_mtd: number;
  total_quotes: number;
  quote_value: string;
  total_customers: number;
  invoice_total: string;
  outstanding: string;
  paid_mtd: string;
  conversion_rate: number;
}

export function useSalesDashboardSummary() {
  const api = useApi();
  return useQuery<{
    kpis: SalesDashboardKpis;
    leads_by_status: { status: string; count: number }[];
    quotes_by_status: { status: string; count: number }[];
  }>({
    queryKey: ["sales_dashboard_summary"],
    queryFn: () => api("/api/sales/dashboard/summary/"),
    staleTime: 60_000,
  });
}

export function useSalesPipeline() {
  const api = useApi();
  return useQuery<{ data: { stage: string; count: number; status: string }[] }>({
    queryKey: ["sales_dashboard_pipeline"],
    queryFn: () => api("/api/sales/dashboard/pipeline/"),
    staleTime: 60_000,
  });
}

export function useSalesRecentActivity() {
  const api = useApi();
  return useQuery<{
    leads: { id: string; name: string; status: string; source: string; created_at: string }[];
    quotes: { id: string; quote_number: string; status: string; total_amount: string; created_at: string }[];
  }>({
    queryKey: ["sales_dashboard_recent_activity"],
    queryFn: () => api("/api/sales/dashboard/recent_activity/"),
    staleTime: 30_000,
  });
}
