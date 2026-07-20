// src/components/inventory/product/ImportReviewModal.tsx
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useImportConfirm } from "@/hooks/useProductExportImport";
import type { ImportRow } from "@/hooks/useProductExportImport";
import { useBrands, type Brand } from "@/hooks/useBrands";
import { useCategories, type Category } from "@/hooks/useCategories";

interface ImportReviewModalProps {
  open: boolean;
  onClose: () => void;
  rows: ImportRow[];
  source: string;
}

// ──────────────────────────────────────────────────────
// Validation helpers
// ──────────────────────────────────────────────────────

interface RowError {
  row_index: number;
  field: string;
  message: string;
}

function validateRows(rows: ImportRow[]): RowError[] {
  const errors: RowError[] = [];
  const seenSkus = new Set<string>();

  rows.forEach((row, idx) => {
    if (!row.product_name?.trim()) {
      errors.push({ row_index: row.row_index, field: "product_name", message: "Product name is required" });
    }
    if (row.selling_price < 0) {
      errors.push({ row_index: row.row_index, field: "selling_price", message: "Selling price cannot be negative" });
    }
    if (row.buying_price < 0) {
      errors.push({ row_index: row.row_index, field: "buying_price", message: "Buying price cannot be negative" });
    }
    if (row.variant_sku) {
      if (seenSkus.has(row.variant_sku)) {
        errors.push({ row_index: row.row_index, field: "variant_sku", message: `Duplicate SKU: ${row.variant_sku}` });
      }
      seenSkus.add(row.variant_sku);
    }
  });

  return errors;
}

// ──────────────────────────────────────────────────────
// Group rows by product
// ──────────────────────────────────────────────────────

interface ProductGroup {
  product_name: string;
  rows: ImportRow[];
  collapsed: boolean;
}

// ──────────────────────────────────────────────────────
// Searchable Select (inline component)
// ──────────────────────────────────────────────────────

function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  isNew,
}: {
  value: string;
  options: { id: string; name: string }[];
  onChange: (id: string | null, name: string, isNew: boolean) => void;
  placeholder: string;
  isNew: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      options.filter((o) =>
        o.name.toLowerCase().includes(search.toLowerCase())
      ),
    [options, search]
  );

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
          isNew
            ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700"
            : "border-border hover:border-muted-foreground/40"
        }`}
        onClick={() => setOpen(!open)}
      >
        <span className="flex-1 truncate">
          {value || <span className="text-muted-foreground">{placeholder}</span>}
        </span>
        {isNew && (
          <Badge
            variant="outline"
            className="text-[10px] px-1 py-0 h-4 font-bold text-amber-600 border-amber-300 bg-amber-100 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-950/40"
          >
            NEW
          </Badge>
        )}
        <Search className="w-3 h-3 text-muted-foreground shrink-0" />
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-card border border-border rounded-xl shadow-xl p-1.5 space-y-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-7 text-xs"
              autoFocus
            />
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {filtered.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    onChange(opt.id, opt.name, false);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-muted ${
                    value === opt.name ? "bg-primary/10 font-medium" : ""
                  }`}
                >
                  {opt.name}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No matches
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────

