
// src/context/CompanySettingsContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { ls } from "@/services/localStorageService";

export interface CompanySettings {
  companyName: string;
  currency: string;
  taxRate: number;
  timezone: string;
  fiscalYearStart: string;
  [key: string]: any;
}

interface ContextType {
  settings: CompanySettings | null;
  isReady: boolean;
  updateSettings: (updates: Partial<CompanySettings>) => void;
  currency: string;
  formatCurrency: (amount: number, decimals?: number) => string;
}

const CompanySettingsContext = createContext<ContextType | null>(null);

export function CompanySettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isReady, setIsReady] = useState(false);

  const loadSettings = useCallback(() => {
    // Reads from 'company' to match your seeder, but fallbacks safely
    const raw = ls.get<Partial<CompanySettings>>("company") || {};
    const defaults: CompanySettings = {
      companyName: "Al Qaiser IT Company",
      currency: "PKR",
      taxRate: 0,
      timezone: "UTC",
      fiscalYearStart: "January",
    };
    setSettings({ ...defaults, ...raw });
    setIsReady(true);
  }, []);

  useEffect(() => {
    loadSettings();
    
    // Cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "clickmasters_bos__company") loadSettings();
    };
    // Same-tab sync (custom event)
    const handleCustomSync = () => loadSettings();

    window.addEventListener("storage", handleStorage);
    window.addEventListener("settingsUpdated", handleCustomSync);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("settingsUpdated", handleCustomSync);
    };
  }, [loadSettings]);

  const updateSettings = (updates: Partial<CompanySettings>) => {
  setSettings((prev) => {
    const base: CompanySettings = {
      companyName: "Al Qaiser IT Company",
      currency: "PKR",
      taxRate: 0,
      timezone: "UTC",
      fiscalYearStart: "January",
      ...(prev || {}),
    };

    const newSettings: CompanySettings = {
      ...base,
      ...updates,
    };

    ls.set("company", newSettings);
    window.dispatchEvent(new Event("settingsUpdated"));

    return newSettings;
  });
};

  const currency = settings?.currency || "PKR";
  
  const formatCurrency = useMemo(() => {
    return (amount: number, decimals = 2) => {
      return `${currency} ${Number(amount).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;
    };
  }, [currency]);

  return (
    <CompanySettingsContext.Provider value={{ settings, isReady, updateSettings, currency, formatCurrency }}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

export const useCompanySettings = () => {
  const ctx = useContext(CompanySettingsContext);
  if (!ctx) throw new Error("useCompanySettings must be used within CompanySettingsProvider");
  return ctx;
};
