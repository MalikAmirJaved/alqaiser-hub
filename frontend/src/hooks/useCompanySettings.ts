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
  state: string;
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
    
  // Status
  isSetupCompleted: boolean;
  
  // Relations
  workingDays: WorkingDay[];
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
    addPublicHoliday: useAddPublicHoliday(),
    deletePublicHoliday: useDeletePublicHoliday(),
  };

  const formatCurrency = (amount?: number, decimals = 2) => {
    const currency = settings?.currency || "USD";
    if (amount === undefined || amount === null) {
    return currency;
  }
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
    addPublicHoliday: mutations.addPublicHoliday.mutate,
    deletePublicHoliday: mutations.deletePublicHoliday.mutate,


    // Loading states
    isUpdating: mutations.updateSettings.isPending,
    isUpdatingWorkingDays: mutations.updateWorkingDays.isPending,
    isDeletingHoliday: mutations.deletePublicHoliday.isPending,
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
