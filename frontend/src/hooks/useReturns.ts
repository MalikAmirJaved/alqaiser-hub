"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ReturnRefundLine {
  _id: string;
  source_line_id: string;
  variant?: string | null;
  variant_name?: string | null;
  variant_sku?: string | null;
  is_manual_entry: boolean;
  manual_variant_name: string;
  manual_variant_sku: string;
  vendor?: string | null;
  vendor_name?: string | null;
  quantity: number;
  unit_price: number;
  refund_amount: number;
  tax_rate: number;
  restock: boolean;
  return_to_supplier: boolean;
  disposition_action?: "GO_TO_PRODUCT" | "RETURN_TO_SUPPLIER";
  product_qty?: number;
  damage_qty?: number;
  damage_reason?: string;
  reason: string;
}

export interface ReturnRefund {
  _id: string;
  return_number: string;
  return_type: "INVOICE" | "POS";
  return_type_display: string;
  document_id: string;
  document_number: string;
  customer?: string | null;
  customer_name?: string | null;
  warehouse?: string;
  warehouse_name?: string;
  return_date: string;
  status: "DRAFT" | "COMPLETED" | "CANCELLED";
  status_display: string;
  total_refund_amount: number;
  reason: string;
  refund_payment_id?: string | null;
  completed_at?: string | null;
  completed_by?: number | null;
  completed_by_name?: string | null;
  lines?: ReturnRefundLine[];
  lines_count?: number;
  created_at: string;
  updated_at: string;
  created_by?: number | null;
  created_by_name?: string | null;
  updated_by?: number | null;
  updated_by_name?: string | null;
  company_id?: number | null;
  branch_id?: number | null;
}

export interface LookupDocumentLine {
  source_line_id: string;
  variant_id: string | null;
  variant_sku: string;
  product_name: string;
  unit_price: number;
  max_returnable: number;
  is_manual_entry: boolean;
  manual_variant_name: string;
  manual_variant_sku: string;
  vendor_id: string | null;
  vendor_name: string | null;
  tax_rate: number;
  discount_amount: number;
}

export interface LookupDocumentResult {
  document: {
    document_id: string;
    document_number: string;
    return_type: string;
    customer: {
      id: string;
      name: string;
    } | null;
  };
  lines: LookupDocumentLine[];
}

export function useReturns(params?: {
  status?: string;
  return_type?: string;
  search?: string;
}) {
  const api = useApi();
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append("status", params.status);
  if (params?.return_type) searchParams.append("return_type", params.return_type);
  if (params?.search) searchParams.append("search", params.search);
  const qs = searchParams.toString() ? `?${searchParams}` : "";

  return useQuery<PaginatedResponse<ReturnRefund>, Error, ReturnRefund[]>({
    queryKey: ["returns", params],
    queryFn: () => api(`/api/inventory/returns/${qs}`),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}

export function useReturnDetail(id: string) {
  const api = useApi();
  return useQuery<ReturnRefund>({
    queryKey: ["return", id],
    queryFn: () => api(`/api/inventory/returns/${id}/`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useLookupDocument() {
  const api = useApi();
  return useMutation({
    mutationFn: (data: { return_type: string; document_number: string }) =>
      api<{ status: string; data: LookupDocumentResult }>("/api/inventory/returns/lookup_document/", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
  });
}

export function useCancelReturn() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api<{ status: string; message: string }>(`/api/inventory/returns/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: "CANCELLED" }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
    },
  });
}

export function useCreateReturn() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      return_type: string;
      document_id: string;
      warehouse_id: string;
      return_date?: string;
      reason?: string;
      lines: Array<{
        source_line_id: string;
        quantity: number;
        unit_price: number;
        refund_amount: number;
        is_manual_entry?: boolean;
        manual_variant_name?: string;
        manual_variant_sku?: string;
        vendor?: string | null;
        restock: boolean;
        return_to_supplier: boolean;
        disposition_action?: "GO_TO_PRODUCT" | "RETURN_TO_SUPPLIER";
        product_qty?: number;
        damage_qty?: number;
        damage_reason?: string;
        reason?: string;
      }>;
    }) =>
      api<{ status: string; message: string; data: ReturnRefund }>("/api/inventory/returns/", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["customer-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-analytics"] });
    },
  });
}
