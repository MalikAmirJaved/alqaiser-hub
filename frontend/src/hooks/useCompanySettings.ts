// hooks/useCompanySettings.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface WorkingDay {
  day: string;
  label: string;
  isWorking: boolean;
  startTime: string | null;
  endTime: string | null;
  order: number;
}

export interface LeaveType {
  id: number;
  name: string;
  code: string;
  description?: string;
  isPaid: boolean;
  defaultDaysPerYear: number;
  maxCarryForwardDays: number;
  requiresApproval: boolean;
  isActive: boolean;
  order: number;
}

export interface PublicHoliday {
  id: number;
  name: string;
  date: string;
  isRecurringYearly: boolean;
  description?: string;
}

export interface CompanySettings {
  companyId: number;
  companyName: string;
  companyShortName: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  taxId: string;
  currency: string;
  taxRate: string;
  timezone: string;
  leaveYearType: string;
  fiscalYearStart: number;
  leaveDuringProbation: boolean;
  allowCarryForward: boolean;
  isSetupCompleted: boolean;
  workingDays: WorkingDay[];
  leaveTypes: LeaveType[];
  publicHolidays: PublicHoliday[];
}

// ------ Queries ------
export function useCompanySettingsQuery() {
  const api = useApi();
  return useQuery({
    queryKey: ["companySettings"],
    queryFn: () => api<CompanySettings>("/api/company/settings/"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ------ Mutations ------
export function useUpdateCompanySettings() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (updates: Partial<CompanySettings>) =>
      api("/api/company/settings/", {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

export function useUpdateWorkingDays() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (workingDays: WorkingDay[]) =>
      api("/api/company/settings/working-days/", {
        method: "PATCH",
        body: JSON.stringify({ workingDays }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

export function useCreateLeaveType() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (leaveType: Omit<LeaveType, 'id'>) =>
      api("/api/company/settings/leave-types/", {
        method: "POST",
        body: JSON.stringify(leaveType),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

export function useUpdateLeaveType() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (leaveType: Partial<LeaveType> & { id: number }) =>
      api("/api/company/settings/leave-types/", {
        method: "PATCH",
        body: JSON.stringify(leaveType),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

export function useAddPublicHoliday() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (holiday: Omit<PublicHoliday, 'id'>) =>
      api("/api/company/settings/public-holidays/", {
        method: "POST",
        body: JSON.stringify(holiday),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

export function useDeletePublicHoliday() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (holidayId: number) =>
      api(`/api/company/settings/public-holidays/${holidayId}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

// ------ Convenience Hook ------
export function useCompanySettings() {
  const { data: settings, isLoading, error } = useCompanySettingsQuery();
  const updateSettings = useUpdateCompanySettings();
  const updateWorkingDays = useUpdateWorkingDays();
  const createLeaveType = useCreateLeaveType();
  const updateLeaveType = useUpdateLeaveType();
  const addPublicHoliday = useAddPublicHoliday();
  const deletePublicHoliday = useDeletePublicHoliday();

  const formatCurrency = (amount: number, decimals = 2) => {
    const currency = settings?.currency || "USD";
    return `${currency} ${amount.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  };

  return {
    settings,
    isReady: !isLoading && !error,
    updateSettings: updateSettings.mutate,
    updateWorkingDays: updateWorkingDays.mutate,
    createLeaveType: createLeaveType.mutate,
    updateLeaveType: updateLeaveType.mutate,
    addPublicHoliday: addPublicHoliday.mutate,
    deletePublicHoliday: deletePublicHoliday.mutate,
    formatCurrency,
  };
}