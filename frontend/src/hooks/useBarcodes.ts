"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface BarcodeItem {
  id: string;           // variant UUID
  sku: string;
  barcode: string;
  product_name: string;
  product_id: string;
  created_at: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useBarcodes(search: string = "", page: number = 1, pageSize: number = 20) {
  const api = useApi();
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  params.append("page", String(page));
  params.append("page_size", String(pageSize));

  const url = `/api/inventory/barcodes/?${params.toString()}`;

  return useQuery<PaginatedResponse<BarcodeItem>, Error>({
    queryKey: ["barcodes", search, page],
    queryFn: () => api(url),
    staleTime: 30_000,
  });
}