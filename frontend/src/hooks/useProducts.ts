// src/hooks/useProducts.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Tag {
  id: string;
  name: string;
  slug?: string;
  color?: string;
  group?: { id: string; name: string } | null;
}

export interface ProductVariant {
  id?: number;
  sku: string;
  barcode?: string;
  attribute_combination: Record<string, string>;
  cost_price: number;
  selling_price: number;
  special_price?: number | null;
  main_image?: string;
  status: string;
}

export interface ProductAttribute {
  id?: number;
  attribute_name: string;
  attribute_value: string;
  attribute_group?: string;
  is_filterable: boolean;
  display_order: number;
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
  tax_class: string;
  main_image: string;
  gallery_images: string[];
  video_url: string;
  status: string;
  created_at: string;
  updated_at: string;
  variants: ProductVariant[];
  attributes: ProductAttribute[];
  tags: Tag[];
}

// Remove stats – will be moved to separate module
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

export function useProduct(id: number | null) {
  const api = useApi();
  return useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => api(`/api/inventory/products/${id}/`),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      api("/api/inventory/products/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & any) =>
      api(`/api/inventory/products/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
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
    mutationFn: (id: number) => api(`/api/inventory/products/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// Tags remain for listing, but product creation/update uses tag_input
export function useTags() {
  const api = useApi();
  return useQuery<Tag[]>({
    queryKey: ["tags"],
    queryFn: () => api("/api/inventory/tags/"),
  });
}