// src/hooks/sales/useQuotes.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface QuoteLine {
  id?: string;
  variant: string;
  variant_sku?: string;
  variant_name?: string;
  is_manual_entry?: boolean;
  manual_variant_name?: string;
  manual_variant_sku?: string;
  description?: string;
  vendor?: string;
  vendor_name?: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_amount: number;
  subtotal?: number;
  line_total?: number;
}

export interface Quote {
  id: string;
  quote_number: string;
  lead: string | null;
  customer: string | null;
  customer_name?: string;
  date: string;
  expiration_date: string | null;
  total_amount: number | string;
  overall_discount_percent?: number | string;
  overall_tax_percent?: number | string;
  status: "DRAFT" | "SENT" | "VIEWED" | "APPROVED" | "REJECTED" | "CONVERTED";
  notes: string;
  lines: QuoteLine[];
  created_at?: string;
  updated_at?: string;
  created_by_name?: string;
  updated_by_name?: string;
  converted_invoice?: string | null;
  converted_invoice_number?: string | null;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useQuotes(filters?: { status?: string; search?: string; page?: string }) {
  const api = useApi();
  const searchParams = new URLSearchParams();
  if (filters?.status) searchParams.append("status", filters.status);
  if (filters?.search) searchParams.append("search", filters.search);
  if (filters?.page) searchParams.append("page", filters.page);
  const url = `/api/sales/quotes/${searchParams.toString() ? `?${searchParams}` : ""}`;

  const query = useQuery<PaginatedResponse<Quote>>({
    queryKey: ["sales_quotes", filters],
    queryFn: () => api<PaginatedResponse<Quote>>(url),
    staleTime: 30_000,
  });

  return {
    ...query,
    data: query.data?.results ?? [],
    totalCount: query.data?.count ?? 0,
  };
}

export function useQuote(id: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["sales_quote", id],
    queryFn: () => api<Quote>(`/api/sales/quotes/${id}/`),
    enabled: !!id,
  });
}

export function useCreateQuote() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      api<Quote>("/api/sales/quotes/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_quotes"] });
    },
  });
}

export function useUpdateQuote() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Quote> }) =>
      api<Quote>(`/api/sales/quotes/${id}/`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["sales_quotes"] });
      queryClient.invalidateQueries({ queryKey: ["sales_quote", id] });
    },
  });
}

export function useDeleteQuote() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/api/sales/quotes/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_quotes"] });
    },
  });
}

export function useSendQuote() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ status: string; message: string }>(
        `/api/sales/quotes/${id}/send/`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_quotes"] });
    },
  });
}

export function useMarkViewedQuote() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ status: string; message: string }>(
        `/api/sales/quotes/${id}/mark_viewed/`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_quotes"] });
    },
  });
}

export function useApproveQuote() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ status: string; message: string }>(
        `/api/sales/quotes/${id}/approve/`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_quotes"] });
    },
  });
}

export function useRejectQuote() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ status: string; message: string }>(
        `/api/sales/quotes/${id}/reject/`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_quotes"] });
    },
  });
}

export function useMarkConvertedQuote() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, invoiceId }: { quoteId: string; invoiceId: string }) =>
      api<{ status: string; message: string }>(
        `/api/sales/quotes/${quoteId}/mark_converted/`,
        { method: "POST", body: JSON.stringify({ invoice_id: invoiceId }) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_quotes"] });
    },
  });
}

export function useRevertQuoteStatus() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ status: string; message: string }>(`/api/sales/quotes/${id}/revert_status/`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_quotes"] });
    },
  });
}

export interface StatusHistoryEntry {
  id: string;
  entity_type: "LEAD" | "QUOTE";
  entity_id: string;
  from_status: string;
  to_status: string;
  notes: string;
  changed_by: number | null;
  changed_by_name: string | null;
  created_at: string;
}

export function useQuoteStatusHistory(id: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["sales_quote_status_history", id],
    queryFn: () => api<StatusHistoryEntry[]>(`/api/sales/quotes/${id}/status_history/`),
    enabled: !!id,
  });
}