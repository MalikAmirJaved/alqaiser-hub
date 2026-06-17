// src/hooks/sales/useQuotes.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface QuoteLine {
  id?: string;
  variant: string;
  variant_sku?: string;
  variant_name?: string;
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
  status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "REJECTED";
  notes: string;
  lines: QuoteLine[];
  created_at?: string;
  updated_at?: string;
  created_by_name?: string;
  updated_by_name?: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useQuotes(filters?: { status?: string; search?: string }) {
  const api = useApi();
  const searchParams = new URLSearchParams();
  if (filters?.status) searchParams.append("status", filters.status);
  if (filters?.search) searchParams.append("search", filters.search);
  const url = `/api/sales/quotes/${searchParams.toString() ? `?${searchParams}` : ""}`;

  return useQuery({
    queryKey: ["sales_quotes", filters],
    queryFn: async () => {
      const resp = await api<PaginatedResponse<Quote>>(url);
      return resp.results;
    },
    staleTime: 30_000,
  });
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

export function useAcceptQuote() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ status: string; message: string; invoice_id: string }>(
        `/api/sales/quotes/${id}/accept/`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_quotes"] });
      queryClient.invalidateQueries({ queryKey: ["finance_customer_invoices"] });
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