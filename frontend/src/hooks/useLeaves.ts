// src/hooks/useLeaves.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export type CreateLeaveRequestData = {
  employee_id: number;
  leave_type_id: number;
  leave_year: number;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day: "false" | "true";
  reason: string;
  contact_number?: string;
  document_url?: string;
};


export interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  leave_type_id: number;
  leave_type_name: string;
  leave_year: number;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day: "false" | "true";
  reason: string;
  contact_number?: string;
  document_url?: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  applied_at: string;
  approval_date?: string;
  rejection_reason?: string;
  approved_by?: string;
  created_by?: number;
}

export interface LeaveBalance {
  id: number;
  employee_id: number;
  employee_name: string;
  leave_type_id: number;
  leave_type_name: string;
  year: number;
  allocated: number;
  used: number;
  available: number;
  carry_forward_from: number;
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
    leave_type_name: string;
    total_days: number;
    request_count: number;
  }>;
  monthly_trends: Array<{
    month: number;
    total_days: number;
    request_count: number;
  }>;
}

export interface LeaveType {
  id: number;
  name: string;
  code: string;
  description?: string;
  isPaid: boolean;
  defaultDaysPerYear: number;
  maxCarryForwardDays: number;
  minDaysPerRequest: number;
  maxDaysPerRequest: number;
  requiresApproval: boolean;
  requiresDocument: boolean;
  applicableAfterMonths: number;
  isActive: boolean;
  genderSpecific: 'ALL' | 'MALE' | 'FEMALE';
  colorCode: string;
  order: number;
}

// Fetch leaves
export function useLeaves(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  
  return useQuery<LeaveRequest[]>({
    queryKey: ["leaves", params],
    queryFn: () => api(`/api/hr/leaves/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// Fetch leave balances
export function useLeaveBalances(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  
  return useQuery<LeaveBalance[]>({
    queryKey: ["leaveBalances", params],
    queryFn: () => api(`/api/hr/leaves/balances/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
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

// Fetch leave types (from company settings)
export function useLeaveTypes() {
  const api = useApi();
  
  return useQuery<LeaveType[]>({
    queryKey: ["leaveTypes"],
    queryFn: () => api("/api/company/settings/leave-types/"),
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
      queryClient.invalidateQueries({ queryKey: ["leaveBalances"] });
    },
  });
}


// Update leave request
export function useUpdateLeaveRequest() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<LeaveRequest> & { id: number }) =>
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

// Approve/reject leave
export function useApproveLeave() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action, rejection_reason }: { id: number; action: "APPROVED" | "REJECTED"; rejection_reason?: string }) =>
      api("/api/hr/leaves/approve/", {
        method: "POST",
        body: JSON.stringify({ id, action, rejection_reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaveStats"] });
      queryClient.invalidateQueries({ queryKey: ["leaveBalances"] });
    },
  });
}

// Get leave history for employee
export function useLeaveHistory(employeeId: number) {
  const api = useApi();
  
  return useQuery({
    queryKey: ["leaveHistory", employeeId],
    queryFn: () => api(`/api/hr/leaves/history/?employee_id=${employeeId}`),
    enabled: !!employeeId,
    staleTime: 30 * 1000,
  });
}