// src/components/inventory/pos/ProductSearchPanel.tsx
"use client";
import { useState } from "react";
import { useAllVariantsSimple, VariantDetail } from "@/hooks/useAllVariants";
import { useCategories } from "@/hooks/useCategories";
import { useBrands } from "@/hooks/useBrands";
import { ProductCard } from "./ProductCard";

interface ProductSearchPanelProps {
  onAddToCart: (variant: VariantDetail) => void;
}

export function ProductSearchPanel({ onAddToCart }: ProductSearchPanelProps) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  
  const { data: variants = [], isLoading: variantsLoading } = useAllVariantsSimple({
    search: search || undefined,
    active_only: true,
  });
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();

  const filteredVariants = variants.filter((v) => {
    if (categoryId && v.category_id !== categoryId) return false;
    if (brandId && v.brand_id !== brandId) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
          <SearchIcon />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, barcode… (F2)"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
              <XIcon size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 flex gap-2 border-b border-border">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="bg-muted border border-border rounded-md px-2 py-1 text-xs outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="bg-muted border border-border rounded-md px-2 py-1 text-xs outline-none"
        >
          <option value="">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {variantsLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading products…</div>
        ) : filteredVariants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
            <BoxIcon />
            <span>No products found</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredVariants.map((v) => (
              <ProductCard key={v.id} variant={v} onAdd={() => onAddToCart(v)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Icons (keep inline for simplicity)
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>; }
function XIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function BoxIcon() { return <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>; }