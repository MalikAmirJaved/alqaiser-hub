// lib/currency.ts
import { store } from "@/store";

/**
 * Format a number as currency using the company's currency from Redux.
 * @param amount - The number to format (optional, can be string or number).
 * @param decimals - Number of decimal places (default 2).
 * @param currency - Override currency code (optional, defaults to company currency).
 * @returns Formatted currency string (e.g., "$1,234.56") or just the currency symbol if amount is undefined.
 */
export function formatCurrency(amount?: number | string, decimals: number = 2, currency?: string): string {
  const state = store.getState();
  const currencyCode = currency || state.companySettings?.data?.currency || "USD";

  if (amount === undefined || amount === null) {
    return currencyCode;
  }

  // Convert string to number if needed
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) {
    return currencyCode;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numericAmount);
}
