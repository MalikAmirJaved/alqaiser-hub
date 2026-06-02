import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface Budget {
  id: string;
  account: string;
  account_name: string;
  account_code: string;
  period_type: "MONTHLY" | "QUARTERLY" | "YEARLY";
  year: number;
  month?: number;
  quarter?: number;
  amount: number;
  notes: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface CreateBudgetData {
  account: string;
  period_type: "MONTHLY" | "QUARTERLY" | "YEARLY";
  year: number;
  month?: number;
  quarter?: number;
  amount: number;
  notes?: string;
}

type UpdateBudgetData = Partial<CreateBudgetData>;

const BUDGETS_KEY = "finance_budgets";

async function getAllBudgets(params?: { account_id?: string; year?: number; period_type?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.account_id) searchParams.append("account_id", params.account_id);
  if (params?.year) searchParams.append("year", String(params.year));
  if (params?.period_type) searchParams.append("period_type", params.period_type);
  const url = `/api/finance/budgets/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<Budget>>(url);
}

async function createBudget(data: CreateBudgetData) {
  return apiFetch<Budget>("/api/finance/budgets/", { method: "POST", body: JSON.stringify(data) });
}

async function updateBudget(id: string, data: UpdateBudgetData) {
  return apiFetch<Budget>(`/api/finance/budgets/${id}/`, { method: "PUT", body: JSON.stringify(data) });
}

async function deleteBudget(id: string) {
  return apiFetch<void>(`/api/finance/budgets/${id}/`, { method: "DELETE" });
}

async function getVarianceReport(year: number, period_type: string) {
  return apiFetch<{ success: boolean; data: any[] }>(`/api/finance/budgets/variance_report/?year=${year}&period_type=${period_type}`);
}

export function useBudgets(filters?: { account_id?: string; year?: number; period_type?: string }) {
  return useQuery({
    queryKey: [BUDGETS_KEY, filters],
    queryFn: () => getAllBudgets(filters),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBudget,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] }),
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBudgetData }) => updateBudget(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
      queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY, id] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] }),
  });
}

export function useBudgetVariance(year: number, period_type: string) {
  return useQuery({
    queryKey: ["budget_variance", year, period_type],
    queryFn: () => getVarianceReport(year, period_type),
    select: (data) => data.data,
    enabled: !!year && !!period_type,
    staleTime: 30_000,
  });
}