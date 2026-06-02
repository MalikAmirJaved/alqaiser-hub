import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface TrialBalanceAccount {
  account_id: number;
  code: string;
  name: string;
  account_type: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface TrialBalanceResponse {
  success: boolean;
  data: TrialBalanceAccount[];
  summary: {
    total_debits: string;
    total_credits: string;
    is_balanced: boolean;
  };
}

export function useTrialBalance(asOfDate?: string) {
  const params = new URLSearchParams();
  if (asOfDate) params.append('as_of_date', asOfDate);
  const url = `/api/finance/reports/trial_balance/${params.toString() ? `?${params}` : ''}`;
  
  return useQuery({
    queryKey: ['finance_trial_balance', asOfDate],
    queryFn: () => apiFetch<TrialBalanceResponse>(url),
    staleTime: 30_000,
  });
}