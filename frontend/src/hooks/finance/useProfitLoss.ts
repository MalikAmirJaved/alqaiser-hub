import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface PnLAccount {
  code: string;
  name: string;
  amount: number;
}

export interface ProfitLossResponse {
  success: boolean;
  period: { start_date: string; end_date: string };
  income: {
    total: number;
    accounts: PnLAccount[];
  };
  expenses: {
    total: number;
    accounts: PnLAccount[];
  };
  net_profit: number;
  is_profit: boolean;
}

export function useProfitLoss(startDate: string, endDate: string) {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  const url = `/api/finance/reports/profit_loss/?${params.toString()}`;
  
  return useQuery({
    queryKey: ['finance_profit_loss', startDate, endDate],
    queryFn: async () => {
      const res = await apiFetch<ProfitLossResponse>(url);
      // Convert string amounts to numbers
      return {
        ...res,
        income: {
          total: Number(res.income.total),
          accounts: res.income.accounts.map(a => ({ ...a, amount: Number(a.amount) }))
        },
        expenses: {
          total: Number(res.expenses.total),
          accounts: res.expenses.accounts.map(a => ({ ...a, amount: Number(a.amount) }))
        },
        net_profit: Number(res.net_profit),
      };
    },
    enabled: !!startDate && !!endDate,
    staleTime: 30_000,
  });
}