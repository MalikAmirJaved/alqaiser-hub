// src/components/inventory/pos/ProductSearchPanel.tsx
"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useAllVariantsSimple, VariantDetail } from "@/hooks/useAllVariants";
import { useProducts, Product } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useBrands } from "@/hooks/useBrands";
import { useBatchStock } from "@/hooks/useBatchStock";
import { ProductCard } from "./ProductCard";
import { useIncomingStock } from "@/hooks/useIncomingStock";
import debounce from "lodash/debounce";

interface ProductSearchPanelProps {
  onAddToCart: (variant: VariantDetail) => void;
  warehouseId?: string;
}

type Tab = "products" | "variants";

export function ProductSearchPanel({ onAddToCart, warehouseId }: ProductSearchPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("variants");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const { data: variants = [], isLoading: variantsLoading } = useAllVariantsSimple({
    search: debouncedSearch || undefined,
    active_only: true,
    product_id: selectedProduct?.id,
  });

  const { data: allProducts = [], isLoading: productsLoading } = useProducts({
    search: debouncedSearch || undefined,
    category: categoryId || undefined,
    brand: brandId || undefined,
    status: "active",
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
  
  // Filter variants (only if not filtering by product_id already)
  const filteredVariants = useMemo(() => {
    let filtered = variants;
    if (!selectedProduct) {
      if (categoryId) filtered = filtered.filter(v => v.category_id === categoryId);
      if (brandId) filtered = filtered.filter(v => v.brand_id === brandId);
    }
    return filtered;
  }, [variants, categoryId, brandId, selectedProduct]);
  
  // Collect visible variant IDs for batch stock fetch
  const visibleVariantIds = useMemo(() => {
    return filteredVariants.map(v => v.id);
  }, [filteredVariants]);

  const { data: incomingStockMap = {} } = useIncomingStock(visibleVariantIds);

  // Batch stock fetch
  const { data: stockMap, isLoading: stockLoading } = useBatchStock(
    visibleVariantIds,
    warehouseId || null
  );
  
  // Combine variants with their stock data
  const variantsWithStock = useMemo(() => {
    return filteredVariants.map(variant => ({
      ...variant,
      stock: stockMap?.[variant.id] || { available: 0, reserved: 0, on_hand: 0 },
      incoming: incomingStockMap[variant.id] || 0,   
    }));
  }, [filteredVariants, stockMap, incomingStockMap]);
  
  const isLoading = (activeTab === "variants" && variantsLoading) || 
                    (activeTab === "products" && !selectedProduct && productsLoading) ||
                    (selectedProduct && variantsLoading) ||
                    (warehouseId && stockLoading && visibleVariantIds.length > 0);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleBackToProducts = () => {
    setSelectedProduct(null);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with Tabs and Search */}
      <div className="p-4 border-b border-border bg-card/50">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex bg-muted p-1 rounded-xl w-fit">
              <button
                onClick={() => { setActiveTab("products"); setSelectedProduct(null); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "products" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Products
              </button>
              <button
                onClick={() => { setActiveTab("variants"); setSelectedProduct(null); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "variants" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Variants
              </button>
            </div>

            <div className="flex-1 max-w-sm relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <SearchIcon size={16} />
              </div>
              <input
                value={search}
                onChange={handleSearchChange}
                placeholder={selectedProduct ? `Search variants of ${selectedProduct.product_name}...` : "Search by name, SKU, barcode..."}
                className="w-full bg-muted border border-transparent focus:border-primary/20 focus:bg-background rounded-xl pl-10 pr-10 py-2 text-sm outline-none transition-all placeholder:text-muted-foreground/60"
                autoFocus
              />
              {search && (
                <button 
                  onClick={() => { setSearch(""); setDebouncedSearch(""); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
          </div>

          {!selectedProduct && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <FilterIcon size={14} className="text-muted-foreground" />
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="bg-muted border-none rounded-lg px-3 py-1.5 text-xs font-medium outline-none cursor-pointer hover:bg-muted/80 transition-colors"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="bg-muted border-none rounded-lg px-3 py-1.5 text-xs font-medium outline-none cursor-pointer hover:bg-muted/80 transition-colors"
                >
                  <option value="">All Brands</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              {(categoryId || brandId) && (
                <button
                  onClick={() => { setCategoryId(""); setBrandId(""); }}
                  className="text-xs text-primary font-medium hover:underline px-2"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {selectedProduct && (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
              <button
                onClick={handleBackToProducts}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-colors"
              >
                <ArrowLeftIcon size={14} />
                Back to Products
              </button>
              <div className="h-4 w-px bg-border mx-1" />
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Product</span>
                <span className="text-sm font-bold truncate max-w-[250px]">{selectedProduct.product_name}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <span className="text-xs font-medium text-muted-foreground animate-pulse">Loading items...</span>
          </div>
        ) : (
          <>
            {/* Products Tab View */}
            {activeTab === "products" && !selectedProduct && (
              <>
                {allProducts.length === 0 ? (
                  <EmptyState search={search} onClear={() => { setSearch(""); setDebouncedSearch(""); }} />
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-200">
                    {allProducts.map((product) => (
                      <ProductListCard 
                        key={product.id} 
                        product={product} 
                        onClick={() => handleProductClick(product)} 
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Variants View (either all or for specific product) */}
            {(activeTab === "variants" || selectedProduct) && (
              <>
                {variantsWithStock.length === 0 ? (
                  <EmptyState 
                    search={search} 
                    onClear={() => { setSearch(""); setDebouncedSearch(""); }} 
                    message={selectedProduct ? "No variants found for this product" : "No variants found"}
                  />
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-200">
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
              </>
            )}
          </>
        )}
      </div>

      {/* Footer Info */}
      {!isLoading && (
        <div className="px-4 py-3 border-t border-border bg-muted/30 backdrop-blur-sm flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          <div className="flex items-center gap-4">
            {activeTab === "products" && !selectedProduct ? (
              <span>{allProducts.length} Products Found</span>
            ) : (
              <span>{variantsWithStock.length} Variants Shown</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Live Inventory
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components
function ProductListCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const variantCount = product.variants?.length || 0;
  
  return (
    <button
      onClick={onClick}
      className="group flex flex-col bg-card border border-border rounded-xl p-4 text-left transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98]"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <BoxIcon size={20} />
          </div>
          <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground uppercase">
            {variantCount} {variantCount === 1 ? "Variant" : "Variants"}
          </span>
        </div>
        <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
          {product.product_name}
        </h3>
        {product.description && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic leading-relaxed">
            {product.description}
          </p>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {product.unit || "Units"}
        </span>
        <ArrowRightIcon size={14} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </div>
    </button>
  );
}

function EmptyState({ search, onClear, message }: { search: string; onClear: () => void; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center text-muted-foreground mb-4">
        <SearchIcon size={32} />
      </div>
      <h3 className="text-base font-bold text-foreground">{message || "No products found"}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">
        {search ? `We couldn't find anything matching "${search}"` : "Try adjusting your filters or search terms"}
      </p>
      {search && (
        <button
          onClick={onClear}
          className="mt-6 text-sm font-bold text-primary hover:underline flex items-center gap-2"
        >
          Clear search results
        </button>
      )}
    </div>
  );
}

// Icons
function SearchIcon({ size = 16 }: { size?: number }) { 
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>; 
}

function XIcon({ size = 16 }: { size?: number }) { 
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>; 
}

function BoxIcon({ size = 20 }: { size?: number }) { 
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>; 
}

function FilterIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>;
}

function ArrowLeftIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>;
}

function ArrowRightIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>;
}