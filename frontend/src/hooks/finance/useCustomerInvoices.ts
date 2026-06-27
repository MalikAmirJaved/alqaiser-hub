import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ============================================
// TYPES
// ============================================

export interface CustomerInvoiceLine {
  id: string;
  variant: string;
  variant_sku?: string;
  variant_name?: string;
  is_manual_entry?: boolean;
  manual_variant_name?: string;
  manual_variant_sku?: string;
  vendor?: string;
  vendor_name?: string;
  cost_price?: number;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_amount: number;
}

export interface CustomerInvoice {
  id: string;
  invoice_number: string;
  customer: string;
  customer_name?: string;
  sales_order: string | null;
  invoice_date: string;
  due_date: string;
  amount: number | string;
  paid_amount: number | string;
  outstanding: number | string;
  overall_discount_percent?: number | string;
  overall_tax_percent?: number | string;
  status: "DRAFT" | "CANCELLED";
  payment_status?: "UNPAID" | "PARTIAL" | "PAID";
  journal_entry: number | string | null;
  notes: string;
  source?: string;
  payment_method?: string;
  lines?: CustomerInvoiceLine[];
  created_at: string;
  updated_at: string;
  created_by?: number | string | null;
  created_by_name?: string;
  updated_by?: number | string | null;
  updated_by_name?: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

type CreateCustomerInvoiceData = Omit<CustomerInvoice, "id" | "_id" | "created_at" | "updated_at" | "outstanding" | "paid_amount" | "status" | "journal_entry"> & {
  new_customer?: any;
};
type UpdateCustomerInvoiceData = Partial<CreateCustomerInvoiceData>;

// ============================================
// API FUNCTIONS
// ============================================

const CUSTOMER_INVOICES_KEY = "finance_customer_invoices";

async function getAllCustomerInvoices(params?: { search?: string; status?: string; customer?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append("search", params.search);
  if (params?.status) searchParams.append("status", params.status);
  if (params?.customer) searchParams.append("customer", String(params.customer));
  if (params?.page) searchParams.append("page", String(params.page));
  const url = `/api/finance/customer-invoices/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<CustomerInvoice>>(url);
}

async function getCustomerInvoiceById(id: string) {
  return apiFetch<CustomerInvoice>(`/api/finance/customer-invoices/${id}/`);
}

async function createCustomerInvoice(data: CreateCustomerInvoiceData) {
  return apiFetch<CustomerInvoice>("/api/finance/customer-invoices/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateCustomerInvoice(id: string, data: UpdateCustomerInvoiceData) {
  return apiFetch<CustomerInvoice>(`/api/finance/customer-invoices/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteCustomerInvoice(id: string) {
  return apiFetch<void>(`/api/finance/customer-invoices/${id}/`, { method: "DELETE" });
}

async function payCustomerInvoice(id: string, body?: Record<string, unknown>) {
  return apiFetch<CustomerInvoice>(`/api/finance/customer-invoices/${id}/record_payment/`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

/** @deprecated Use payCustomerInvoice — kept for backward compatibility */
async function postCustomerInvoice(id: string) {
  return apiFetch<CustomerInvoice>(`/api/finance/customer-invoices/${id}/post_invoice/`, { method: "POST" });
}

// ============================================
// REACT HOOKS
// ============================================

export function useCustomerInvoices(filters?: { search?: string; status?: string; customer?: string; page?: number }) {
  const query = useQuery({
    queryKey: [CUSTOMER_INVOICES_KEY, filters],
    queryFn: () => getAllCustomerInvoices(filters),
    staleTime: 30_000,
  });
  return { ...query, data: query.data?.results ?? [], totalCount: query.data?.count ?? 0 };
}

export function useCustomerInvoice(id: string | null) {
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
      queryClient.invalidateQueries({ queryKey: ["inventory_variant"] });
    },
  });
}

export function useUpdateCustomerInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerInvoiceData }) =>
      updateCustomerInvoice(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_INVOICES_KEY] });
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_INVOICES_KEY, id] });
      queryClient.invalidateQueries({ queryKey: ["inventory_variant"] });
    },
  });
}

export function useDeleteCustomerInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCustomerInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_INVOICES_KEY] });
      queryClient.invalidateQueries({ queryKey: ["inventory_variant"] });
    },
  });
}

export function usePayCustomerInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      payCustomerInvoice(id, body),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_INVOICES_KEY] });
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_INVOICES_KEY, id] });
    },
  });
}

/** @deprecated Use usePayCustomerInvoice */
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