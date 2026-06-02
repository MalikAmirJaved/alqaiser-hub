import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ============================================
// TYPES (local to this hook)
// ============================================

export interface Account {
  id: number;
  _id: string;
  code: string;
  name: string;
  account_type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  parent: number | null;
  is_active: boolean;
  description: string;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

type CreateAccountData = Omit<Account, "id" | "_id" | "created_at" | "updated_at" | "company_id" | "branch_id" | "created_by" | "updated_by">;
type UpdateAccountData = Partial<Omit<Account, "id" | "_id" | "created_at" | "updated_at">>;

// ============================================
// API FUNCTIONS (encapsulated in this hook file)
// ============================================

const ACCOUNTS_QUERY_KEY = "finance_accounts";

async function getAllAccounts(params?: { search?: string; account_type?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append("search", params.search);
  if (params?.account_type) searchParams.append("account_type", params.account_type);
  const url = `/api/finance/accounts/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<Account>>(url);
}

async function getAccountById(id: number) {
  return apiFetch<Account>(`/api/finance/accounts/${id}/`);
}

async function createAccount(data: CreateAccountData) {
  return apiFetch<Account>("/api/finance/accounts/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateAccount(id: number, data: UpdateAccountData) {
  return apiFetch<Account>(`/api/finance/accounts/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteAccount(id: number) {
  return apiFetch<void>(`/api/finance/accounts/${id}/`, { method: "DELETE" });
}

// ============================================
// REACT HOOKS
// ============================================

/**
 * Get all accounts with optional filters
 */
export function useAccounts(filters?: { search?: string; account_type?: string }) {
  return useQuery({
    queryKey: [ACCOUNTS_QUERY_KEY, filters],
    queryFn: () => getAllAccounts(filters),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}

/**
 * Get single account by ID
 */
export function useAccount(id: number | null) {
  return useQuery({
    queryKey: [ACCOUNTS_QUERY_KEY, id],
    queryFn: () => getAccountById(id!),
    enabled: !!id,
  });
}

/**
 * Create a new account
 */
export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCOUNTS_QUERY_KEY] });
    }
  });
}

/**
 * Update an existing account
 */
export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateAccountData }) =>
      updateAccount(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [ACCOUNTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ACCOUNTS_QUERY_KEY, id] });
    },
  });
}

/**
 * Delete an account
 */
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
// UTILITY EXPORTS (optional)
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