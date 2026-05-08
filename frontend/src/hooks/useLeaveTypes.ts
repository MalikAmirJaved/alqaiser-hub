// src/hooks/useLeaveTypes.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

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
  createdAt?: string;
  updatedAt?: string;
}

// Fetch all leave types
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

// Create leave type
export function useCreateLeaveTypeMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leaveType: Omit<LeaveType, "id" | "createdAt" | "updatedAt">) =>
      api("/api/company/settings/leave-types/", {
        method: "POST",
        body: JSON.stringify(leaveType),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveTypes"] });
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

// Update leave type
export function useUpdateLeaveTypeMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leaveType: Partial<LeaveType> & { id: number }) =>
      api("/api/company/settings/leave-types/", {
        method: "PATCH",
        body: JSON.stringify(leaveType),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveTypes"] });
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

// Delete leave type
export function useDeleteLeaveTypeMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api("/api/company/settings/leave-types/", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveTypes"] });
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}