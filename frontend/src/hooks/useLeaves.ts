// src/hooks/useLeaves.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export type CreateLeaveRequestData = {
  employee_id: string;
  leave_type: string;
  leave_sub_type: 'SHORT' | 'HALF' | 'FULL_DAY';
  start_date: string;
  end_date?: string;
  is_half_day: boolean;
  reason: string;
  emergency_contact?: string;
};

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type: string;
  leave_type_display: string;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day: boolean;
  reason: string;
  emergency_contact?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  applied_at: string;
  approval_date?: string;
  rejection_reason?: string;
  approved_by_id?: string;
  approved_by_name?: string;
}

export interface LeaveStats {
  my_leaves: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
  };
  pending_approvals: number;
  leave_type_usage: Array<{
    leave_type: string;
    total_days: number;
    request_count: number;
  }>;
}

// Fixed leave types (no backend dependency)
export const LEAVE_TYPES = [
  { value: "CASUAL", label: "Casual Leave" },
  { value: "SICK", label: "Sick Leave" },
  { value: "ANNUAL", label: "Annual Leave" },
  { value: "MATERNITY", label: "Maternity Leave" },
  { value: "PATERNITY", label: "Paternity Leave" },
  { value: "BEREAVEMENT", label: "Bereavement Leave" },
  { value: "OTHER", label: "Other" },
];

interface PaginatedResponse<T> {
  count: number;
  total_pages: number;
  current_page: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Fetch leaves
export function useLeaves(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  const query = useQuery<PaginatedResponse<LeaveRequest>>({
    queryKey: ["leaves", params],
    queryFn: () => api(`/api/hr/leaves/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
  return {
    ...query,
    data: query.data?.results ?? [],
    totalCount: query.data?.count ?? 0,
    totalPages: query.data?.total_pages ?? 0,
    currentPage: query.data?.current_page ?? 1,
  };
}

// Fetch leave stats
export function useLeaveStats() {
  const api = useApi();
  
  return useQuery<LeaveStats>({
    queryKey: ["leaveStats"],
    queryFn: () => api("/api/hr/leaves/stats/"),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// Create leave request
export function useCreateLeaveRequest() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLeaveRequestData) =>
      api("/api/hr/leaves/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaveStats"] });
    },
  });
}

// Update leave request
export function useUpdateLeaveRequest() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<LeaveRequest> & { id: string }) =>
      api("/api/hr/leaves/", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaveStats"] });
    },
  });
}

// Delete leave request
export function useDeleteLeaveRequest() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api("/api/hr/leaves/", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaveStats"] });
    },
  });
}

// Approve/reject leave
export function useApproveLeave() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action, rejection_reason }: { id: string; action: "APPROVED" | "REJECTED"; rejection_reason?: string }) =>
      api("/api/hr/leaves/approve/", {
        method: "POST",
        body: JSON.stringify({ id, action, rejection_reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaveStats"] });
    },
  });
}