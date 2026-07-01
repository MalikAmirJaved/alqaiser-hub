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
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "FOLLOW_UP" | "CONVERTED" | "LOST";
  source: string;
  notes: string;
  address_line: string;
  country: string;
  state: string;
  city: string;
  score: number | null;
  follow_up_date: string | null;
  follow_up_notes: string;
  lost_reason: string;
  converted_customer_id?: string | null;
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

export function useLeads(filters?: { status?: string; search?: string; page?: string }) {
  const api = useApi();
  const searchParams = new URLSearchParams();
  if (filters?.status) searchParams.append("status", filters.status);
  if (filters?.search) searchParams.append("search", filters.search);
  if (filters?.page) searchParams.append("page", filters.page);
  const url = `/api/sales/leads/${searchParams.toString() ? `?${searchParams}` : ""}`;

  const query = useQuery<PaginatedResponse<Lead>>({
    queryKey: ["sales_leads", filters],
    queryFn: () => api<PaginatedResponse<Lead>>(url),
    staleTime: 30_000,
  });

  return {
    ...query,
    data: query.data?.results ?? [],
    totalCount: query.data?.count ?? 0,
  };
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

// ── Workflow mutations ──

export function useContactLead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ status: string; message: string }>(`/api/sales/leads/${id}/contact/`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_leads"] });
    },
  });
}

export function useScheduleFollowUp() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, follow_up_date, follow_up_notes }: { id: string; follow_up_date?: string; follow_up_notes?: string }) =>
      api<{ status: string; message: string }>(`/api/sales/leads/${id}/schedule_follow_up/`, {
        method: "POST",
        body: JSON.stringify({ follow_up_date, follow_up_notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_leads"] });
    },
  });
}

export function useQualifyLead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ status: string; message: string }>(`/api/sales/leads/${id}/qualify/`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_leads"] });
    },
  });
}

export function useConvertLeadToCustomer() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ status: string; message: string; customer_id: string }>(`/api/sales/leads/${id}/convert_to_customer/`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_leads"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useMarkLost() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lost_reason }: { id: string; lost_reason: string }) =>
      api<{ status: string; message: string }>(`/api/sales/leads/${id}/mark_lost/`, {
        method: "POST",
        body: JSON.stringify({ lost_reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_leads"] });
    },
  });
}

export function useRevertLeadStatus() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ status: string; message: string }>(`/api/sales/leads/${id}/revert_status/`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_leads"] });
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

export function useLeadStatusHistory(id: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["sales_lead_status_history", id],
    queryFn: () => api<StatusHistoryEntry[]>(`/api/sales/leads/${id}/status_history/`),
    enabled: !!id,
  });
}
