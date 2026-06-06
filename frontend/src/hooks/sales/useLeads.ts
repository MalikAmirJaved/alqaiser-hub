// src/hooks/sales/useLeads.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Lead {
  id: string;
  title: string;
  first_name: string;
  last_name: string;
  company_name: string;
  email: string;
  phone: string;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "LOST" | "WON";
  source: string;
  notes: string;
  customer?: string;
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

export function useLeads(filters?: { status?: string }) {
  const api = useApi();
  const searchParams = new URLSearchParams();
  if (filters?.status) searchParams.append("status", filters.status);
  const url = `/api/sales/leads/${searchParams.toString() ? `?${searchParams}` : ""}`;

  return useQuery({
    queryKey: ["sales_leads", filters],
    queryFn: async () => {
      const resp = await api<PaginatedResponse<Lead>>(url);
      return resp.results;
    },
    staleTime: 30_000,
  });
}

export function useLead(id: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["sales_lead", id],
    queryFn: () => api<Lead>(`/api/sales/leads/${id}/`),
    enabled: !!id,
  });
}

export function useCreateLead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      api<Lead>("/api/sales/leads/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_leads"] });
    },
  });
}

export function useUpdateLead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Lead> }) =>
      api<Lead>(`/api/sales/leads/${id}/`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["sales_leads"] });
      queryClient.invalidateQueries({ queryKey: ["sales_lead", id] });
    },
  });
}

export function useDeleteLead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/api/sales/leads/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_leads"] });
    },
  });
}

export function useConvertLead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, createQuote }: { id: string; createQuote: boolean }) =>
      api<{ status: string; message: string; quote_id?: string }>(
        `/api/sales/leads/${id}/convert/`,
        {
          method: "POST",
          body: JSON.stringify({ create_quote: createQuote }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_leads"] });
      queryClient.invalidateQueries({ queryKey: ["sales_quotes"] });
    },
  });
}