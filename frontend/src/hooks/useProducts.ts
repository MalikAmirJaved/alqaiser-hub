// src/hooks/useProducts.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

export interface Product {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  short_description: string;
  description: string;
  category_id: string;
  brand_id: string;
  product_type: string;
  unit_of_measure: string;
  cost_price: number;
  selling_price: number;
  special_price: number | null;
  special_price_from: string | null;
  special_price_to: string | null;
  msrp: number | null;
  tax_class: string;
  tax_rate: number | null;
  main_image: string;
  gallery_images: string[];
  video_url: string;
  status: string;
  created_at: string;
  updated_at: string;
  variants: any[];
  attributes: any[];
  tags: any[];
  inventory: any[];
}

export interface ProductStats {
  total_products: number;
  active_products: number;
  draft_products: number;
  archived_products: number;
  total_stock: number;
  total_reserved: number;
  total_inventory_value: number;
}

// Fetch all products
export function useProducts(filters?: Record<string, any>) {
  const api = useApi();
  let url = "/api/inventory/products/";
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.append(k, String(v));
    });
  }
  const queryString = params.toString();
  if (queryString) url += `?${queryString}`;

  return useQuery<Product[]>({
    queryKey: ["products", filters],
    queryFn: () => api(url),
    staleTime: 30 * 1000,
  });
}

// Fetch single product
export function useProduct(id: number | null) {
  const api = useApi();
  return useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => api(`/api/inventory/products/${id}/`),
    enabled: !!id,
  });
}

// Stats
export function useProductStats() {
  const api = useApi();
  return useQuery<ProductStats>({
    queryKey: ["productStats"],
    queryFn: () => api("/api/inventory/products/stats/"),
    staleTime: 60 * 1000,
  });
}

// Create
export function useCreateProduct() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Product, "id" | "created_at" | "updated_at">) =>
      api("/api/inventory/products/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["productStats"] });
    },
  });
}

// Update
export function useUpdateProduct() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Product> & { id: number }) =>
      api(`/api/inventory/products/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["productStats"] });
    },
  });
}

// Delete
export function useDeleteProduct() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/inventory/products/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["productStats"] });
    },
  });
}

// Tags
export function useTags() {
  const api = useApi();

  return useQuery<Tag[]>({
    queryKey: ["tags"],
    queryFn: () => api("/api/inventory/tags/"),
  });
}