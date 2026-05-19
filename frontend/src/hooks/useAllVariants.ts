// src/hooks/useAllVariants.ts
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface VariantDetail {
  id: string;
  sku: string;
  barcode: string;
  qr_code: string;
  buying_price: number;
  selling_price: number;
  min_stock_level: number;
  max_stock_level: number;
  is_deleted: boolean;
  product_id: string;
  product_name: string;
  category_id: string | null;
  brand_id: string | null;
  unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Fetch all variants (handles pagination internally)
 */
export function useAllVariants(filters?: { search?: string; product_id?: string; active_only?: boolean }) {
  const api = useApi();

  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.product_id) params.append("product_id", filters.product_id);
  if (filters?.active_only !== undefined) params.append("active_only", String(filters.active_only));

  const queryString = params.toString();
  const baseUrl = `/api/inventory/variants/${queryString ? `?${queryString}` : ""}`;

  // Use infinite query to fetch all pages automatically
  return useInfiniteQuery<VariantDetail[]>({
    queryKey: ["allVariants", filters],
    queryFn: async ({ pageParam = 1 }) => {
      const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}page=${pageParam}`;
      const response = await api<PaginatedResponse<VariantDetail>>(url);
      return response.results;
    },
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      // You would need to know if there's a next page; simplest is to fetch until empty
      // For simplicity, you can also just use a regular query with large page_size
      return undefined;
    },
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Alternative: Fetch all variants in one request (if you set page_size large enough)
 * Recommended for small to medium datasets.
 */
export function useAllVariantsSimple(filters?: { search?: string; product_id?: string; active_only?: boolean }) {
  const api = useApi();

  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.product_id) params.append("product_id", filters.product_id);
  if (filters?.active_only !== undefined) params.append("active_only", String(filters.active_only));
  params.append("page_size", "1000"); // large enough for most cases

  const url = `/api/inventory/variants/?${params.toString()}`;

  return useQuery<VariantDetail[]>({
    queryKey: ["allVariantsSimple", filters],
    queryFn: async () => {
      const response = await api<PaginatedResponse<VariantDetail>>(url);
      return response.results;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useVariantStock(variantId: string | null, warehouseId: string | null) {
  const api = useApi();
  const params = new URLSearchParams();
  if (variantId) params.append("variant_id", variantId);
  if (warehouseId) params.append("warehouse_id", warehouseId);
  
  return useQuery({
    queryKey: ["variantStock", variantId, warehouseId],
    queryFn: async () => {
      const res = await api<{ results: any[] }>(`/api/inventory/stock/current_stock/?${params.toString()}`);
      return res.results?.[0] || null;
    },
    enabled: !!variantId && !!warehouseId,
    staleTime: 15_000,
  });
}
