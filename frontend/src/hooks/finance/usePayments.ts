import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ============================================
// TYPES
// ============================================

export interface Payment {
  id: string;
  payment_type: "RECEIPT" | "PAYMENT";
  payment_method: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "CREDIT_CARD" | "OTHER";
  amount: number | string;
  payment_date: string;
  reference_number: string;
  supplier_bill: string | null;
  customer_invoice: string | null;
  bank_account: string | null;
  journal_entry: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  supplier_name?: string;
  customer_name?: string;
  bank_account_name?: string;
  outstanding?: number;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

type CreatePaymentData = Omit<Payment, "id" | "created_at" | "updated_at" | "journal_entry">;
type UpdatePaymentData = Partial<CreatePaymentData>;

// ============================================
// API FUNCTIONS
// ============================================

const PAYMENTS_KEY = "finance_payments";

async function getAllPayments(params?: {
  payment_type?: "RECEIPT" | "PAYMENT";
  supplier_bill?: string;
  customer_invoice?: string;
  start_date?: string;
  end_date?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.payment_type) searchParams.append("payment_type", params.payment_type);
  if (params?.supplier_bill) searchParams.append("supplier_bill", String(params.supplier_bill));
  if (params?.customer_invoice) searchParams.append("customer_invoice", String(params.customer_invoice));
  if (params?.start_date) searchParams.append("start_date", params.start_date);
  if (params?.end_date) searchParams.append("end_date", params.end_date);
  const url = `/api/finance/payments/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<Payment>>(url);
}

async function getPaymentById(id: string) {
  return apiFetch<Payment>(`/api/finance/payments/${id}/`);
}

async function createPayment(data: CreatePaymentData) {
  return apiFetch<Payment>("/api/finance/payments/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updatePayment(id: string, data: UpdatePaymentData) {
  return apiFetch<Payment>(`/api/finance/payments/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deletePayment(id: string) {
  return apiFetch<void>(`/api/finance/payments/${id}/`, { method: "DELETE" });
}

// ============================================
// REACT HOOKS
// ============================================

export function usePayments(filters?: {
  payment_type?: "RECEIPT" | "PAYMENT";
  supplier_bill?: string;
  customer_invoice?: string;
  start_date?: string;
  end_date?: string;
}) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, filters],
    queryFn: () => getAllPayments(filters),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}

export function usePayment(id: string | null) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, id],
    queryFn: () => getPaymentById(id!),
    enabled: !!id,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["finance_supplier_bills"] });
      queryClient.invalidateQueries({ queryKey: ["finance_customer_invoices"] });
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePaymentData }) =>
      updatePayment(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY, id] });
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
    },
  });
}

// ============================================
// UTILITIES
// ============================================

export const paymentTypeLabels: Record<Payment["payment_type"], string> = {
  RECEIPT: "Receipt (Customer Payment)",
  PAYMENT: "Payment (Supplier Payment)",
};

export const paymentMethodLabels: Record<Payment["payment_method"], string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  CREDIT_CARD: "Credit Card",
  OTHER: "Other",
};

export const paymentTypeOptions = [
  { value: "RECEIPT", label: "Receipt (from Customer)" },
  { value: "PAYMENT", label: "Payment (to Supplier)" },
];

export const paymentMethodOptions = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "OTHER", label: "Other" },
];