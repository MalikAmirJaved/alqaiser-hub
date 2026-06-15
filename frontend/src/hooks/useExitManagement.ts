// src/hooks/useExitManagement.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface ExitRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  exit_date: string;
  last_working_day: string;
  reason: string;
  reason_value: string;
  notice_served: boolean;
  final_settlement: number;
  settlement_notes: string | null;
  notes: string;
  status: string;
  status_value: string;
  created_at: string;
  updated_at: string;
}

export interface ExitEmployeeAsset {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_brand: string | null;
  asset_serial: string | null;
  quantity: number;
  assigned_date: string;
  condition_on_assignment: string;
  notes: string | null;
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
  pending_exits: number;
  confirmed_exits: number;
  rejected_exits: number;
  by_reason: Array<{ reason: string; count: number }>;
  monthly_trend: Array<{ month: number; count: number }>;
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
  original_base_salary: string;
  base_salary: string;
  settlement_salary: string;
  compensation: string;
  loan_deduction: string;
  leave_deduction: string;
  advance_deduction: string;
  net_settlement: string;
  net_salary: string;
  net_settlement_raw: string;
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

// Fetch assets allocated to the employee of an exit record
export function useExitEmployeeAssets(exitId: string | null) {
  const api = useApi();
  return useQuery<ExitEmployeeAsset[]>({
    queryKey: ["exitEmployeeAssets", exitId],
    queryFn: () => api(`/api/hr/exits/${exitId}/assets/`),
    enabled: !!exitId,
    staleTime: 10 * 1000,
  });
}

// Return a single asset from an exit record
export function useReturnExitAsset() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ exitId, ...data }: { exitId: string; assignment_id: string; condition_on_return?: string; return_notes?: string; returned_date?: string }) =>
      api(`/api/hr/exits/${exitId}/return-asset/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exitEmployeeAssets"] });
      queryClient.invalidateQueries({ queryKey: ["exitRecords"] });
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
