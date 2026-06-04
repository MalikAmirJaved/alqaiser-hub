import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface ExpenseCategory {
  category: string;
  total: number;
}

export function useExpenseReport(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const url = `/api/finance/reports/expense_report/${params.toString() ? `?${params}` : ''}`;
  return useQuery({
    queryKey: ['expense_report', startDate, endDate],
    queryFn: () => apiFetch<{ by_category: ExpenseCategory[] }>(url),
    select: (data) => data.by_category,
    staleTime: 60_000,
  });
}