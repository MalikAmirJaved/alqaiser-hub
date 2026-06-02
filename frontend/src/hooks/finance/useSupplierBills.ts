import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ============================================
// TYPES
// ============================================

export interface SupplierBill {
  id: number;
  _id: string;
  bill_number: string;
  supplier: number;
  supplier_name?: string; // from serializer
  purchase_order: number | null;
  bill_date: string;
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

type CreateSupplierBillData = Omit<SupplierBill, "id" | "_id" | "created_at" | "updated_at" | "outstanding" | "paid_amount" | "status" | "journal_entry">;
type UpdateSupplierBillData = Partial<CreateSupplierBillData>;

// ============================================
// API FUNCTIONS
// ============================================

const SUPPLIER_BILLS_KEY = "finance_supplier_bills";

async function getAllSupplierBills(params?: { status?: string; supplier?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append("status", params.status);
  if (params?.supplier) searchParams.append("supplier", String(params.supplier));
  const url = `/api/finance/supplier-bills/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<SupplierBill>>(url);
}

async function getSupplierBillById(id: number) {
  return apiFetch<SupplierBill>(`/api/finance/supplier-bills/${id}/`);
}

async function createSupplierBill(data: CreateSupplierBillData) {
  return apiFetch<SupplierBill>("/api/finance/supplier-bills/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateSupplierBill(id: number, data: UpdateSupplierBillData) {
  return apiFetch<SupplierBill>(`/api/finance/supplier-bills/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteSupplierBill(id: number) {
  return apiFetch<void>(`/api/finance/supplier-bills/${id}/`, { method: "DELETE" });
}

async function postSupplierBill(id: number) {
  return apiFetch<SupplierBill>(`/api/finance/supplier-bills/${id}/post_bill/`, { method: "POST" });
}

// ============================================
// REACT HOOKS
// ============================================

export function useSupplierBills(filters?: { status?: string; supplier?: number }) {
  return useQuery({
    queryKey: [SUPPLIER_BILLS_KEY, filters],
    queryFn: () => getAllSupplierBills(filters),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}

export function useSupplierBill(id: number | null) {
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
    mutationFn: ({ id, data }: { id: number; data: UpdateSupplierBillData }) =>
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