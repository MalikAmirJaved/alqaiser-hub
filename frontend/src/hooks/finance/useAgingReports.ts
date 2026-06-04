import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface AgingDetail {
  invoice_number?: string;
  bill_number?: string;
  customer?: string;
  supplier?: string;
  due_date: string;
  outstanding: number;
  bucket: string;
}

export interface AgingReport {
  aging: {
    current: number;
    '1_30': number;
    '31_60': number;
    '61_90': number;
    '90_plus': number;
  };
  details: AgingDetail[];
}

export function useARAging() {
  return useQuery({
    queryKey: ['ar_aging'],
    queryFn: () => apiFetch<AgingReport>('/api/finance/reports/ar_aging/'),
    staleTime: 60_000,
  });
}

export function useAPAging() {
  return useQuery({
    queryKey: ['ap_aging'],
    queryFn: () => apiFetch<AgingReport>('/api/finance/reports/ap_aging/'),
    staleTime: 60_000,
  });
}