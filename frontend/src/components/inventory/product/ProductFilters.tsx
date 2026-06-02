// src/components/inventory/product/ProductFilters.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Filter, X, Search, Package, Layers, RefreshCw } from "lucide-react";
import { Category } from "@/hooks/useCategories";
import { Brand } from "@/hooks/useBrands";

interface ProductFiltersProps {
  filters: {
    search: string;
    category: string;
    brand: string;
    status: string;
  };
  onChange: (filters: any) => void;
  categories: Category[];
  brands: Brand[];
}

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
  { value: "discontinued", label: "Discontinued" },
];

export default function ProductFilters({ filters, onChange, categories, brands }: ProductFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  useEffect(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.category) count++;
    if (filters.brand) count++;
    if (filters.status) count++;
    setActiveFilterCount(count);
  }, [filters]);

  const updateFilter = (key: string, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const clearFilter = (key: string) => {
    onChange({ ...filters, [key]: "" });
  };

  const clearAllFilters = () => {
    onChange({ search: "", category: "", brand: "", status: "" });
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by product name, SKU..."
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {filters.category && (
          <Badge variant="secondary" className="gap-1">
            {categories.find(c => String(c.id) === filters.category)?.name || filters.category}
            <button onClick={() => clearFilter("category")} className="ml-1"><X className="w-3 h-3" /></button>
          </Badge>
        )}
        {filters.brand && (
          <Badge variant="secondary" className="gap-1">
            {brands.find(b => String(b.id) === filters.brand)?.name || filters.brand}
            <button onClick={() => clearFilter("brand")} className="ml-1"><X className="w-3 h-3" /></button>
          </Badge>
        )}
        {filters.status && (
          <Badge variant="secondary" className="gap-1">
            Status: {statusOptions.find(s => s.value === filters.status)?.label || filters.status}
            <button onClick={() => clearFilter("status")} className="ml-1"><X className="w-3 h-3" /></button>
          </Badge>
        )}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs gap-1">
            <RefreshCw className="w-3 h-3" /> Clear all
          </Button>
        )}

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto gap-2">
              <Filter className="w-4 h-4" /> Filters
              {activeFilterCount > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{activeFilterCount}</Badge>}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[400px] overflow-y-auto">
            <SheetHeader><SheetTitle>Filter Products</SheetTitle></SheetHeader>
            <div className="mt-6 space-y-6">
              <div>
                <label className="text-sm font-medium flex items-center gap-2"><Package className="w-4 h-4" /> Category</label>
                <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                  <button onClick={() => { updateFilter("category", ""); setIsOpen(false); }} className={`w-full text-left px-2 py-1 text-sm rounded ${!filters.category ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>All Categories</button>
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => { updateFilter("category", String(cat.id)); setIsOpen(false); }} className={`w-full text-left px-2 py-1 text-sm rounded ${filters.category === String(cat.id) ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>{cat.name} ({cat.code})</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-2"><Layers className="w-4 h-4" /> Brand</label>
                <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                  <button onClick={() => { updateFilter("brand", ""); setIsOpen(false); }} className={`w-full text-left px-2 py-1 text-sm rounded ${!filters.brand ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>All Brands</button>
                  {brands.map(b => (
                    <button key={b.id} onClick={() => { updateFilter("brand", String(b.id)); setIsOpen(false); }} className={`w-full text-left px-2 py-1 text-sm rounded ${filters.brand === String(b.id) ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>{b.name} ({b.code})</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <div className="mt-2 space-y-1">
                  {statusOptions.map(opt => (
                    <button key={opt.value} onClick={() => { updateFilter("status", opt.value); setIsOpen(false); }} className={`w-full text-left px-2 py-1 text-sm rounded ${filters.status === opt.value ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>{opt.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t sticky bottom-0 bg-background">
              <div className="flex gap-2">
                <Button onClick={clearAllFilters} variant="outline" className="flex-1">Clear All</Button>
                <Button onClick={() => setIsOpen(false)} className="flex-1">Apply</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}