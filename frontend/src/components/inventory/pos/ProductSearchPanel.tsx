// src/components/inventory/pos/ProductSearchPanel.tsx
"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { usePosCatalog, type PosCatalogProduct, type PosVariant } from "@/hooks/usePosCatalog";
import { useCategories } from "@/hooks/useCategories";
import { useBrands } from "@/hooks/useBrands";
import { ProductCard } from "./ProductCard";
import debounce from "lodash/debounce";

const PAGE_SIZE = 20;

interface ProductSearchPanelProps {
  onAddToCart: (variant: PosVariant & { product_name: string; product_id: string }) => void;
  warehouseId?: string;
}

type Tab = "products" | "variants";

export function ProductSearchPanel({ onAddToCart, warehouseId }: ProductSearchPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("variants");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<PosCatalogProduct | null>(null);

  // ── Infinite scroll state ──
  const [page, setPage] = useState(1);
  const [allVariants, setAllVariants] = useState<(PosVariant & { product_name: string; product_id: string })[]>([]);
  const [allProducts, setAllProducts] = useState<PosCatalogProduct[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const resetInfiniteScroll = useCallback(() => {
    setPage(1);
    setAllVariants([]);
    setAllProducts([]);
    setHasMore(true);
    setTotalCount(0);
  }, []);

  const catalogFilters = useMemo(() => ({
    warehouse_id: warehouseId || "",
    search: debouncedSearch || undefined,
    category_id: categoryId || undefined,
    brand_id: brandId || undefined,
    page,
    page_size: PAGE_SIZE,
  }), [warehouseId, debouncedSearch, categoryId, brandId, page]);

  const { data: catalogResponse, isLoading, isFetching } = usePosCatalog(catalogFilters);

  // Accumulate data when a new page arrives
  useEffect(() => {
    if (catalogResponse?.results && catalogResponse.page === page) {
      const newProducts = catalogResponse.results;
      const newVariants = newProducts.flatMap(p =>
        p.variants.map(v => ({ ...v, product_name: p.product_name, product_id: p.id }))
      );

      if (page === 1) {
        setAllProducts(newProducts);
        setAllVariants(newVariants);
      } else {
        setAllProducts(prev => [...prev, ...newProducts]);
        setAllVariants(prev => [...prev, ...newVariants]);
      }

      setTotalCount(catalogResponse.count);
      const totalPages = Math.ceil(catalogResponse.count / PAGE_SIZE);
      setHasMore(page < totalPages);
    }
  }, [catalogResponse, page]);

  // Reset when filters change
  useEffect(() => {
    resetInfiniteScroll();
  }, [warehouseId, debouncedSearch, categoryId, brandId]);

  // ── IntersectionObserver for infinite scroll ──
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isFetching) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPage(p => p + 1);
        }
      },
      { threshold: 0.1, rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isFetching]);

  // ── Categories & Brands ──
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();

  // ── Search ──
  const debouncedSetSearch = useCallback(
    debounce((value: string) => setDebouncedSearch(value), 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    resetInfiniteScroll();
    debouncedSetSearch(value);
  };

  useEffect(() => {
    return () => { debouncedSetSearch.cancel(); };
  }, [debouncedSetSearch]);

  // ── Handlers ──
  const handleProductClick = (product: PosCatalogProduct) => {
    setSelectedProduct(product);
    resetInfiniteScroll();
  };

  const handleBackToProducts = () => {
    setSelectedProduct(null);
    resetInfiniteScroll();
  };

  const isFirstLoad = isLoading && page === 1;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Header with Tabs and Search ── */}
      <div className="p-4 border-b border-border bg-card/50">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex bg-muted p-1 rounded-xl w-fit">
              <button
                onClick={() => { setActiveTab("products"); setSelectedProduct(null); resetInfiniteScroll(); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "products" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Products
              </button>
              <button
                onClick={() => { setActiveTab("variants"); setSelectedProduct(null); resetInfiniteScroll(); }}
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
                  onClick={() => { setSearch(""); setDebouncedSearch(""); resetInfiniteScroll(); }}
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

      {/* ── Main Content Area ── */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {isFirstLoad ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <span className="text-xs font-medium text-muted-foreground animate-pulse">Loading items...</span>
          </div>
        ) : (
          <>
            {/* ── Products Tab ── */}
            {activeTab === "products" && !selectedProduct && (
              <>
                {allProducts.length === 0 ? (
                  <EmptyState search={search} onClear={() => { setSearch(""); setDebouncedSearch(""); resetInfiniteScroll(); }} />
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

            {/* ── Variants Tab (default, also shown when product selected) ── */}
            {(activeTab === "variants" || selectedProduct) && (
              <>
                {allVariants.length === 0 ? (
                  <EmptyState 
                    search={search} 
                    onClear={() => { setSearch(""); setDebouncedSearch(""); resetInfiniteScroll(); }} 
                    message={selectedProduct ? "No variants found for this product" : "No variants found"}
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-200">
                      {allVariants.map((variant) => (
                        <ProductCard 
                          key={variant.id} 
                          variant={variant}
                          stockData={variant.stock}
                          onAdd={() => onAddToCart(variant)} 
                        />
                      ))}
                    </div>

                    {/* Infinite scroll sentinel */}
                    {hasMore && (
                      <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-4">
                        {isFetching && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                            Loading more...
                          </div>
                        )}
                      </div>
                    )}

                    {!hasMore && allVariants.length > 0 && (
                      <div className="text-center text-xs text-muted-foreground py-4">
                        Showing all {totalCount} variants
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Footer Info ── */}
      {!isFirstLoad && (
        <div className="px-4 py-3 border-t border-border bg-muted/30 backdrop-blur-sm flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          <div className="flex items-center gap-4">
            {activeTab === "products" && !selectedProduct ? (
              <span>{totalCount} Products with stock</span>
            ) : selectedProduct ? (
              <span>{selectedProduct.variant_count} Variants</span>
            ) : (
              <span>{totalCount} Variants total · Loaded {allVariants.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isFetching ? "bg-warning animate-pulse" : "bg-success"}`} />
            {isFetching ? "Loading..." : "Live Inventory"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function ProductListCard({ product, onClick }: { product: PosCatalogProduct; onClick: () => void }) {
  const variantCount = product.variant_count || 0;
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
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic leading-relaxed">{product.description}</p>
        )}
      </div>
      <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{product.unit || "Units"}</span>
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
        <button onClick={onClear} className="mt-6 text-sm font-bold text-primary hover:underline flex items-center gap-2">
          Clear search results
        </button>
      )}
    </div>
  );
}

// ── Icons ──

function SearchIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>;
}

function XIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}

function BoxIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>;
}

function FilterIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>;
}

function ArrowLeftIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
}

function ArrowRightIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
}
