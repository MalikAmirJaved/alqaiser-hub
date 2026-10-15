// src/components/inventory/product/ImportReviewModal.tsx
"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  ArrowLeft,
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useImportConfirm,
  useImportValidate,
} from "@/hooks/useProductExportImport";
import type {
  ImportRow,
  ConflictPolicy,
  RowValidation,
  SkippedRow,
} from "@/hooks/useProductExportImport";
import { PRODUCT_IMPORT_REVIEW_STORAGE_KEY } from "@/lib/productImportReview";
import { toast } from "sonner";

interface ImportReviewPageProps {
  onClose: () => void;
  rows: ImportRow[];
  source: string;
  initialPolicy?: ConflictPolicy;
}

// ──────────────────────────────────────────────────────
// Types & helpers
// ──────────────────────────────────────────────────────

type RowStatusType =
  | "valid"
  | "db_conflict"
  | "soft_deleted"
  | "file_duplicate"
  | "missing_sku";

interface RowStatus {
  type: RowStatusType;
  info?: RowValidation;
  otherIndex?: number | null;
}

const POLICY_META: Record<
  ConflictPolicy,
  { label: string; hint: string; qtyHint: string }
> = {
  add_new: {
    label: "Add New",
    hint: "Create only new products. Any SKU conflict blocks the import.",
    qtyHint: "Qty becomes the opening stock of the variants being created.",
  },
  update_existing: {
    label: "Update Existing",
    hint: "Update matched SKUs in place and add Qty to the stock already on hand. Unmatched rows are created.",
    qtyHint: "Qty is added to the current stock (80 + 20 = 100).",
  },
  skip_duplicates: {
    label: "Skip Duplicates",
    hint: "Import valid rows; conflicting rows are skipped and reported. Skipped rows stay editable so you can fix them.",
    qtyHint: "Qty applies to the rows being created; skipped rows are left untouched.",
  },
  replace_existing: {
    label: "Replace Existing",
    hint: "Overwrite matched records in place (keeps IDs) and set stock to Qty. Blank cells clear the stored value.",
    qtyHint: "Qty replaces the current stock.",
  },
};

/**
 * Existing stock the import will write to: the default warehouse when the
 * server flagged one (`is_default`), otherwise the first listed warehouse.
 */
function existingStockQty(info?: RowValidation): number | null {
  const locations = info?.existing_location || [];
  if (locations.length === 0) return null;
  const target = locations.find((l) => l.is_default) || locations[0];
  return target?.quantity_on_hand ?? null;
}

function computeFileDuplicates(rows: ImportRow[]): Record<number, number> {
  const bySku: Record<string, number[]> = {};
  rows.forEach((row) => {
    const sku = (row.variant_sku || "").trim();
    if (sku) (bySku[sku] = bySku[sku] || []).push(row.row_index);
  });
  const duplicates: Record<number, number> = {};
  Object.values(bySku).forEach((idxs) => {
    if (idxs.length > 1) {
      idxs.forEach((i) => {
        const other = idxs.find((x) => x !== i);
        if (other !== undefined) duplicates[i] = other;
      });
    }
  });
  return duplicates;
}

interface RowError {
  row_index: number;
  field: string;
  message: string;
}

/** Field-level blocking validation (mirrors the server-side rules). */
function validateRowFields(row: ImportRow): RowError[] {
  const errors: RowError[] = [];
  if (!row.product_name?.trim()) {
    errors.push({
      row_index: row.row_index,
      field: "product_name",
      message: "Product name is required",
    });
  }
  if (Number(row.selling_price) < 0) {
    errors.push({
      row_index: row.row_index,
      field: "selling_price",
      message: "Selling price cannot be negative",
    });
  }
  if (Number(row.buying_price) < 0) {
    errors.push({
      row_index: row.row_index,
      field: "buying_price",
      message: "Buying price cannot be negative",
    });
  }
  if (Number(row.min_stock_level) < 0) {
    errors.push({
      row_index: row.row_index,
      field: "min_stock_level",
      message: "Min stock level cannot be negative",
    });
  }
  if (Number(row.max_stock_level) < 0) {
    errors.push({
      row_index: row.row_index,
      field: "max_stock_level",
      message: "Max stock level cannot be negative",
    });
  }
  // Only validated when the user typed a Qty — blank means "leave stock alone".
  if (row.quantity_on_hand !== null && row.quantity_on_hand !== undefined) {
    if (Number(row.quantity_on_hand) < 0) {
      errors.push({
        row_index: row.row_index,
        field: "quantity_on_hand",
        message: "Quantity cannot be negative",
      });
    }
  }
  return errors;
}

