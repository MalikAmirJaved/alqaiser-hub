import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface BalanceSheetAccount {
  code: string;
  name: string;
  balance: number;
}

export interface BalanceSheetResponse {
  success: boolean;
  as_of_date: string;
  assets: {
    accounts: BalanceSheetAccount[];
    total: number;
  };
  liabilities: {
    accounts: BalanceSheetAccount[];
    total: number;
  };
  equity: {
    accounts: BalanceSheetAccount[];
    total: number;
  };
  is_balanced: boolean;
}

export function useBalanceSheet(asOfDate: string) {
  const params = new URLSearchParams({ as_of_date: asOfDate });
  const url = `/api/finance/reports/balance_sheet/?${params.toString()}`;
  
  return useQuery({
    queryKey: ['finance_balance_sheet', asOfDate],
    queryFn: async () => {
      const res = await apiFetch<BalanceSheetResponse>(url);
      // Convert balances to numbers
      return {
        ...res,
        assets: {
          accounts: res.assets.accounts.map(a => ({ ...a, balance: Number(a.balance) })),
          total: Number(res.assets.total)
        },
        liabilities: {
          accounts: res.liabilities.accounts.map(a => ({ ...a, balance: Number(a.balance) })),
          total: Number(res.liabilities.total)
        },
        equity: {
          accounts: res.equity.accounts.map(a => ({ ...a, balance: Number(a.balance) })),
          total: Number(res.equity.total)
        }
      };
    },
    enabled: !!asOfDate,
    staleTime: 30_000,
  });
}