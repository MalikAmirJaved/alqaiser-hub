"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface WorkingDay {
  id: number;
  day: number;
  label: string;
  isWorking: boolean;
  startTime: string | null;
  endTime: string | null;
  isHalfDay: boolean;
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
  isActive: boolean;
  applicableAfterMonths: number;
  genderSpecific: 'ALL' | 'MALE' | 'FEMALE';
  colorCode: string;
  order: number;
}

export interface PublicHoliday {
  id: number;
  name: string;
  date: string;
  endDate?: string;
  isRecurringYearly: boolean;
  isHalfDay: boolean;
  description?: string;
  holidayType: 'NATIONAL' | 'RELIGIOUS' | 'COMPANY' | 'REGIONAL';
}

export interface CompanySettings {
  // Company Details
  companyId: number;
  companyName: string;
  companyShortName: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  
  designations: Designation[];

  // Financial
  currency: string;
  taxRate: number;
  taxId: string;
  
  // Time
  timezone: string;
  
  // Working Hours
  defaultStartTime: string;
  defaultEndTime: string;
  workingHoursPerDay: string;
  
  // Leave Policies
  leaveDuringProbation: boolean;
  allowCarryForward: boolean;
  maxCarryForwardDays: number;
  
  // Status
  isSetupCompleted: boolean;
  
  // Relations
  workingDays: WorkingDay[];
  leaveTypes: LeaveType[];
  publicHolidays: PublicHoliday[];
}

export interface Designation {
  id: number;
  _id?: string;
  name: string;
  department?: string;
  payGrade?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ------ Query ------
export function useCompanySettingsQuery() {
  const api = useApi();
  return useQuery<CompanySettings>({
    queryKey: ["companySettings"],
    queryFn: () => api("/api/company/settings/"),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
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
    mutationFn: (workingDays: Partial<WorkingDay>[]) =>
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

export function useDeleteLeaveType() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) =>
      api("/api/company/settings/leave-types/", {
        method: "DELETE",
        body: JSON.stringify({ id }),
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
    mutationFn: (holidays: Omit<PublicHoliday, 'id'>[]) =>
      api("/api/company/settings/public-holidays/", {
        method: "POST",
        body: JSON.stringify(holidays),
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
  const mutations = {
    updateSettings: useUpdateCompanySettings(),
    updateWorkingDays: useUpdateWorkingDays(),
    createLeaveType: useCreateLeaveType(),
    updateLeaveType: useUpdateLeaveType(),
    deleteLeaveType: useDeleteLeaveType(),
    addPublicHoliday: useAddPublicHoliday(),
    deletePublicHoliday: useDeletePublicHoliday(),
    createDesignation: useCreateDesignation(),
    updateDesignation: useUpdateDesignation(),
    deleteDesignation: useDeleteDesignation(),
  };

  const formatCurrency = (amount: number, decimals = 2) => {
    const currency = settings?.currency || "USD";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
    }).format(amount);
  };
  
  return {
    settings: settings as CompanySettings | undefined,
    isLoading,
    isReady: !isLoading && !error,
    error,
    formatCurrency,
    
    // Mutations
    updateSettings: mutations.updateSettings.mutate,
    updateWorkingDays: mutations.updateWorkingDays.mutate,
    createLeaveType: mutations.createLeaveType.mutate,
    updateLeaveType: mutations.updateLeaveType.mutate,
    deleteLeaveType: mutations.deleteLeaveType.mutate,
    addPublicHoliday: mutations.addPublicHoliday.mutate,
    deletePublicHoliday: mutations.deletePublicHoliday.mutate,
    createDesignation: mutations.createDesignation.mutate,
updateDesignation: mutations.updateDesignation.mutate,
deleteDesignation: mutations.deleteDesignation.mutate,


    // Loading states
    isUpdating: mutations.updateSettings.isPending,
    isUpdatingWorkingDays: mutations.updateWorkingDays.isPending,
    isCreatingLeaveType: mutations.createLeaveType.isPending,
    isDeletingHoliday: mutations.deletePublicHoliday.isPending,
    isCreatingDesignation: mutations.createDesignation.isPending,
isUpdatingDesignation: mutations.updateDesignation.isPending,
isDeletingDesignation: mutations.deleteDesignation.isPending,
  };
}

export function useSetupDesignations() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (designations: Omit<Designation, "id">[]) =>
      api("/api/company/settings/designations/setup/", {
        method: "POST",
        body: JSON.stringify({ designations }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

export function useCreateDesignation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (designation: Omit<Designation, "id">) =>
      api("/api/company/settings/designations/", {
        method: "POST",
        body: JSON.stringify(designation),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

export function useUpdateDesignation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (designation: Partial<Designation> & { id: number }) =>
      api("/api/company/settings/designations/", {
        method: "PATCH",
        body: JSON.stringify(designation),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

export function useDeleteDesignation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api("/api/company/settings/designations/", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

