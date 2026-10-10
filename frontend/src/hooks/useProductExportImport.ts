// src/hooks/useProductExportImport.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConflictType = "db_conflict" | "soft_deleted" | "file_duplicate" | null;
export type ConflictPolicy =
  | "add_new"
  | "update_existing"
  | "skip_duplicates"
  | "replace_existing";

export interface ExistingLocation {
  warehouse_id?: string | null;
  warehouse_name: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  /** The warehouse the import writes stock to (the tenant's default warehouse). */
  is_default?: boolean;
}

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
  /**
   * Quantity typed in the review modal.
   * - `null` / missing → stock is left untouched.
   * - Update Existing → added to the current stock (80 + 20 = 100).
   * - Replace Existing → replaces the current stock (80 → 20).
   * - New rows → opening stock.
   */
  quantity_on_hand?: number | null;

  // Server-resolved conflict metadata (see backend `_resolve_duplicates`)
  conflict_type?: ConflictType;
  is_duplicate_in_file?: boolean;
  duplicate_of_row_index?: number | null;
  existing_match?: "active" | "soft_deleted" | null;
  existing_product_id?: string;
  existing_product_name?: string;
  existing_variant_id?: string;
  existing_variant_title?: string;
  existing_sku?: string;
  existing_category_name?: string;
  existing_brand_name?: string;
  existing_product_status?: string;
  existing_location?: ExistingLocation[];
}

export interface ImportCounts {
  total: number;
  valid: number;
  conflicting: number;
}

export interface ImportParseResponse {
  status: string;
  message: string;
  data: {
    rows: ImportRow[];
    total_rows: number;
    counts?: ImportCounts;
  };
}

/** Per-row validation result returned by the validate endpoint. */
export interface RowValidation {
  row_index: number;
  is_duplicate_in_file: boolean;
  duplicate_of_row_index: number | null;
  conflict_type: ConflictType;
  existing_match: "active" | "soft_deleted" | null;
  existing_product_id?: string;
  existing_product_name?: string;
  existing_variant_id?: string;
  existing_variant_title?: string;
  existing_sku?: string;
  existing_category_name?: string;
  existing_brand_name?: string;
  existing_product_status?: string;
  existing_location?: ExistingLocation[];
}

export interface ImportValidateResponse {
  status: string;
  message: string;
  data: {
    rows: RowValidation[];
    counts: ImportCounts;
  };
}

export interface SkippedRow {
  row_index: number | null;
  sku?: string;
  reason: string;
  message: string;
  existing?: Partial<RowValidation>;
}

export interface FailedRow {
  row_index: number | null;
  rows?: number[];
  message: string;
}

export interface ImportConfirmResponse {
  status: string;
  message: string;
  data: {
    products_created: number;
    variants_created: number;
    brands_created: number;
    categories_created: number;
    products_updated?: number;
    variants_updated?: number;
    rows_skipped?: number;
    rows_failed?: number;
    skipped?: SkippedRow[];
    failed?: FailedRow[];
  };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useExportProducts() {
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

      let data: ImportParseResponse;
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch {
        const msg =
          !response.ok && response.status >= 500
            ? "The server encountered an error. Please check your file format and try again."
            : "Server returned an unexpected response. Please try again.";
        throw new Error(msg);
      }

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

/**
 * Server-authoritative revalidation of edited rows.
 * Uses raw fetch (like parse) so a debounce-triggered validation failure does
 * not spawn a global toast — the modal surfaces the error inline instead.
 */
export function useImportValidate() {
  return useMutation({
    mutationFn: async (
      rows: Pick<ImportRow, "row_index" | "variant_sku">[]
    ): Promise<ImportValidateResponse> => {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(
        `${BASE_URL}/api/inventory/products/import/validate/`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        }
      );

      let data: ImportValidateResponse;
      try {
        data = await response.json();
      } catch {
        throw new Error("Couldn't revalidate SKUs. Please retry.");
      }
      if (!response.ok) {
        throw new Error(data?.message || "Couldn't revalidate SKUs. Please retry.");
      }
      return data;
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
      conflict_policy,
    }: {
      rows: ImportRow[];
      source: string;
      conflict_policy: ConflictPolicy;
    }): Promise<ImportConfirmResponse> => {
      return api<ImportConfirmResponse>(
        "/api/inventory/products/import/confirm/",
        {
          method: "POST",
          body: JSON.stringify({ rows, source, conflict_policy }),
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
