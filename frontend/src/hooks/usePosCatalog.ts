// frontend/src/hooks/usePosCatalog.ts
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// ---------- Types ----------
export interface PosVariantStock {
  available: number;
  on_hand: number;
  reserved: number;
}

export interface PosVariantAttribute {
  key: string;
  value: string;
}

export interface PosVariant {
  id: string;
  sku: string;
  variant_title: string;
  barcode: string;
  selling_price: number;
  min_stock_level: number;
  max_stock_level: number;
  unit: string;
  is_active: boolean;
  image_url: string;
  stock: PosVariantStock;
  attributes: PosVariantAttribute[];
}

export interface PosCatalogProduct {
  id: string;
  product_name: string;
  description: string;
  unit: string;
  category_id: string | null;
  brand_id: string | null;
  variant_count: number;
  variants: PosVariant[];
}

interface PosCatalogResponse {
  count: number;
  page: number;
  page_size: number;
  results: PosCatalogProduct[];
}

// ---------- Hook ----------
export function usePosCatalog(filters: {
  warehouse_id: string;
  search?: string;
  category_id?: string;
  brand_id?: string;
  page?: number;
  page_size?: number;
}) {
  const api = useApi();

  const params = new URLSearchParams();
  params.append("warehouse_id", filters.warehouse_id);
  if (filters.search) params.append("search", filters.search);
  if (filters.category_id) params.append("category_id", filters.category_id);
  if (filters.brand_id) params.append("brand_id", filters.brand_id);
  if (filters.page) params.append("page", String(filters.page));
  if (filters.page_size) params.append("page_size", String(filters.page_size));

  const url = `/api/inventory/stock/pos-catalog/?${params.toString()}`;

  return useQuery<PosCatalogResponse>({
    queryKey: ["pos_catalog", filters],
    queryFn: () => api<PosCatalogResponse>(url),
    staleTime: 30_000,
    retry: 1,
  });
}


