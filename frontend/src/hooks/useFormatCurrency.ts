import { useSelector } from "react-redux";
import { RootState } from "@/store";

export function useFormatCurrency() {
  const currency = useSelector((state: RootState) => state.companySettings?.data?.currency ?? "USD");
  return (amount?: number | string, decimals = 2) => {
    if (amount == null) return currency;
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return currency;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
    }).format(num);
  };
}