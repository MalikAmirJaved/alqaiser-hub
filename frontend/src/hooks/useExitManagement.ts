// src/hooks/useExitManagement.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface ExitRecord {
  id: string;
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
  final_settlement_status: string;
  notes: string;
  status: string;
  status_value: string;
  created_at: string;
  updated_at: string;
}

export interface ExitChecklistItem {
  id: string;
  exit_record_id: string;
  item_type: string;
  item_name: string;
  description: string;
  status: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  completed_at: string | null;
  notes: string;
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

export interface FinalSettlementPreview {
  employee_id: string;
  employee_name: string;
  joining_date: string;
  last_working_day: string;
  period_start: string;
  period_end: string;
  prev_month_paid: boolean;
  total_calendar_days: number;
  non_working_days: number;
  total_working_days: number;
  days_in_month: number;
  daily_rate: string;
  base_salary: string;
  settlement_salary: string;
  compensation: string;
  loan_deduction: string;
  leave_deduction: string;
  net_settlement: string;
  net_salary: string;
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

// Fetch single exit record
export function useExitRecord(id: string | null) {
  const api = useApi();
  return useQuery<ExitRecord>({
    queryKey: ["exitRecord", id],
    queryFn: () => api(`/api/hr/exits/?search=${id}`),
    enabled: !!id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    select: (data: any) => {
      const records = data?.data || [];
      return records.find((r: ExitRecord) => r.id === id) || records[0];
    },
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

// Calculate final settlement for an employee
export function useFinalSettlementPreview() {
  const api = useApi();
  return useMutation<FinalSettlementPreview, Error, { employee_id: string; last_working_day?: string }>({
    mutationFn: (data) =>
      api("/api/hr/exits/final-settlement/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
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
    mutationFn: (id: string) =>
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
    mutationFn: (data: { action: string; ids: string[] }) =>
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
