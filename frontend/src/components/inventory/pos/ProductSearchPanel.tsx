// src/components/inventory/pos/ProductSearchPanel.tsx
"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useAllVariantsSimple, VariantDetail } from "@/hooks/useAllVariants";
import { useCategories } from "@/hooks/useCategories";
import { useBrands } from "@/hooks/useBrands";
import { useBatchStock } from "@/hooks/useBatchStock";
import { ProductCard } from "./ProductCard";
import debounce from "lodash/debounce";

interface ProductSearchPanelProps {
  onAddToCart: (variant: VariantDetail) => void;
  warehouseId?: string;
}

export function ProductSearchPanel({ onAddToCart, warehouseId }: ProductSearchPanelProps) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  const { data: variants = [], isLoading: variantsLoading } = useAllVariantsSimple({
    search: debouncedSearch || undefined,
    active_only: true,
  });
  
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  
  // Debounced search handler
  const debouncedSetSearch = useCallback(
    debounce((value: string) => setDebouncedSearch(value), 300),
    []
  );
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    debouncedSetSearch(value);
  };
  
  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [debouncedSetSearch]);
  
  // Filter variants
  const filteredVariants = useMemo(() => {
    let filtered = variants;
    if (categoryId) filtered = filtered.filter(v => v.category_id === categoryId);
    if (brandId) filtered = filtered.filter(v => v.brand_id === brandId);
    return filtered;
  }, [variants, categoryId, brandId]);
  
  // Collect visible variant IDs for batch stock fetch
  const visibleVariantIds = useMemo(() => {
    return filteredVariants.map(v => v.id);
  }, [filteredVariants]);
  
  // Batch stock fetch
  const { data: stockMap, isLoading: stockLoading } = useBatchStock(
    visibleVariantIds,
    warehouseId || null
  );
  
  // Combine variants with their stock data
  const variantsWithStock = useMemo(() => {
    return filteredVariants.map(variant => ({
      ...variant,
      stock: stockMap?.[variant.id] || { available: 0, reserved: 0, on_hand: 0 }
    }));
  }, [filteredVariants, stockMap]);
  
  const isLoading = variantsLoading || (warehouseId && stockLoading);
  
  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
          <SearchIcon />
          <input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by name, SKU, barcode… (F2)"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {search && (
            <button onClick={() => {
              setSearch("");
              setDebouncedSearch("");
            }} className="text-muted-foreground hover:text-foreground">
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
        {(categoryId || brandId) && (
          <button
            onClick={() => {
              setCategoryId("");
              setBrandId("");
            }}
            className="text-xs text-muted-foreground hover:text-primary px-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : variantsWithStock.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
            <BoxIcon />
            <span>No products found</span>
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setDebouncedSearch("");
                }}
                className="text-primary text-xs hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {variantsWithStock.map((variant) => (
              <ProductCard 
                key={variant.id} 
                variant={variant}
                stockData={variant.stock}
                onAdd={() => onAddToCart(variant)} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Results Count */}
      {!isLoading && variantsWithStock.length > 0 && (
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground bg-muted/20">
          Showing {variantsWithStock.length} of {variants.length} products
        </div>
      )}
    </div>
  );
}

// Icons
function SearchIcon() { 
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>; 
}

function XIcon({ size = 16 }: { size?: number }) { 
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>; 
}

function BoxIcon() { 
  return <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>; 
}