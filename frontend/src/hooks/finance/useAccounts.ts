import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ============================================
// TYPES (local to this hook)
// ============================================

export interface Account {
  id: string;
  code: string;
  name: string;
  account_type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  parent: string | null;
  parent_uuid: string | null;
  is_active: boolean;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface AccountBalance {
  code: string;
  name: string;
  account_type: string;
  balance: string;
}

export interface AccountBalancesResponse {
  success: boolean;
  data: Record<string, AccountBalance>;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

type CreateAccountData = Omit<Account, "id" | "created_at" | "updated_at" | "company_id" | "branch_id" | "created_by" | "updated_by" | "parent_uuid">;
type UpdateAccountData = Partial<Omit<Account, "id" | "created_at" | "updated_at" | "parent_uuid">>;

// ============================================
// API FUNCTIONS
// ============================================

const ACCOUNTS_QUERY_KEY = "finance_accounts";
const BALANCES_QUERY_KEY = "finance_account_balances";

async function getAllAccounts(params?: { search?: string; account_type?: string; page?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append("search", params.search);
  if (params?.account_type) searchParams.append("account_type", params.account_type);
  if (params?.page) searchParams.append("page", params.page);
  const url = `/api/finance/accounts/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<Account>>(url);
}

async function getAccountById(id: string) {
  return apiFetch<Account>(`/api/finance/accounts/${id}/`);
}

async function createAccount(data: CreateAccountData) {
  return apiFetch<Account>("/api/finance/accounts/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateAccount(id: string, data: UpdateAccountData) {
  return apiFetch<Account>(`/api/finance/accounts/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteAccount(id: string) {
  return apiFetch<void>(`/api/finance/accounts/${id}/`, { method: "DELETE" });
}

/** Fetch live account balances from the chart-of-accounts mapping endpoint */
export async function fetchAccountBalances(params?: { start_date?: string; end_date?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.start_date) searchParams.append("start_date", params.start_date);
  if (params?.end_date) searchParams.append("end_date", params.end_date);
  const qs = searchParams.toString();
  return apiFetch<AccountBalancesResponse>(`/api/finance/accounts/balances/${qs ? `?${qs}` : ""}`);
}

// ============================================
// REACT HOOKS
// ============================================

export function useAccounts(filters?: { search?: string; account_type?: string; page?: string }) {
  const query = useQuery<PaginatedResponse<Account>>({
    queryKey: [ACCOUNTS_QUERY_KEY, filters],
    queryFn: () => getAllAccounts(filters),
    staleTime: 30_000,
  });

  return {
    ...query,
    data: query.data?.results ?? [],
    totalCount: query.data?.count ?? 0,
  };
}

export function useAccount(id: string | null) {
  return useQuery({
    queryKey: [ACCOUNTS_QUERY_KEY, id],
    queryFn: () => getAccountById(id!),
    enabled: !!id,
  });
}

/** Hook to fetch live account balances mapped by account code */
export function useAccountBalances(dateRange?: { start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: [BALANCES_QUERY_KEY, dateRange],
    queryFn: () => fetchAccountBalances(dateRange),
    select: (response) => response.data,
    staleTime: 30_000,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCOUNTS_QUERY_KEY] });
    }
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAccountData }) =>
      updateAccount(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [ACCOUNTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ACCOUNTS_QUERY_KEY, id] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCOUNTS_QUERY_KEY] });
    },
  });
}

// ============================================
// UTILITIES
// ============================================

export const accountTypeLabels: Record<Account["account_type"], string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expense",
};

export const accountTypeOptions = [
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expense" },
];
