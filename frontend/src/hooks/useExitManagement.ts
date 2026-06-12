// src/hooks/useExitManagement.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface ExitRecord {
  id: number;
  _id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  exit_date: string;
  last_working_day: string;
  reason: string;
  reason_value: string;
  notice_served: boolean;
  clearance_hr: boolean;
  clearance_it: boolean;
  clearance_finance: boolean;
  clearance_admin: boolean;
  clearance_status: string;
  clearance_status_value: string;
  clearance_progress: number;
  final_settlement: number;
  notes: string;
  status: string;
  status_value: string;
  created_at: string;
  updated_at: string;
}

export interface ExitStats {
  total_exits: number;
  active_exits: number;
  closed_exits: number;
  pending_clearance: number;
  in_progress_clearance: number;
  completed_clearance: number;
  avg_settlement: number;
  total_settlement: number;
  by_reason: Array<{ reason: string; count: number }>;
  by_department: Array<{ department: string; count: number }>;
  monthly_trend: Array<{ month: number; count: number }>;
  clearance_completion_rate: number;
  notice_compliance_rate: number;
}

// Fetch all exit records
export function useExitRecords(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  
  return useQuery<{ data: ExitRecord[]; pagination: any }>({
    queryKey: ["exitRecords", params],
    queryFn: () => api(`/api/hr/exits/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// Fetch exit statistics
export function useExitStats() {
  const api = useApi();
  return useQuery<ExitStats>({
    queryKey: ["exitStats"],
    queryFn: () => api("/api/hr/exits/stats/"),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// Create exit record
export function useCreateExitRecord() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) =>
      api("/api/hr/exits/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exitRecords"] });
      queryClient.invalidateQueries({ queryKey: ["exitStats"] });
    },
  });
}

// Update exit record
export function useUpdateExitRecord() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) =>
      api("/api/hr/exits/", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exitRecords"] });
      queryClient.invalidateQueries({ queryKey: ["exitStats"] });
    },
  });
}

// Delete exit record
export function useDeleteExitRecord() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api("/api/hr/exits/", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exitRecords"] });
      queryClient.invalidateQueries({ queryKey: ["exitStats"] });
    },
  });
}

// Bulk action
export function useBulkAction() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { action: string; ids: number[] }) =>
      api("/api/hr/exits/bulk-action/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exitRecords"] });
      queryClient.invalidateQueries({ queryKey: ["exitStats"] });
    },
  });
}