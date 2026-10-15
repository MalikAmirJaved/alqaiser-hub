import type {
  ConflictPolicy,
  ImportRow,
} from "@/hooks/useProductExportImport";

export const PRODUCT_IMPORT_REVIEW_STORAGE_KEY = "product-import-review";
export const PRODUCT_IMPORT_REVIEW_PATH =
  "/inventory/products/import_bulk_upload_review";

export interface ProductImportReviewSession {
  rows: ImportRow[];
  source: string;
  policy?: ConflictPolicy;
}

export function isProductImportReviewSession(
  value: unknown
): value is ProductImportReviewSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProductImportReviewSession>;
  return (
    Array.isArray(candidate.rows) &&
    candidate.rows.every(isImportRow) &&
    typeof candidate.source === "string" &&
    (candidate.policy === undefined ||
      candidate.policy === "add_new" ||
      candidate.policy === "update_existing" ||
      candidate.policy === "skip_duplicates" ||
      candidate.policy === "replace_existing")
  );
}

function isImportRow(value: unknown): value is ImportRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ImportRow>;
  return (
    typeof row.row_index === "number" &&
    typeof row.product_name === "string" &&
    typeof row.product_description === "string" &&
    (row.category_id === null || typeof row.category_id === "string") &&
    typeof row.category_name === "string" &&
    typeof row.category_is_new === "boolean" &&
    (row.brand_id === null || typeof row.brand_id === "string") &&
    typeof row.brand_name === "string" &&
    typeof row.brand_is_new === "boolean" &&
    typeof row.unit === "string" &&
    typeof row.storage_requirement === "string" &&
    typeof row.tax_rate === "number" &&
    typeof row.status === "string" &&
    typeof row.variant_sku === "string" &&
    typeof row.variant_title === "string" &&
    typeof row.variant_barcode === "string" &&
    typeof row.buying_price === "number" &&
    typeof row.selling_price === "number" &&
    typeof row.min_stock_level === "number" &&
    typeof row.max_stock_level === "number" &&
    (row.quantity_on_hand === undefined ||
      row.quantity_on_hand === null ||
      typeof row.quantity_on_hand === "number") &&
    (row.existing_location === undefined || Array.isArray(row.existing_location))
  );
}
