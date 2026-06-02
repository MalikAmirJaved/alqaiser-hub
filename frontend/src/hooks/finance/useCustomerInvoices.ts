import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ============================================
// TYPES
// ============================================

export interface CustomerInvoice {
  id: number;
  _id: string;
  invoice_number: string;
  customer: number;
  customer_name?: string; // from serializer
  sales_order: number | null;
  invoice_date: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  outstanding: number;
  status: "DRAFT" | "POSTED" | "PAID" | "PARTIAL" | "CANCELLED";
  journal_entry: number | null;
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

type CreateCustomerInvoiceData = Omit<CustomerInvoice, "id" | "_id" | "created_at" | "updated_at" | "outstanding" | "paid_amount" | "status" | "journal_entry">;
type UpdateCustomerInvoiceData = Partial<CreateCustomerInvoiceData>;

// ============================================
// API FUNCTIONS
// ============================================

const CUSTOMER_INVOICES_KEY = "finance_customer_invoices";

async function getAllCustomerInvoices(params?: { status?: string; customer?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append("status", params.status);
  if (params?.customer) searchParams.append("customer", String(params.customer));
  const url = `/api/finance/customer-invoices/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<CustomerInvoice>>(url);
}

async function getCustomerInvoiceById(id: number) {
  return apiFetch<CustomerInvoice>(`/api/finance/customer-invoices/${id}/`);
}

async function createCustomerInvoice(data: CreateCustomerInvoiceData) {
  return apiFetch<CustomerInvoice>("/api/finance/customer-invoices/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateCustomerInvoice(id: number, data: UpdateCustomerInvoiceData) {
  return apiFetch<CustomerInvoice>(`/api/finance/customer-invoices/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteCustomerInvoice(id: number) {
  return apiFetch<void>(`/api/finance/customer-invoices/${id}/`, { method: "DELETE" });
}

async function postCustomerInvoice(id: number) {
  return apiFetch<CustomerInvoice>(`/api/finance/customer-invoices/${id}/post_invoice/`, { method: "POST" });
}

// ============================================
// REACT HOOKS
// ============================================

export function useCustomerInvoices(filters?: { status?: string; customer?: number }) {
  return useQuery({
    queryKey: [CUSTOMER_INVOICES_KEY, filters],
    queryFn: () => getAllCustomerInvoices(filters),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}

export function useCustomerInvoice(id: number | null) {
  return useQuery({
    queryKey: [CUSTOMER_INVOICES_KEY, id],
    queryFn: () => getCustomerInvoiceById(id!),
    enabled: !!id,
  });
}

export function useCreateCustomerInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCustomerInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_INVOICES_KEY] });
    },
  });
}

export function useUpdateCustomerInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCustomerInvoiceData }) =>
      updateCustomerInvoice(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_INVOICES_KEY] });
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_INVOICES_KEY, id] });
    },
  });
}

export function useDeleteCustomerInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCustomerInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_INVOICES_KEY] });
    },
  });
}

export function usePostCustomerInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postCustomerInvoice,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_INVOICES_KEY] });
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_INVOICES_KEY, id] });
    },
  });
}