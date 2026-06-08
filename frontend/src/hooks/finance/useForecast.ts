import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface SalesForecast {
  id: string;               // UUID, not integer
  variant: string;          // variant UUID
  variant_sku: string;
  forecast_date: string;
  predicted_quantity: string;
  confidence: number;
  method_used: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

async function getSalesForecasts(params?: {
  variant?: string;
  forecast_date?: string;
  page?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.variant) searchParams.append("variant", params.variant);
  if (params?.forecast_date) searchParams.append("forecast_date", params.forecast_date);
  if (params?.page) searchParams.append("page", String(params.page));
  const url = `/api/forecast/sales-forecast/${searchParams.toString() ? `?${searchParams}` : ""}`;
  return apiFetch<PaginatedResponse<SalesForecast>>(url);
}

export function useSalesForecast(filters?: {
  variant?: string;
  forecast_date?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: ["sales-forecast", filters],
    queryFn: () => getSalesForecasts(filters),
    select: (data) => data.results,
    staleTime: 60_000,
  });
}