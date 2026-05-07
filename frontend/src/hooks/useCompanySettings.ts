"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface CompanySettings {
  companyName: string;
  currency: string;
  taxRate: number;
  timezone: string;
  fiscalYearStart: string;
  isSetupCompleted: boolean;
}

// ---------- Hook: fetch settings ----------
export function useCompanySettingsQuery() {
  const api = useApi();
  return useQuery({
    queryKey: ["companySettings"],
    queryFn: () => api<CompanySettings>("/api/company/settings/"),
    staleTime: Infinity,
  });
}

// ---------- Hook: update settings ----------
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

// ---------- Combined hook for convenience (replaces the old context) ----------
export function useCompanySettings() {
  const { data: settings, isLoading, error } = useCompanySettingsQuery();
  const updateMutation = useUpdateCompanySettings();

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
    updateSettings: (updates: Partial<CompanySettings>) =>
      updateMutation.mutate(updates),
    formatCurrency,
  };
}