// src/hooks/useProducts.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// ---------- Types matching backend ----------
export interface VariantAttribute {
  id: string;
  attribute_key: string;
  attribute_value: string;
}

export interface VariantImage {
  id: string;
  image_url: string;
  sort_order: number;
  is_primary: boolean;
}

export interface StockByWarehouse {
  warehouse_id: string;
  warehouse_name: string;
  quantity_on_hand: number;
  quantity_reserved: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  barcode: string;
  qr_code: string;
  buying_price: string;
  selling_price: string;
  min_stock_level: number;
  max_stock_level: number;
  is_deleted: boolean;
  variant_attributes: VariantAttribute[];
  variant_images: VariantImage[];
  total_stock: number;
  stock_by_warehouse: StockByWarehouse[];
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  product_name: string;
  description: string;
  category_id: string | null;
  brand_id: string | null;
  unit: string;
  storage_requirement: string;
  tax_rate: string;
  status: string;
  is_active: boolean;
  variants: ProductVariant[];
  created_at: string;
  updated_at: string;
  created_by_name?: string | null; 
  updated_by_name?: string | null;   
}

// Paginated response from backend
interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Payload for create/update – now includes optional id and correct stock handling
export interface ProductVariantPayload {
  id?: string;                      // ← ADDED: required for updates
  sku: string;
  barcode?: string;
  qrCode?: string;
  buyingPrice: number;
  sellingPrice: number;
  stock?: number;                   // only for new variants or absolute change
  minStockLevel?: number;
  maxStockLevel?: number;
  attributes?: Array<{ key: string; value: string }>;
  images?: string[];
}

export interface ProductPayload {
  productName: string;
  description?: string;
  category?: string | null;
  brand?: string | null;
  unit: string;
  storageRequirement: string;
  taxRate: number;
  status: string;
  is_active: boolean;
  variants: ProductVariantPayload[];
}

export interface ProductMutationResponse {
  status: string;
  message: string;
  data: Product;
}

// ---------- Hook with pagination handling ----------
export function useProducts(filters?: {
  search?: string;
  category?: string;
  brand?: string;
  status?: string;
}) {
  const api = useApi();

  let url = "/api/inventory/products/";

  const params = new URLSearchParams();

  if (filters) {
    if (filters.search) params.append("search", filters.search);
    if (filters.category) params.append("category", filters.category);
    if (filters.brand) params.append("brand", filters.brand);
    if (filters.status) params.append("status", filters.status);
  }

  const queryString = params.toString();

  if (queryString) {
    url += `?${queryString}`;
  }

  return useQuery<
    PaginatedResponse<Product>,
    Error,
    Product[]
  >({
    queryKey: ["products", filters],
    queryFn: () => api<PaginatedResponse<Product>>(url),
    select: (data) => data.results,
    staleTime: 30 * 1000,
  });
}

export function useProduct(id: string | null) {
  const api = useApi();
  return useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => api<Product>(`/api/inventory/products/${id}/`),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductPayload) =>
      api<ProductMutationResponse>("/api/inventory/products/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & ProductPayload) =>
      api<ProductMutationResponse>(`/api/inventory/products/${id}/`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", variables.id] });
    },
  });
}

export function useDeleteProduct() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/inventory/products/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}