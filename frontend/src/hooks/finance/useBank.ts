import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ============================================
// TYPES
// ============================================

export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "FEE" | "INTEREST";
export type PaymentType = "RECEIPT" | "PAYMENT";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CHEQUE" | "CREDIT_CARD" | "OTHER";

export interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  opening_balance: number;
  current_balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankTransaction {
  id: string;
  bank_account: string;
  bank_account_name?: string;
  transaction_date: string;
  amount: number;
  transaction_type: TransactionType;
  description: string;
  reference: string;
  reconciled: boolean;
  reconciled_with_payment: number | null;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface CreateBankTransactionData {
  bank_account: string;
  transaction_date: string;
  amount: number;
  transaction_type: TransactionType;
  description?: string;
  reference?: string;
}

export interface UpdateBankTransactionData extends Partial<CreateBankTransactionData> {}

export interface CreateBankAccountData {
  account_name: string;
  account_number: string;
  bank_name: string;
  opening_balance: number;
  currency: string;
  is_active: boolean;
}

export interface UpdateBankAccountData extends Partial<CreateBankAccountData> {}

// ============================================
// API FUNCTIONS
// ============================================

const BANK_ACCOUNTS_KEY = "finance_bank_accounts";
const BANK_TRANSACTIONS_KEY = "finance_bank_transactions";

// Bank Accounts
async function getAllBankAccounts(params?: { search?: string; is_active?: boolean }) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append("search", params.search);
  if (params?.is_active !== undefined) searchParams.append("is_active", String(params.is_active));
  const url = `/api/finance/bank-accounts/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<BankAccount>>(url);
}

async function getBankAccountById(id: string) {
  return apiFetch<BankAccount>(`/api/finance/bank-accounts/${id}/`);
}

async function createBankAccount(data: CreateBankAccountData) {
  return apiFetch<BankAccount>("/api/finance/bank-accounts/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateBankAccount(id: string, data: UpdateBankAccountData) {
  return apiFetch<BankAccount>(`/api/finance/bank-accounts/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteBankAccount(id: string) {
  return apiFetch<void>(`/api/finance/bank-accounts/${id}/`, { method: "DELETE" });
}

// Bank Transactions
async function getAllBankTransactions(params?: {
  bank_account?: string;
  reconciled?: boolean;
  start_date?: string;
  end_date?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.bank_account) searchParams.append("bank_account", String(params.bank_account));
  if (params?.reconciled !== undefined) searchParams.append("reconciled", String(params.reconciled));
  if (params?.start_date) searchParams.append("start_date", params.start_date);
  if (params?.end_date) searchParams.append("end_date", params.end_date);
  const url = `/api/finance/bank-transactions/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<BankTransaction>>(url);
}

async function getBankTransactionById(id: string) {
  return apiFetch<BankTransaction>(`/api/finance/bank-transactions/${id}/`);
}

async function createBankTransaction(data: CreateBankTransactionData) {
  return apiFetch<BankTransaction>("/api/finance/bank-transactions/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateBankTransaction(id: string, data: UpdateBankTransactionData) {
  return apiFetch<BankTransaction>(`/api/finance/bank-transactions/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteBankTransaction(id: string) {
  return apiFetch<void>(`/api/finance/bank-transactions/${id}/`, { method: "DELETE" });
}

async function reconcileBankTransaction(id: string, paymentId: string) {
  return apiFetch<{ status: string }>(`/api/finance/bank-transactions/${id}/reconcile/`, {
    method: "POST",
    body: JSON.stringify({ payment_id: paymentId }),
  });
}

// ============================================
// REACT HOOKS - Bank Accounts
// ============================================

export function useBankAccounts(filters?: { search?: string; is_active?: boolean }) {
  return useQuery({
    queryKey: [BANK_ACCOUNTS_KEY, filters],
    queryFn: () => getAllBankAccounts(filters),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}

export function useBankAccount(id: string | null) {
  return useQuery({
    queryKey: [BANK_ACCOUNTS_KEY, id],
    queryFn: () => getBankAccountById(id!),
    enabled: !!id,
  });
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBankAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_ACCOUNTS_KEY] });
    },
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBankAccountData }) =>
      updateBankAccount(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [BANK_ACCOUNTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [BANK_ACCOUNTS_KEY, id] });
    },
  });
}

export function useDeleteBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBankAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_ACCOUNTS_KEY] });
    },
  });
}

// ============================================
// REACT HOOKS - Bank Transactions
// ============================================

export function useBankTransactions(filters?: {
  bank_account?: string;
  reconciled?: boolean;
  start_date?: string;
  end_date?: string;
}) {
  return useQuery({
    queryKey: [BANK_TRANSACTIONS_KEY, filters],
    queryFn: () => getAllBankTransactions(filters),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}

export function useBankTransaction(id: string | null) {
  return useQuery({
    queryKey: [BANK_TRANSACTIONS_KEY, id],
    queryFn: () => getBankTransactionById(id!),
    enabled: !!id,
  });
}

export function useCreateBankTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBankTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_TRANSACTIONS_KEY] });
    },
  });
}

export function useUpdateBankTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBankTransactionData }) =>
      updateBankTransaction(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [BANK_TRANSACTIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [BANK_TRANSACTIONS_KEY, id] });
    },
  });
}

export function useDeleteBankTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBankTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANK_TRANSACTIONS_KEY] });
    },
  });
}

export function useReconcileBankTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paymentId }: { id: string; paymentId: string }) =>
      reconcileBankTransaction(id, paymentId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [BANK_TRANSACTIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [BANK_TRANSACTIONS_KEY, id] });
    },
  });
}

// ============================================
// UTILITIES
// ============================================

export const transactionTypeLabels: Record<TransactionType, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  FEE: "Fee",
  INTEREST: "Interest",
};

export const transactionTypeOptions = [
  { value: "DEPOSIT" as const, label: "Deposit" },
  { value: "WITHDRAWAL" as const, label: "Withdrawal" },
  { value: "FEE" as const, label: "Fee" },
  { value: "INTEREST" as const, label: "Interest" },
];