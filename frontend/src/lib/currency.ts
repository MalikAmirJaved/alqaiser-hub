// lib/currency.ts
import { store } from "@/store";

/**
 * Format a number as currency using the company's currency from Redux.
 * @param amount - The number to format (optional).
 * @param decimals - Number of decimal places (default 2).
 * @param currency - Override currency code (optional, defaults to company currency).
 * @returns Formatted currency string (e.g., "$1,234.56") or just the currency symbol if amount is undefined.
 */
export function formatCurrency(amount?: number, decimals: number = 2, currency?: string): string {
  const state = store.getState();
  const currencyCode = currency || state.companySettings?.data?.currency || "USD";

  if (amount === undefined || amount === null) {
    return currencyCode;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Get the current company's currency code from Redux.
 * @returns Currency code (e.g., "USD", "PKR").
 */
export function CurrencyCode(): string {
  const state = store.getState();
  return state.companySettings?.data?.currency || "USD";
}