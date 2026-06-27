import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ============================================
// TYPES
// ============================================

export interface SupplierBillPayment {
  id: string;
  amount: string;
  payment_date: string;
  payment_method: string;
  reference_number: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  notes: string;
}

export interface SupplierBill {
  id: string;
  bill_number: string;
  supplier: string;
  supplier_name?: string;
  supplier_code?: string;
  supplier_contact_person?: string;
  supplier_email?: string;
  supplier_phone?: string;
  supplier_address?: string;
  supplier_city?: string;
  supplier_state?: string;
  supplier_country?: string;
  supplier_postal_code?: string;
  purchase_order: string | null;
  purchase_order_number?: string | null;
  purchase_order_status?: string | null;
  purchase_order_total?: number | null;
  bill_date: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  outstanding: number;
  status: "DRAFT" | "CANCELLED";
  payment_status?: "UNPAID" | "PARTIAL" | "PAID";
  journal_entry: string | null;
  notes: string;
  payments?: SupplierBillPayment[];
  created_at: string;
  updated_at: string;
  created_by?: number | string | null;
  updated_by?: number | string | null;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

type CreateSupplierBillData = Omit<SupplierBill, "id" | "created_at" | "updated_at" | "outstanding" | "paid_amount" | "status" | "journal_entry" | "supplier_code" | "supplier_contact_person" | "supplier_email" | "supplier_phone" | "supplier_address" | "supplier_city" | "supplier_state" | "supplier_country" | "supplier_postal_code" | "purchase_order_number" | "purchase_order_status" | "purchase_order_total" | "payments">;
type UpdateSupplierBillData = Partial<CreateSupplierBillData>;

// ============================================
// API FUNCTIONS
// ============================================

const SUPPLIER_BILLS_KEY = "finance_supplier_bills";

async function getAllSupplierBills(params?: { search?: string; status?: string; supplier?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append("search", params.search);
  if (params?.status) searchParams.append("status", params.status);
  if (params?.supplier) searchParams.append("supplier", String(params.supplier));
  if (params?.page) searchParams.append("page", String(params.page));
  const url = `/api/finance/supplier-bills/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<SupplierBill>>(url);
}

async function getSupplierBillById(id: string) {
  return apiFetch<SupplierBill>(`/api/finance/supplier-bills/${id}/`);
}

async function createSupplierBill(data: CreateSupplierBillData) {
  return apiFetch<SupplierBill>("/api/finance/supplier-bills/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateSupplierBill(id: string, data: UpdateSupplierBillData) {
  return apiFetch<SupplierBill>(`/api/finance/supplier-bills/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteSupplierBill(id: string) {
  return apiFetch<void>(`/api/finance/supplier-bills/${id}/`, { method: "DELETE" });
}

async function paySupplierBill(id: string, body?: Record<string, unknown>) {
  return apiFetch<SupplierBill>(`/api/finance/supplier-bills/${id}/record_payment/`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

async function postSupplierBill(id: string) {
  return apiFetch<SupplierBill>(`/api/finance/supplier-bills/${id}/post_bill/`, { method: "POST" });
}

// ============================================
// REACT HOOKS
// ============================================

export function useSupplierBills(filters?: { search?: string; status?: string; supplier?: string; page?: number }) {
  const query = useQuery({
    queryKey: [SUPPLIER_BILLS_KEY, filters],
    queryFn: () => getAllSupplierBills(filters),
    staleTime: 30_000,
  });
  return { ...query, data: query.data?.results ?? [], totalCount: query.data?.count ?? 0 };
}

export function useSupplierBill(id: string | null) {
  return useQuery({
    queryKey: [SUPPLIER_BILLS_KEY, id],
    queryFn: () => getSupplierBillById(id!),
    enabled: !!id,
  });
}

export function useCreateSupplierBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSupplierBill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIER_BILLS_KEY] });
    },
  });
}

export function useUpdateSupplierBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierBillData }) =>
      updateSupplierBill(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIER_BILLS_KEY] });
      queryClient.invalidateQueries({ queryKey: [SUPPLIER_BILLS_KEY, id] });
    },
  });
}

export function useDeleteSupplierBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSupplierBill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIER_BILLS_KEY] });
    },
  });
}

export function usePaySupplierBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      paySupplierBill(id, body),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIER_BILLS_KEY] });
      queryClient.invalidateQueries({ queryKey: [SUPPLIER_BILLS_KEY, id] });
    },
  });
}

export function usePostSupplierBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postSupplierBill,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIER_BILLS_KEY] });
      queryClient.invalidateQueries({ queryKey: [SUPPLIER_BILLS_KEY, id] });
    },
  });
}