export default function ImportReviewModal({
  open,
  onClose,
  rows: initialRows,
  source,
}: ImportReviewModalProps) {
  // Sync state when initialRows changes (modal is always mounted via open prop)
  const [rows, setRows] = useState<ImportRow[]>(initialRows);
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const [collapsedProducts, setCollapsedProducts] = useState<Set<string>>(new Set());
  const importConfirm = useImportConfirm();
  const [success, setSuccess] = useState<{
    products: number;
    variants: number;
  } | null>(null);
  const [serverErrors, setServerErrors] = useState<{ row_index: number; error: string }[]>([]);

  // Fetch existing brands/categories for dropdowns
  const { data: brands = [] } = useBrands({ all: "true", page_size: "1000" });
  const { data: categories = [] } = useCategories({ all: "true", page_size: "1000" });

  const brandOptions = useMemo(
    () => brands.map((b: Brand) => ({ id: b.id, name: b.name })),
    [brands]
  );
  const categoryOptions = useMemo(
    () => categories.map((c: Category) => ({ id: c.id, name: c.name })),
    [categories]
  );

  // Validation
  const validationErrors = useMemo(() => validateRows(rows), [rows]);
  const hasErrors = validationErrors.length > 0;

  // Derive product groups from rows + collapsed state
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

  const handleBrandChange = useCallback(
    (rowIndex: number, id: string | null, name: string, isNew: boolean) => {
      updateRow(rowIndex, "brand_id", id);
      updateRow(rowIndex, "brand_name", name);
      updateRow(rowIndex, "brand_is_new", isNew);
    },
    [updateRow]
  );

  const handleCategoryChange = useCallback(
    (rowIndex: number, id: string | null, name: string, isNew: boolean) => {
      updateRow(rowIndex, "category_id", id);
      updateRow(rowIndex, "category_name", name);
      updateRow(rowIndex, "category_is_new", isNew);
    },
    [updateRow]
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

      // Clone a template row from an existing variant of this product, or create a blank one
      const existingRows = prev.filter((r) => r.product_name === productName);
      const templateRow = existingRows[0];

      const newRow: ImportRow = {
        row_index: newRowIndex,
        product_name: productName,
        product_description: templateRow?.product_description || '',
        category_id: templateRow?.category_id || null,
        category_name: templateRow?.category_name || '',
        category_is_new: templateRow?.category_is_new || false,
        brand_id: templateRow?.brand_id || null,
        brand_name: templateRow?.brand_name || '',
        brand_is_new: templateRow?.brand_is_new || false,
        unit: templateRow?.unit || 'PIECE',
        storage_requirement: templateRow?.storage_requirement || 'AMBIENT',
        tax_rate: templateRow?.tax_rate || 0,
        status: templateRow?.status || 'active',
        variant_sku: '',
        variant_title: '',
        variant_barcode: '',
        buying_price: 0,
        selling_price: 0,
        min_stock_level: 0,
        max_stock_level: 0,
      };

      return [...prev, newRow];
    });
  }, []);

  const toggleCollapse = useCallback((productName: string) => {
    setCollapsedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productName)) {
        next.delete(productName);
      } else {
        next.add(productName);
      }
      return next;
    });
  }, []);

  const handleConfirm = async () => {
    if (hasErrors) return;
    setServerErrors([]);
    try {
      const result = await importConfirm.mutateAsync({ rows, source });
      setSuccess({
        products: result.data.products_created,
        variants: result.data.variants_created,
      });
    } catch (err: any) {
      if (err.response?.errors) {
        setServerErrors(err.response.errors);
      }
    }
  };

  const handleClose = () => {
    setSuccess(null);
    setServerErrors([]);
    onClose();
  };

  // Count total variants
  const totalVariants = rows.length;

  if (!open) return null;

  // Success screen
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-success" />
          </div>
          <h2 className="text-xl font-semibold">Import Complete</h2>
          <p className="text-sm text-muted-foreground">
            {success.products} product(s) and {success.variants} variant(s) created
            successfully.
          </p>
          <Button onClick={handleClose} className="mt-2">
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-5xl mx-4 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Review &amp; Edit</h2>
              <p className="text-xs text-muted-foreground">
                {productGroups.length} product(s) &middot; {totalVariants} variant(s)
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation Bar */}
        {validationErrors.length > 0 && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Please fix the following errors:</p>
                <ul className="mt-1 space-y-0.5 text-xs list-disc list-inside">
                  {validationErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>
                      Row {err.row_index + 1}: {err.message}
                    </li>
                  ))}
                  {validationErrors.length > 5 && (
                    <li className="text-muted-foreground">
                      ...and {validationErrors.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Server Errors */}
        {serverErrors.length > 0 && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Server returned errors:</p>
                <ul className="mt-1 space-y-0.5 text-xs list-disc list-inside">
                  {serverErrors.map((err, i) => (
                    <li key={i}>
                      Row {err.row_index + 1}: {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {productGroups.map((group) => (
            <div
              key={group.product_name}
              className="rounded-xl border border-border overflow-hidden"
            >
              {/* Product Header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
                <button
                  onClick={() => toggleCollapse(group.product_name)}
                  className="p-0.5 rounded hover:bg-muted transition-colors"
                >
                  {group.collapsed ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                <span className="text-sm font-semibold flex-1 truncate">
                  {group.product_name}
                </span>
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
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/10">
                        <th className="px-2.5 py-2 text-left font-medium text-muted-foreground">
                          SKU
                        </th>
                        <th className="px-2.5 py-2 text-left font-medium text-muted-foreground">
                          Variant Name
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
                        <th className="px-2.5 py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => {
                        const hasSkuError = validationErrors.some(
                          (e) =>
                            e.row_index === row.row_index &&
                            e.field === "variant_sku"
                        );

                        return (
                          <tr
                            key={row.row_index}
                            className="border-b border-border/50 last:border-b-0 hover:bg-muted/20 transition-colors"
                          >
                            <td className="px-2.5 py-1.5">
                              <Input
                                value={row.variant_sku}
                                onChange={(e) =>
                                  updateRow(row.row_index, "variant_sku", e.target.value)
                                }
                                className={`h-7 text-xs ${
                                  hasSkuError ? "border-destructive" : ""
                                }`}
                                placeholder="SKU"
                              />
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
                            <td className="px-2.5 py-1.5 min-w-[140px]">
                              <SearchableSelect
                                value={row.category_name}
                                options={categoryOptions}
                                onChange={(id, name, isNew) =>
                                  handleCategoryChange(
                                    row.row_index,
                                    id,
                                    name,
                                    isNew
                                  )
                                }
                                placeholder="Select category"
                                isNew={row.category_is_new}
                              />
                            </td>
                            <td className="px-2.5 py-1.5 min-w-[140px]">
                              <SearchableSelect
                                value={row.brand_name}
                                options={brandOptions}
                                onChange={(id, name, isNew) =>
                                  handleBrandChange(row.row_index, id, name, isNew)
                                }
                                placeholder="Select brand"
                                isNew={row.brand_is_new}
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
                                className="h-7 text-xs text-right"
                                min="0"
                                step="0.01"
                              />
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
                                className="h-7 text-xs text-right"
                                min="0"
                                step="0.01"
                              />
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
                                className="h-7 text-xs text-right"
                                min="0"
                              />
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
                                className="h-7 text-xs text-right"
                                min="0"
                              />
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-border bg-muted/20 shrink-0">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{productGroups.length}</span> product(s) &middot;{" "}
            <span className="font-medium">{totalVariants}</span> variant(s)
            {validationErrors.length > 0 && (
              <span className="ml-2 text-destructive">
                &middot; {validationErrors.length} error(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={importConfirm.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={hasErrors || importConfirm.isPending || productGroups.length === 0}
            >
              {importConfirm.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm &amp; Create
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
