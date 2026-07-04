// src/hooks/sales/useSalesInvoices.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SalesInvoice {
  id: string;
  _id?: string;
  invoice_number: string;
  customer: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  sales_order: string | null;
  invoice_date: string;
  due_date: string;
  amount: number | string;
  paid_amount: number | string;
  outstanding: number | string;
  status: string;
  payment_status?: string;
  source?: string;
  notes: string;
  lines?: any[];
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  updated_by_name?: string;
}

/**
 * List sales invoices (SALES module only - excludes POS)
 */
export function useSalesInvoices(filters?: { search?: string; status?: string; customer?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  if (filters?.search) searchParams.append("search", filters.search);
  if (filters?.status) searchParams.append("status", filters.status);
  if (filters?.customer) searchParams.append("customer", String(filters.customer));
  if (filters?.page) searchParams.append("page", String(filters.page));
  const url = `/api/sales/invoices/${searchParams.toString() ? `?${searchParams}` : ""}`;

  const query = useQuery({
    queryKey: ["sales_invoices", filters],
    queryFn: () => apiFetch<PaginatedResponse<SalesInvoice>>(url),
    staleTime: 30_000,
  });
  return { ...query, data: query.data?.results ?? [], totalCount: query.data?.count ?? 0 };
}

/**
 * Get a single sales invoice by ID
 */
export function useSalesInvoice(id: string | null) {
  return useQuery({
    queryKey: ["sales_invoices", id],
    queryFn: () => apiFetch<SalesInvoice>(`/api/sales/invoices/${id}/`),
    enabled: !!id,
  });
}

/**
 * Create a sales invoice (SALES module)
 */
export function useCreateSalesInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiFetch("/api/sales/invoices/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["finance_customer_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sales_dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_variant"] });
    },
  });
}

/**
 * Update a sales invoice (SALES module)
 */
export function useUpdateSalesInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      apiFetch(`/api/sales/invoices/${id}/`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["sales_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sales_invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["finance_customer_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sales_dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_variant"] });
    },
  });
}
