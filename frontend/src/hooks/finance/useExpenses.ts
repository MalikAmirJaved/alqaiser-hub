import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface Expense {
  id: string;
  expense_number: string;
  category: string;
  expense_date: string;
  amount: number;
  description: string;
  paid: boolean;
  payment_date: string | null;
  payment_method: string;
  reference_number: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

type CreateExpenseData = Omit<Expense, "id" | "created_at" | "updated_at" | "paid" | "payment_date" | "payment_method" | "reference_number">;
type UpdateExpenseData = Partial<CreateExpenseData>;

const EXPENSES_KEY = "finance_expenses";

async function getAllExpenses(params?: { category?: string; paid?: boolean; start_date?: string; end_date?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.append("category", params.category);
  if (params?.paid !== undefined) searchParams.append("paid", String(params.paid));
  if (params?.start_date) searchParams.append("start_date", params.start_date);
  if (params?.end_date) searchParams.append("end_date", params.end_date);
  const url = `/api/finance/expenses/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<Expense>>(url);
}

async function createExpense(data: CreateExpenseData) {
  return apiFetch<Expense>("/api/finance/expenses/", { method: "POST", body: JSON.stringify(data) });
}

async function updateExpense(id: string, data: UpdateExpenseData) {
  return apiFetch<Expense>(`/api/finance/expenses/${id}/`, { method: "PUT", body: JSON.stringify(data) });
}

async function deleteExpense(id: string) {
  return apiFetch<void>(`/api/finance/expenses/${id}/`, { method: "DELETE" });
}

async function recordExpensePayment(id: string, paymentData: { payment_date: string; payment_method: string; reference_number?: string }) {
  return apiFetch<Expense>(`/api/finance/expenses/${id}/record_payment/`, { method: "POST", body: JSON.stringify(paymentData) });
}

export function useExpenses(filters?: { category?: string; paid?: boolean; start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: [EXPENSES_KEY, filters],
    queryFn: () => getAllExpenses(filters),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [EXPENSES_KEY] }),
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseData }) => updateExpense(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [EXPENSES_KEY] });
      queryClient.invalidateQueries({ queryKey: [EXPENSES_KEY, id] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [EXPENSES_KEY] }),
  });
}

export function useRecordExpensePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { payment_date: string; payment_method: string; reference_number?: string } }) =>
      recordExpensePayment(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [EXPENSES_KEY] });
      queryClient.invalidateQueries({ queryKey: [EXPENSES_KEY, id] });
    },
  });
}

export const expenseCategoryLabels: Record<string, string> = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  SALARIES: "Salaries",
  OFFICE_SUPPLIES: "Office Supplies",
  TRAVEL: "Travel",
  MARKETING: "Marketing",
  SOFTWARE: "Software",
  MAINTENANCE: "Maintenance",
  INSURANCE: "Insurance",
  TAXES: "Taxes",
  OTHER: "Other",
};

export const expenseCategoryOptions = Object.entries(expenseCategoryLabels).map(([value, label]) => ({ value, label }));