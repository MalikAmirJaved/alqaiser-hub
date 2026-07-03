// src/hooks/useSuppliers.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Supplier extends Record<string, unknown> {
  id: string;
  name: string;
  code: string;
  contact_person: string;
  email: string;
  phone: string;
  address_line: string;
  country: string;
  state: string;
  city: string;
  postal_code: string;
  status: "active" | "inactive" | "suspended";
  balance: string;
  credit: string;
  created_at: string;
  updated_at: string;
  partner_type?: string;
}

export interface SupplierHistory {
  id: string;
  supplier: string;
  supplier_name: string;
  supplier_code: string;
  transaction_type: "PURCHASE" | "PAYMENT" | "CREDIT_NOTE" | "INVOICE_ADJUSTMENT" | "CREDIT_APPLIED";
  amount: string;
  balance_after: string;
  credit_after: string;
  reference_type: string;
  reference_id: string;
  notes: string;
  created_at: string;
}
export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

// Fetch all suppliers
export function useSuppliers(filters?: Record<string, string>) {
  const api = useApi();
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, val]) => {
      if (val) params.append(key, val);
    });
  }
  const url = `/api/inventory/suppliers/${params.toString() ? `?${params}` : ""}`;

  const query = useQuery<PaginatedResponse<Supplier>>({
    queryKey: ["inventory_supplier", filters],
    queryFn: () => api<PaginatedResponse<Supplier>>(url),
  });

  return {
    ...query,
    data: query.data?.results ?? [],
    totalCount: query.data?.count ?? 0,
  };
}

// Create supplier
export function useCreateSupplier() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Supplier, "id" | "created_at" | "updated_at">) =>
      api("/api/inventory/suppliers/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_supplier"] });
    },
  });
}

// Update supplier
export function useUpdateSupplier() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Supplier> & { id: string }) =>
      api(`/api/inventory/suppliers/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_supplier"] });
    },
  });
}

// Delete supplier
export function useDeleteSupplier() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/inventory/suppliers/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_supplier"] });
    },
  });
}

export function useSupplier(id: string | null) {
  const api = useApi();
  return useQuery<Supplier>({
    queryKey: ["supplier", id],
    queryFn: () => api(`/api/inventory/suppliers/${id}/`),
    enabled: !!id,
  });
}

export function useSupplierHistory(supplierId: string | null) {
  const api = useApi();
  return useQuery<PaginatedResponse<SupplierHistory>>({
    queryKey: ["supplier_history", supplierId],
    queryFn: () => api(`/api/inventory/supplier-history/?supplier=${supplierId}`),
    enabled: !!supplierId,
  });
}

export interface SupplierDetailData {
  supplier: Supplier;
  summary: {
    total_purchase_orders: number;
    total_po_amount: string;
    total_bills: number;
    total_bill_amount: string;
    total_paid: string;
    total_outstanding: string;
    balance: string;
    credit: string;
  };
  purchase_orders: Array<Record<string, unknown>>;
  bills: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  quote_lines: Array<{
    id: string;
    quote_number: string;
    quote_status: string;
    item: string;
    quantity: number;
    unit_price: string;
    line_total: string;
    created_at: string;
  }>;
  invoice_lines: Array<{
    id: string;
    invoice_number: string;
    invoice_status: string;
    item: string;
    quantity: number;
    unit_price: string;
    line_total: string;
    created_at: string;
  }>;
  history: SupplierHistory[];
  audit_logs: Array<{
    id: string;
    user_id: number;
    user_name: string;
    user_email: string;
    action: string;
    action_display: string;
    entity_type: string;
    entity_id: string;
    entity_name: string;
    field_changes: Array<{
      id: number;
      field_name: string;
      old_value: string | null;
      new_value: string | null;
      created_at: string;
    }>;
    created_at: string;
  }>;
}

export function useSupplierDetail(id: string | null) {
  const api = useApi();
  return useQuery<SupplierDetailData>({
    queryKey: ["supplier_detail", id],
    queryFn: () => api(`/api/inventory/suppliers/${id}/detail/`),
    enabled: !!id,
    staleTime: 0,
  });
}