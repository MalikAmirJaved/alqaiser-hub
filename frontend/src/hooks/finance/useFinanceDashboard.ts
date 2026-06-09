"use client";

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface FinanceDashboardKpis {
  revenue_mtd: string;
  expenses_mtd: string;
  net_profit_mtd: string;
  cash_position: string;
  receivables: string;
  payables: string;
  unpaid_invoices: number;
  unpaid_bills: number;
  payroll_records: number;
}

export function useFinanceDashboardSummary() {
  const api = useApi();
  return useQuery<{ kpis: FinanceDashboardKpis }>({
    queryKey: ["finance_dashboard_summary"],
    queryFn: () => api("/api/finance/dashboard/summary/"),
    staleTime: 60_000,
  });
}

export function useFinanceCashflow() {
  const api = useApi();
  return useQuery<{ data: { month: string; inflow: number; outflow: number }[] }>({
    queryKey: ["finance_dashboard_cashflow"],
    queryFn: () => api("/api/finance/dashboard/cashflow/"),
    staleTime: 60_000,
  });
}

export function useFinanceExpenseBreakdown() {
  const api = useApi();
  return useQuery<{ data: { name: string; value: number }[] }>({
    queryKey: ["finance_dashboard_expense_breakdown"],
    queryFn: () => api("/api/finance/dashboard/expense_breakdown/"),
    staleTime: 60_000,
  });
}

export function useFinanceBankBalances() {
  const api = useApi();
  return useQuery<{ data: { name: string; currency: string; balance: string }[] }>({
    queryKey: ["finance_dashboard_bank_balances"],
    queryFn: () => api("/api/finance/dashboard/bank_balances/"),
    staleTime: 60_000,
  });
}

export function useFinanceRecentPayments() {
  const api = useApi();
  return useQuery<{ data: unknown[] }>({
    queryKey: ["finance_dashboard_recent_payments"],
    queryFn: () => api("/api/finance/dashboard/recent_payments/"),
    staleTime: 30_000,
  });
}

export function useFinanceRevenueTrend() {
  const api = useApi();
  return useQuery<{ data: { month: string; revenue: number; expense: number }[] }>({
    queryKey: ["finance_dashboard_revenue_trend"],
    queryFn: () => api("/api/finance/dashboard/revenue_trend/"),
    staleTime: 60_000,
  });
}