function resolveStatus(
  row: ImportRow,
  validation: Record<number, RowValidation>,
  fileDuplicates: Record<number, number>
): RowStatus {
  const info = validation[row.row_index];
  const sku = (row.variant_sku || "").trim();
  const otherIndex = fileDuplicates[row.row_index];
  if (sku && info?.conflict_type === "db_conflict") {
    return { type: "db_conflict", info, otherIndex: otherIndex ?? null };
  }
  if (sku && info?.conflict_type === "soft_deleted") {
    return { type: "soft_deleted", info };
  }
  if (otherIndex !== undefined) {
    return { type: "file_duplicate", otherIndex };
  }
  if (!sku) {
    return { type: "missing_sku" };
  }
  return { type: "valid", info };
}

function isBlocking(status: RowStatus, policy: ConflictPolicy): boolean {
  switch (status.type) {
    case "valid":
    case "missing_sku":
      return false;
    case "soft_deleted":
    case "file_duplicate":
      return policy !== "skip_duplicates";
    case "db_conflict":
      return policy === "add_new";
    default:
      return false;
  }
}

function statusMessage(
  status: RowStatus,
  policy: ConflictPolicy
): string {
  switch (status.type) {
    case "db_conflict":
      if (policy === "skip_duplicates") {
        return "SKU already exists — this row will be skipped";
      }
      if (policy === "update_existing") {
        return "SKU already exists — this record will be updated in place";
      }
      if (policy === "replace_existing") {
        return "SKU already exists — this record will be replaced in place";
      }
      return status.otherIndex != null
        ? "SKU already exists (also duplicated within this file)"
        : "SKU already exists";
    case "soft_deleted":
      return "SKU belongs to a deleted product; choose a different SKU";
    case "file_duplicate":
      return `Duplicate SKU in the uploaded file (also row ${
        (status.otherIndex ?? 0) + 1
      })`;
    case "missing_sku":
      return "No SKU — one will be generated";
    default:
      return "";
  }
}

function statusClasses(status: RowStatus): string {
  switch (status.type) {
    case "db_conflict":
    case "file_duplicate":
      return "border-destructive focus-visible:ring-destructive";
    case "soft_deleted":
    case "missing_sku":
      return "border-warning focus-visible:ring-warning";
    default:
      return "";
  }
}

interface ImportSummary {
  products: number;
  variants: number;
  productsUpdated: number;
  variantsUpdated: number;
  skipped: number;
  failed: number;
  skippedRows: SkippedRow[];
  message: string;
}

// ──────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────

