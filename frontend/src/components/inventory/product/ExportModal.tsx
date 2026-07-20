// src/components/inventory/product/ExportModal.tsx
"use client";

import { useState } from "react";
import { X, Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useExportProducts } from "@/hooks/useProductExportImport";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  hasSelection: boolean;
  selectedProductIds?: string[];
  fetchCategories?: (params: { search: string; page: number; pageSize: number }) => Promise<{ options: { value: string; label: string }[]; hasMore: boolean; totalCount: number }>;
  fetchBrands?: (params: { search: string; page: number; pageSize: number }) => Promise<{ options: { value: string; label: string }[]; hasMore: boolean; totalCount: number }>;
}

// ── Inline searchable select (reused from the codebase pattern) ──

function FilterSelect({
  label,
  value,
  onChange,
  fetchOptions,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  fetchOptions?: (params: { search: string; page: number; pageSize: number }) => Promise<{ options: { value: string; label: string }[]; hasMore: boolean; totalCount: number }>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedLabel = options.find((o) => o.value === value)?.label || "";

  const handleOpen = async () => {
    setOpen(true);
    if (!options.length && fetchOptions) {
      setLoading(true);
      try {
        const result = await fetchOptions({ search: "", page: 1, pageSize: 50 });
        setOptions(result.options);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (fetchOptions) {
      setLoading(true);
      try {
        const result = await fetchOptions({ search: q, page: 1, pageSize: 50 });
        setOptions(result.options);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="relative">
      <label className="text-xs font-medium mb-1.5 block text-muted-foreground">{label}</label>
      <div
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border cursor-pointer hover:border-muted-foreground/40 transition-colors text-sm"
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 truncate">
          {selectedLabel || <span className="text-muted-foreground">All {label.toLowerCase()}s</span>}
        </span>
        {value && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(""); setSearch(""); }}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-xl p-1.5 space-y-1">
            <Input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search..."
              className="h-7 text-xs"
              autoFocus
            />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {loading ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading...</p>
              ) : options.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No matches</p>
              ) : (
                <>
                  <button
                    onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-muted ${
                      !value ? "bg-primary/10 font-medium" : ""
                    }`}
                  >
                    All {label.toLowerCase()}s
                  </button>
                  {options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { onChange(opt.value); setOpen(false); setSearch(""); }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-muted ${
                        value === opt.value ? "bg-primary/10 font-medium" : ""
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Export Modal ──

export default function ExportModal({
  open,
  onClose,
  hasSelection,
  selectedProductIds = [],
  fetchCategories,
  fetchBrands,
}: ExportModalProps) {
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const exportMutation = useExportProducts();

  if (!open) return null;

  const handleExport = async () => {
    await exportMutation.mutateAsync({
      format,
      product_ids: scope === "selected" ? selectedProductIds : undefined,
      category: category || undefined,
      brand: brand || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Export Products</h2>
              <p className="text-xs text-muted-foreground">Choose export options</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Scope Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Scope</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  scope === "all"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/20"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    scope === "all" ? "border-primary" : "border-muted-foreground/40"
                  }`}
                >
                  {scope === "all" && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">All Products</p>
                  <p className="text-xs text-muted-foreground">Export entire catalog</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setScope("selected")}
                disabled={!hasSelection}
                className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  !hasSelection
                    ? "border-border/40 opacity-40 cursor-not-allowed"
                    : scope === "selected"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/20"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    scope === "selected" ? "border-primary" : "border-muted-foreground/40"
                  }`}
                >
                  {scope === "selected" && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Selected Only</p>
                  <p className="text-xs text-muted-foreground">
                    {hasSelection
                      ? `${selectedProductIds.length} product(s) selected`
                      : "Select products from table"}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Category / Brand Filters */}
          <div className="grid grid-cols-2 gap-3">
            <FilterSelect
              label="Category"
              value={category}
              onChange={setCategory}
              fetchOptions={fetchCategories}
            />
            <FilterSelect
              label="Brand"
              value={brand}
              onChange={setBrand}
              fetchOptions={fetchBrands}
            />
          </div>

          {/* Format Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  format === "xlsx"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/20"
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                <div className="text-left">
                  <p className="text-sm font-medium">Excel (.xlsx)</p>
                  <p className="text-xs text-muted-foreground">Recommended</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  format === "csv"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/20"
                }`}
              >
                <FileText className="w-5 h-5 text-blue-500" />
                <div className="text-left">
                  <p className="text-sm font-medium">CSV (.csv)</p>
                  <p className="text-xs text-muted-foreground">Plain text</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-border bg-muted/20">
          <Button type="button" variant="outline" onClick={onClose} disabled={exportMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
