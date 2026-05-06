"use client";
import { createContext, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/context/AuthContext";   // our authenticated fetch

export interface CompanySettings {
  companyName: string;
  currency: string;
  taxRate: number;
  timezone: string;
  fiscalYearStart: string;
}

interface ContextType {
  settings: CompanySettings | undefined;
  isReady: boolean;
  updateSettings: (updates: Partial<CompanySettings>) => void;
  formatCurrency: (amount: number, decimals?: number) => string;
}

const CompanySettingsContext = createContext<ContextType | null>(null);

export function CompanySettingsProvider({ children }: { children: React.ReactNode }) {
  const api = useApi();   // authenticated fetch function
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["companySettings"],
    queryFn: () => api<CompanySettings>("/api/company/settings/"),
    staleTime: Infinity,    // settings rarely change
  });

  // Mutation to update settings
  const mutation = useMutation({
    mutationFn: (updates: Partial<CompanySettings>) =>
      api("/api/company/settings/", { method: "PATCH", body: JSON.stringify(updates) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });

  const updateSettings = (updates: Partial<CompanySettings>) => {
    mutation.mutate(updates);
  };

  const currency = settings?.currency || "USD";
  const formatCurrency = (amount: number, decimals = 2) =>
    `${currency} ${amount.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;

  return (
    <CompanySettingsContext.Provider
      value={{
        settings,
        isReady: !isLoading,
        updateSettings,
        formatCurrency,
      }}
    >
      {children}
    </CompanySettingsContext.Provider>
  );
}

export const useCompanySettings = () => {
  const ctx = useContext(CompanySettingsContext);
  if (!ctx) throw new Error("useCompanySettings must be inside CompanySettingsProvider");
  return ctx;
};