export default function ImportReviewPage({
  onClose,
  rows: initialRows,
  source,
  initialPolicy,
}: ImportReviewPageProps) {
  const [rows, setRows] = useState<ImportRow[]>(initialRows);
  const [collapsedProducts, setCollapsedProducts] = useState<Set<string>>(
    new Set()
  );
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editProductName, setEditProductName] = useState("");
  const [policy, setPolicy] = useState<ConflictPolicy>(
    initialPolicy ?? "add_new"
  );
  const [validation, setValidation] = useState<Record<number, RowValidation>>(
    {}
  );
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const importConfirm = useImportConfirm();
  const validate = useImportValidate();

  const [success, setSuccess] = useState<ImportSummary | null>(null);
  const [serverErrors, setServerErrors] = useState<
    { row_index: number | null; message?: string; error?: string }[]
  >([]);

  const PAGE_SIZE = 25;

  // Keep a ref so the debounce effect can read the latest rows/validator
  // without re-subscribing every render.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const validateRef = useRef(validate);
  validateRef.current = validate;
  const persistenceErrorShown = useRef(false);
  const persistenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed validation from the parse response (server already resolved conflicts)
  useEffect(() => {
    setRows(
      initialRows.map((row) => ({
        ...row,
        quantity_on_hand: row.quantity_on_hand ?? null,
      }))
    );
    const seed: Record<number, RowValidation> = {};
    initialRows.forEach((row) => {
      seed[row.row_index] = {
        row_index: row.row_index,
        is_duplicate_in_file: !!row.is_duplicate_in_file,
        duplicate_of_row_index: row.duplicate_of_row_index ?? null,
        conflict_type: row.conflict_type ?? null,
        existing_match: row.existing_match ?? null,
        existing_product_id: row.existing_product_id,
        existing_product_name: row.existing_product_name,
        existing_variant_id: row.existing_variant_id,
        existing_variant_title: row.existing_variant_title,
        existing_sku: row.existing_sku,
        existing_category_name: row.existing_category_name,
        existing_brand_name: row.existing_brand_name,
        existing_product_status: row.existing_product_status,
        existing_location: row.existing_location,
      };
    });
    setValidation(seed);
  }, [initialRows]);

  useEffect(() => {
    persistenceTimer.current = setTimeout(() => {
      persistenceTimer.current = null;
      try {
        window.sessionStorage.setItem(
          PRODUCT_IMPORT_REVIEW_STORAGE_KEY,
          JSON.stringify({ rows, source, policy })
        );
        persistenceErrorShown.current = false;
      } catch {
        if (!persistenceErrorShown.current) {
          toast.error(
            "Your latest review edits could not be saved in this browser tab."
          );
          persistenceErrorShown.current = true;
        }
      }
    }, 250);
    return () => {
      if (persistenceTimer.current) {
        clearTimeout(persistenceTimer.current);
        persistenceTimer.current = null;
      }
    };
  }, [rows, source, policy]);

  const fileDuplicates = useMemo(() => computeFileDuplicates(rows), [rows]);

  // Signature of SKU values — the debounced server revalidation trigger
  const skuSignature = useMemo(
    () =>
      rows
        .map((r) => `${r.row_index}:${(r.variant_sku || "").trim()}`)
        .join("|"),
    [rows]
  );

  useEffect(() => {
    if (rowsRef.current.length === 0) return;
    const timer = setTimeout(async () => {
      const current = rowsRef.current;
      if (current.length === 0) return;
      setValidating(true);
      setValidateError(null);
      try {
        const res = await validateRef.current.mutateAsync(
          current.map((r) => ({
            row_index: r.row_index,
            variant_sku: r.variant_sku,
          }))
        );
        const map: Record<number, RowValidation> = {};
        res.data.rows.forEach((v) => {
          map[v.row_index] = v;
        });
        setValidation(map);
      } catch (err: any) {
        setValidateError(err?.message || "Couldn't revalidate SKUs.");
      } finally {
        setValidating(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [skuSignature]);

  const rerunValidation = useCallback(async () => {
    const current = rowsRef.current;
    if (current.length === 0) return;
    setValidating(true);
    setValidateError(null);
    try {
      const res = await validateRef.current.mutateAsync(
        current.map((r) => ({ row_index: r.row_index, variant_sku: r.variant_sku }))
      );
      const map: Record<number, RowValidation> = {};
      res.data.rows.forEach((v) => {
        map[v.row_index] = v;
      });
      setValidation(map);
    } catch (err: any) {
      setValidateError(err?.message || "Couldn't revalidate SKUs.");
    } finally {
      setValidating(false);
    }
  }, []);

  const statuses = useMemo(() => {
    const map: Record<number, RowStatus> = {};
    rows.forEach((row) => {
      map[row.row_index] = resolveStatus(row, validation, fileDuplicates);
    });
    return map;
  }, [rows, validation, fileDuplicates]);

  const fieldErrors = useMemo(() => {
    const map: Record<number, RowError[]> = {};
    rows.forEach((row) => {
      map[row.row_index] = validateRowFields(row);
    });
    return map;
  }, [rows]);

  const counts = useMemo(() => {
    let valid = 0;
    let conflicting = 0;
    rows.forEach((row) => {
      const status = statuses[row.row_index];
      if (status && (status.type === "valid" || status.type === "missing_sku")) {
        valid += 1;
      } else {
        conflicting += 1;
      }
    });
    return { valid, conflicting };
  }, [rows, statuses]);

  const hasBlocking = useMemo(
    () =>
      rows.some((row) => {
        if ((fieldErrors[row.row_index] || []).length > 0) return true;
        const status = statuses[row.row_index];
        return status ? isBlocking(status, policy) : false;
      }),
    [rows, statuses, policy, fieldErrors]
  );

  const productGroups = useMemo(() => {
    const groups: Record<string, ImportRow[]> = {};
    rows.forEach((row) => {
      const key = row.product_name || "Unnamed Product";
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return Object.entries(groups).map(([name, r]) => ({
      product_name: name,
      rows: r,
      collapsed: collapsedProducts.has(name),
    }));
  }, [rows, collapsedProducts]);

  const pageCount = Math.max(1, Math.ceil(productGroups.length / PAGE_SIZE));
  // Clamp so removing rows/products can never leave the user on an empty page.
  const safePage = Math.min(page, pageCount - 1);
  const visibleGroups = productGroups.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  const updateRow = useCallback(
    (rowIndex: number, field: keyof ImportRow, value: any) => {
      setRows((prev) => {
        const updated = [...prev];
        const idx = updated.findIndex((r) => r.row_index === rowIndex);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], [field]: value };
        }
        return updated;
      });
    },
    []
  );

  const removeRow = useCallback((rowIndex: number) => {
    setRows((prev) => prev.filter((r) => r.row_index !== rowIndex));
  }, []);

  const removeProduct = useCallback((productName: string) => {
    setRows((prev) => prev.filter((r) => r.product_name !== productName));
  }, []);

  const addVariantToProduct = useCallback((productName: string) => {
    setRows((prev) => {
      const maxIndex = prev.reduce((max, r) => Math.max(max, r.row_index), -1);
      const newRowIndex = maxIndex + 1;
      const templateRow = prev.find((r) => r.product_name === productName);
      const newRow: ImportRow = {
        row_index: newRowIndex,
        product_name: productName,
        product_description: templateRow?.product_description || "",
        category_id: templateRow?.category_id || null,
        category_name: templateRow?.category_name || "",
        category_is_new: templateRow?.category_is_new || false,
        brand_id: templateRow?.brand_id || null,
        brand_name: templateRow?.brand_name || "",
        brand_is_new: templateRow?.brand_is_new || false,
        unit: templateRow?.unit || "PIECE",
        storage_requirement: templateRow?.storage_requirement || "AMBIENT",
        tax_rate: templateRow?.tax_rate || 0,
        status: templateRow?.status || "active",
        variant_sku: "",
        variant_title: "",
        variant_barcode: "",
        buying_price: 0,
        selling_price: 0,
        min_stock_level: 0,
        max_stock_level: 0,
        quantity_on_hand: null,
      };
      // Find the index of the first variant of this product to insert at the very top
      const firstVariantIndex = prev.findIndex((r) => r.product_name === productName);
      if (firstVariantIndex >= 0) {
        // Insert BEFORE the first variant (at the very top of this product's variants)
        const newRows = [...prev];
        newRows.splice(firstVariantIndex, 0, newRow);
        return newRows;
      }
      // Fallback: add to end if product not found
      return [...prev, newRow];
    });
  }, []);

  const addNewProduct = useCallback(() => {
    let newProductName = "";
    setRows((prev) => {
      const maxIndex = prev.reduce((max, r) => Math.max(max, r.row_index), -1);
      const newRowIndex = maxIndex + 1;
      // Generate a unique product name
      const existingNames = new Set(prev.map((r) => r.product_name));
      newProductName = "New Product";
      let counter = 1;
      while (existingNames.has(newProductName)) {
        newProductName = `New Product ${counter}`;
        counter++;
      }
      const newRow: ImportRow = {
        row_index: newRowIndex,
        product_name: newProductName,
        product_description: "",
        category_id: null,
        category_name: "",
        category_is_new: false,
        brand_id: null,
        brand_name: "",
        brand_is_new: false,
        unit: "PIECE",
        storage_requirement: "AMBIENT",
        tax_rate: 0,
        status: "active",
        variant_sku: "",
        variant_title: "",
        variant_barcode: "",
        buying_price: 0,
        selling_price: 0,
        min_stock_level: 0,
        max_stock_level: 0,
        quantity_on_hand: null,
      };
      return [newRow, ...prev]; // Add to top
    });
    // Auto-expand the new product, go to page 0, and enter edit mode
    setCollapsedProducts((prev) => {
      const next = new Set(prev);
      next.delete(newProductName); // Ensure it's expanded
      return next;
    });
    setPage(0);
    // Enter edit mode for the new product (auto-focus via autoFocus prop)
    setEditingProduct(newProductName);
    setEditProductName(newProductName);
  }, []);

  const toggleCollapse = useCallback((productName: string) => {
    setCollapsedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productName)) next.delete(productName);
      else next.add(productName);
      return next;
    });
  }, []);

  const startEditProductName = useCallback((productName: string) => {
    setEditingProduct(productName);
    setEditProductName(productName);
  }, []);

  const saveEditProductName = useCallback((productName: string) => {
    if (editProductName.trim() && editProductName !== productName) {
      setRows((prev) =>
        prev.map((r) =>
          r.product_name === productName
            ? { ...r, product_name: editProductName.trim() }
            : r
        )
      );
    }
    setEditingProduct(null);
    setEditProductName("");
  }, [editProductName]);

  const cancelEditProductName = useCallback(() => {
    setEditingProduct(null);
    setEditProductName("");
  }, []);

  /** Expand, paginate to, and focus the SKU input of the first blocking row. */
  const locateFirstConflict = useCallback(() => {
    const target = rows.find((row) => {
      if ((fieldErrors[row.row_index] || []).length > 0) return true;
      const status = statuses[row.row_index];
      return status ? isBlocking(status, policy) : false;
    });
    if (!target) return;
    const groupKey = target.product_name || "Unnamed Product";
    setCollapsedProducts((prev) => {
      const next = new Set(prev);
      next.delete(groupKey);
      return next;
    });
    const groupIndex = productGroups.findIndex(
      (g) => g.product_name === groupKey
    );
    if (groupIndex >= 0) {
      setPage(Math.floor(groupIndex / PAGE_SIZE));
    }
    setTimeout(() => {
      const el = document.getElementById(
        `sku-input-${target.row_index}`
      ) as HTMLInputElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus();
    }, 60);
  }, [rows, fieldErrors, statuses, policy, productGroups]);

  const handleConfirm = async () => {
    if (hasBlocking || validating) return;
    setServerErrors([]);
    try {
      const result = await importConfirm.mutateAsync({
        rows,
        source,
        conflict_policy: policy,
      });
      setSuccess({
        products: result.data.products_created ?? 0,
        variants: result.data.variants_created ?? 0,
        productsUpdated: result.data.products_updated ?? 0,
        variantsUpdated: result.data.variants_updated ?? 0,
        skipped: result.data.rows_skipped ?? 0,
        failed: result.data.rows_failed ?? 0,
        skippedRows: result.data.skipped ?? [],
        message: result.message ?? "",
      });
    } catch (err: any) {
      const errors = err?.response?.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        setServerErrors(errors);
      } else {
        setServerErrors([{ row_index: null, message: err?.message || "Import failed." }]);
      }
    }
  };

  const handleClose = () => {
    if (persistenceTimer.current) {
      clearTimeout(persistenceTimer.current);
      persistenceTimer.current = null;
    }
    setSuccess(null);
    setServerErrors([]);
    setValidateError(null);
    setPage(0);
    onClose();
  };

  // ── Success screen ──
  if (success) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-3xl items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm space-y-4">
          <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-success" />
          </div>
          <h2 className="text-xl font-semibold">Import Complete</h2>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              {success.products} product(s) created · {success.variants} variant(s) created
            </p>
            {(success.productsUpdated > 0 || success.variantsUpdated > 0) && (
              <p>
                {success.productsUpdated} product(s) updated · {success.variantsUpdated} variant(s) updated
              </p>
            )}
            {(success.skipped > 0 || success.failed > 0) && (
              <p>
                {success.skipped} row(s) skipped
                {success.failed > 0 ? ` · ${success.failed} row(s) failed` : ""}
              </p>
            )}
          </div>
          {success.skippedRows.length > 0 && (
            <div className="text-left rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Skipped rows
              </p>
              <ul className="max-h-32 overflow-y-auto space-y-0.5 text-[11px] text-muted-foreground">
                {success.skippedRows.map((skipped, i) => (
                  <li key={i}>
                    {skipped.row_index != null ? `Row ${skipped.row_index + 1}: ` : ""}
                    {skipped.message || skipped.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button onClick={handleClose} className="mt-2">
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className=" py-6 ">
      <div className="flex min-h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5 md:p-6 shrink-0">
          <div className="flex items-center gap-3 ">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Review product import</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Verify product details and resolve conflicts before importing.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span>{productGroups.length} products</span>
                <span className="text-muted-foreground/50">·</span>
                <span>{rows.length} variants</span>
                <span className="text-muted-foreground/50">·</span>
                <span className="text-success">{counts.valid} ready</span>
                <span className="text-muted-foreground/50">·</span>
                {counts.conflicting > 0 ? (
                  <button
                    type="button"
                    onClick={locateFirstConflict}
                    className="text-destructive underline underline-offset-2 hover:opacity-80"
                    title="Show the first conflicting row"
                  >
                    {counts.conflicting} need attention
                  </button>
                ) : (
                  <span className="text-muted-foreground">No conflicts</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={importConfirm.isPending}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to products
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addNewProduct}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Product
            </Button>
            {validating && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Validating…
              </span>
            )}
          </div>
        </div>

        {/* Revalidation error */}
        {validateError && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-warning/10 border border-warning/30 flex items-start gap-2 text-sm text-warning">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="flex-1">{validateError}</span>
            <button
              onClick={rerunValidation}
              className="inline-flex items-center gap-1 text-xs font-medium underline"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Server errors */}
        {serverErrors.length > 0 && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">The import could not be completed:</p>
                <ul className="mt-1 space-y-0.5 text-xs list-disc list-inside">
                  {serverErrors.slice(0, 8).map((err, i) => (
                    <li key={i}>
                      {err.row_index != null ? `Row ${err.row_index + 1}: ` : ""}
                      {err.message || err.error || "Unknown error"}
                    </li>
                  ))}
                  {serverErrors.length > 8 && (
                    <li className="text-muted-foreground">
                      ...and {serverErrors.length - 8} more
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 p-4 md:p-6 space-y-3">
          {visibleGroups.map((group) => (
            <div
              key={group.product_name}
              className="rounded-xl border border-border overflow-hidden"
            >
              {/* Product Header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
                <button
                  onClick={() => toggleCollapse(group.product_name)}
                  className="p-0.5 rounded hover:bg-muted transition-colors"
                  aria-label={group.collapsed ? "Expand" : "Collapse"}
                >
                  {group.collapsed ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                {editingProduct === group.product_name ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      value={editProductName}
                      onChange={(e) => setEditProductName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEditProductName(group.product_name);
                        if (e.key === "Escape") cancelEditProductName();
                      }}
                      onBlur={() => saveEditProductName(group.product_name)}
                      className="h-7 text-sm font-semibold bg-transparent border-primary focus-visible:ring-primary"
                      autoFocus
                    />
                    <button
                      onClick={() => saveEditProductName(group.product_name)}
                      className="p-1 rounded hover:bg-primary/10 text-primary"
                      title="Save"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={cancelEditProductName}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span
                      onClick={() => startEditProductName(group.product_name)}
                      className="text-sm font-semibold flex-1 truncate  hover:underline"
                      title="Click to edit"
                    >
                      {group.product_name}
                    </span>
                    {group.rows.some((r) =>
                      (fieldErrors[r.row_index] || []).some(
                        (e) => e.field === "product_name"
                      )
                    ) && (
                      <span
                        role="alert"
                        className="flex items-center gap-1 text-[11px] text-destructive"
                      >
                        <AlertCircle className="w-3 h-3" />
                        Product name is required
                      </span>
                    )}
                  </>
                )}
                <Badge variant="secondary" className="text-xs">
                  {group.rows.length} variant{group.rows.length > 1 ? "s" : ""}
                </Badge>
                <button
                  onClick={() => addVariantToProduct(group.product_name)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                  title="Add variant"
                >
                  <Plus className="w-3 h-3" />
                  Variant
                </button>
                <button
                  onClick={() => removeProduct(group.product_name)}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Remove product"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {!group.collapsed && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1120px] text-xs">
                    <thead>
                      <tr className="sticky top-0 z-[1] border-b border-border bg-muted/80 backdrop-blur-sm">
                        <th className="px-2.5 py-2 text-left font-medium text-muted-foreground">
                          SKU
                        </th>
                        <th className="px-2.5 py-2 text-left font-medium text-muted-foreground">
                          Variant Name
                        </th>
                        <th className="px-2.5 py-2 text-left font-medium text-muted-foreground">
                          Barcode
                        </th>
                        <th className="px-2.5 py-2 text-left font-medium text-muted-foreground">
                          Category
                        </th>
                        <th className="px-2.5 py-2 text-left font-medium text-muted-foreground">
                          Brand
                        </th>
                        <th className="px-2.5 py-2 text-right font-medium text-muted-foreground">
                          Buy Price
                        </th>
                        <th className="px-2.5 py-2 text-right font-medium text-muted-foreground">
                          Sell Price
                        </th>
                        <th className="px-2.5 py-2 text-right font-medium text-muted-foreground">
                          Min Stock
                        </th>
                        <th className="px-2.5 py-2 text-right font-medium text-muted-foreground">
                          Max Stock
                        </th>
                        <th
                          className="px-2.5 py-2 text-right font-medium text-muted-foreground"
                          title={POLICY_META[policy].qtyHint}
                        >
                          Qty
                        </th>
                        <th className="px-2.5 py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => {
                        const status =
                          statuses[row.row_index] || ({ type: "valid" } as RowStatus);
                        const blocking = isBlocking(status, policy);
                        const hasError = status.type !== "valid";
                        const message = statusMessage(status, policy);
                        const info = status.info;
                        const rowFieldErrors = fieldErrors[row.row_index] || [];
                        const fieldError = (field: string) =>
                          rowFieldErrors.find((e) => e.field === field)?.message;

                        // Check if this row will be skipped under skip_duplicates policy
                        const isSkipped =
                          policy === "skip_duplicates" &&
                          (status.type === "db_conflict" ||
                            status.type === "file_duplicate" ||
                            status.type === "soft_deleted");

                        // Stock the import will write to, and the resulting balance,
                        // so "80 + 20 = 100" is visible before confirming.
                        const stockQty = existingStockQty(info);
                        const qtyValue =
                          row.quantity_on_hand === null ||
                          row.quantity_on_hand === undefined
                            ? null
                            : Number(row.quantity_on_hand);
                        let stockHint: string | null = null;
                        if (stockQty !== null && status.type === "db_conflict") {
                          if (policy === "update_existing") {
                            stockHint =
                              qtyValue === null
                                ? `${stockQty} on hand (unchanged)`
                                : `${stockQty} + ${qtyValue} = ${stockQty + qtyValue}`;
                          } else if (policy === "replace_existing") {
                            stockHint =
                              qtyValue === null
                                ? `${stockQty} on hand (unchanged)`
                                : `${stockQty} → ${qtyValue}`;
                          }
                        }

                        return (
                          <tr
                            key={row.row_index}
                            title={
                              isSkipped
                                ? "Skipped under Skip Duplicates — still editable: change the SKU to include it, or switch the conflict policy."
                                : undefined
                            }
                            className={`border-b border-border/50 last:border-b-0 hover:bg-muted/20 transition-all align-top ${
                              isSkipped
                                ? "opacity-55 hover:opacity-100 focus-within:opacity-100"
                                : ""
                            }`}
                          >
                            <td className="px-2.5 py-1.5">
                              <Input
                                id={`sku-input-${row.row_index}`}
                                value={row.variant_sku}
                                onChange={(e) =>
                                  updateRow(row.row_index, "variant_sku", e.target.value)
                                }
                                className={`h-7 text-xs ${statusClasses(status)}`}
                                placeholder="SKU"
                                aria-invalid={blocking}
                                aria-describedby={
                                  hasError ? `sku-msg-${row.row_index}` : undefined
                                }
                              />
                              {hasError && (
                                <p
                                  id={`sku-msg-${row.row_index}`}
                                  role="alert"
                                  className={`mt-1 flex items-start gap-1 text-[11px] leading-tight ${
                                    status.type === "missing_sku" ||
                                    status.type === "soft_deleted"
                                      ? "text-warning"
                                      : "text-destructive"
                                  }`}
                                >
                                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                  <span>{message}</span>
                                </p>
                              )}
                              {isSkipped && (
                                <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Skipped
                                </span>
                              )}
                              {info?.existing_product_name && (
                                <p className="mt-1 text-[11px] text-muted-foreground leading-tight">
                                  <span className="font-medium">Existing:</span>{" "}
                                  {info.existing_product_name}
                                  {info.existing_variant_title
                                    ? ` / ${info.existing_variant_title}`
                                    : ""}
                                  {info.existing_category_name
                                    ? ` · ${info.existing_category_name}`
                                    : ""}
                                  {info.existing_brand_name
                                    ? ` · ${info.existing_brand_name}`
                                    : ""}
                                  {info.existing_match === "soft_deleted"
                                    ? " · deleted"
                                    : ""}
                                  {info.existing_location && info.existing_location.length > 0
                                    ? ` · ${info.existing_location
                                        .map(
                                          (l) =>
                                            `${l.warehouse_name} (${l.quantity_on_hand})`
                                        )
                                        .join(", ")}`
                                    : ""}
                                </p>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5">
                              <Input
                                value={row.variant_title}
                                onChange={(e) =>
                                  updateRow(row.row_index, "variant_title", e.target.value)
                                }
                                className="h-7 text-xs"
                                placeholder="Variant name"
                              />
                            </td>
                            <td className="px-2.5 py-1.5">
                              <Input
                                value={row.variant_barcode}
                                onChange={(e) =>
                                  updateRow(row.row_index, "variant_barcode", e.target.value)
                                }
                                className="h-7 text-xs"
                                placeholder="Barcode"
                              />
                            </td>
                            <td className="px-2.5 py-1.5">
                              <Input
                                value={row.category_name}
                                onChange={(e) =>
                                  updateRow(row.row_index, "category_name", e.target.value)
                                }
                                className="h-7 text-xs"
                                placeholder="Category"
                              />
                            </td>
                            <td className="px-2.5 py-1.5">
                              <Input
                                value={row.brand_name}
                                onChange={(e) =>
                                  updateRow(row.row_index, "brand_name", e.target.value)
                                }
                                className="h-7 text-xs"
                                placeholder="Brand"
                              />
                            </td>
                            <td className="px-2.5 py-1.5">
                              <Input
                                type="number"
                                value={row.buying_price}
                                onChange={(e) =>
                                  updateRow(
                                    row.row_index,
                                    "buying_price",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className={`h-7 text-xs text-right ${
                                  fieldError("buying_price")
                                    ? "border-destructive focus-visible:ring-destructive"
                                    : ""
                                }`}
                                min="0"
                                step="0.01"
                                aria-invalid={!!fieldError("buying_price")}
                              />
                              {fieldError("buying_price") && (
                                <p
                                  role="alert"
                                  className="mt-1 flex items-start gap-1 text-[11px] leading-tight text-destructive"
                                >
                                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                  <span>{fieldError("buying_price")}</span>
                                </p>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5">
                              <Input
                                type="number"
                                value={row.selling_price}
                                onChange={(e) =>
                                  updateRow(
                                    row.row_index,
                                    "selling_price",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className={`h-7 text-xs text-right ${
                                  fieldError("selling_price")
                                    ? "border-destructive focus-visible:ring-destructive"
                                    : ""
                                }`}
                                min="0"
                                step="0.01"
                                aria-invalid={!!fieldError("selling_price")}
                              />
                              {fieldError("selling_price") && (
                                <p
                                  role="alert"
                                  className="mt-1 flex items-start gap-1 text-[11px] leading-tight text-destructive"
                                >
                                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                  <span>{fieldError("selling_price")}</span>
                                </p>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5">
                              <Input
                                type="number"
                                value={row.min_stock_level}
                                onChange={(e) =>
                                  updateRow(
                                    row.row_index,
                                    "min_stock_level",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className={`h-7 text-xs text-right ${
                                  fieldError("min_stock_level")
                                    ? "border-destructive focus-visible:ring-destructive"
                                    : ""
                                }`}
                                min="0"
                                aria-invalid={!!fieldError("min_stock_level")}
                              />
                              {fieldError("min_stock_level") && (
                                <p
                                  role="alert"
                                  className="mt-1 flex items-start gap-1 text-[11px] leading-tight text-destructive"
                                >
                                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                  <span>{fieldError("min_stock_level")}</span>
                                </p>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5">
                              <Input
                                type="number"
                                value={row.max_stock_level}
                                onChange={(e) =>
                                  updateRow(
                                    row.row_index,
                                    "max_stock_level",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className={`h-7 text-xs text-right ${
                                  fieldError("max_stock_level")
                                    ? "border-destructive focus-visible:ring-destructive"
                                    : ""
                                }`}
                                min="0"
                                aria-invalid={!!fieldError("max_stock_level")}
                              />
                              {fieldError("max_stock_level") && (
                                <p
                                  role="alert"
                                  className="mt-1 flex items-start gap-1 text-[11px] leading-tight text-destructive"
                                >
                                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                  <span>{fieldError("max_stock_level")}</span>
                                </p>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5">
                              <Input
                                type="number"
                                value={qtyValue === null ? "" : qtyValue}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  updateRow(
                                    row.row_index,
                                    "quantity_on_hand",
                                    raw === ""
                                      ? null
                                      : Math.max(0, parseInt(raw, 10) || 0)
                                  );
                                }}
                                className={`h-7 text-xs text-right ${
                                  fieldError("quantity_on_hand")
                                    ? "border-destructive focus-visible:ring-destructive"
                                    : ""
                                }`}
                                min="0"
                                placeholder={stockQty === null ? "0" : String(stockQty)}
                                title={
                                  stockQty === null
                                    ? POLICY_META[policy].qtyHint
                                    : `Current stock: ${stockQty}. ${
                                        POLICY_META[policy].qtyHint
                                      }`
                                }
                                aria-label={`Quantity for row ${row.row_index + 1}`}
                                aria-invalid={!!fieldError("quantity_on_hand")}
                              />
                              {stockHint && (
                                <p className="mt-1 text-right text-[11px] leading-tight text-muted-foreground">
                                  {stockHint}
                                </p>
                              )}
                              {fieldError("quantity_on_hand") && (
                                <p
                                  role="alert"
                                  className="mt-1 flex items-start gap-1 text-[11px] leading-tight text-destructive"
                                >
                                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                  <span>{fieldError("quantity_on_hand")}</span>
                                </p>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5">
                              <button
                                onClick={() => removeRow(row.row_index)}
                                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Remove row"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {productGroups.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No rows to import.
            </div>
          )}

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2 text-xs text-muted-foreground">
              <button
                onClick={() => setPage((p) => Math.max(0, Math.min(p, pageCount - 1) - 1))}
                disabled={safePage === 0}
                className="px-2 py-1 rounded-md border border-border disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {safePage + 1} of {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                className="px-2 py-1 rounded-md border border-border disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-border bg-card/95 p-4 shadow-[0_-8px_24px_-20px_rgba(0,0,0,0.4)] backdrop-blur-sm shrink-0 flex-wrap md:p-5">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Conflict policy
            </span>
            <Select
              value={policy}
              onValueChange={(v) => setPolicy(v as ConflictPolicy)}
            >
              <SelectTrigger className="h-8 w-[190px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(POLICY_META) as ConflictPolicy[]).map((key) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {POLICY_META[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground flex-1 min-w-[220px]">
            {POLICY_META[policy].hint}{" "}
            <span className="text-muted-foreground/80">
              {POLICY_META[policy].qtyHint} Leave Qty blank to keep stock as it is.
            </span>
          </p>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={rerunValidation}
              disabled={validating || importConfirm.isPending}
            >
              {validating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Revalidate
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={importConfirm.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={hasBlocking || validating || importConfirm.isPending || productGroups.length === 0}
              title={hasBlocking ? "Resolve the highlighted conflicts to continue" : undefined}
            >
              {importConfirm.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm Import
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
