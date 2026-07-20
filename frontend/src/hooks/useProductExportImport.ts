// src/hooks/useProductExportImport.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportRow {
  row_index: number;
  product_name: string;
  product_description: string;
  category_id: string | null;
  category_name: string;
  category_is_new: boolean;
  brand_id: string | null;
  brand_name: string;
  brand_is_new: boolean;
  unit: string;
  storage_requirement: string;
  tax_rate: number;
  status: string;
  variant_sku: string;
  variant_title: string;
  variant_barcode: string;
  buying_price: number;
  selling_price: number;
  min_stock_level: number;
  max_stock_level: number;
}

export interface ImportParseResponse {
  status: string;
  message: string;
  data: {
    rows: ImportRow[];
    total_rows: number;
  };
}

export interface ImportConfirmResponse {
  status: string;
  message: string;
  data: {
    products_created: number;
    variants_created: number;
    brands_created: number;
    categories_created: number;
  };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useExportProducts() {
  const api = useApi();

  return useMutation({
    mutationFn: async ({
      format,
      product_ids,
      category,
      brand,
    }: {
      format: "xlsx" | "csv";
      product_ids?: string[];
      category?: string;
      brand?: string;
    }) => {
      const params = new URLSearchParams();
      params.append("file_format", format);
      if (product_ids && product_ids.length > 0) {
        params.append("product_ids", product_ids.join(","));
      }
      if (category) {
        params.append("category", category);
      }
      if (brand) {
        params.append("brand", brand);
      }
      const url = `/api/inventory/products/export/?${params.toString()}`;

      // Use raw fetch for file download (apiFetch expects JSON)
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${BASE_URL}${url}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Export failed");
      }

      // Trigger file download
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
      const filename = filenameMatch
        ? filenameMatch[1]
        : `products_export.${format}`;

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      return { filename };
    },
    onError: (error: Error) => {
      toast.error(error.message || "Export failed");
    },
  });
}

export function useImportParse() {
  const api = useApi();

  return useMutation({
    mutationFn: async (file: File): Promise<ImportParseResponse> => {
      const formData = new FormData();
      formData.append("file", file);

      const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(
        `${BASE_URL}/api/inventory/products/import/parse/`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to parse file");
      }
      return data;
    },
    onError: (error: Error) => {
      toast.error(error.message || "Import parsing failed");
    },
  });
}

export function useImportConfirm() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rows,
      source,
    }: {
      rows: ImportRow[];
      source: string;
    }): Promise<ImportConfirmResponse> => {
      return api<ImportConfirmResponse>(
        "/api/inventory/products/import/confirm/",
        {
          method: "POST",
          body: JSON.stringify({ rows, source }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_product"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_brand"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_category"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Import confirmation failed");
    },
  });
}
