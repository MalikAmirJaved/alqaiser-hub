// src/components/inventory/product/ProductFilters.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Filter,
  X,
  ChevronDown,
  Tag,
  Package,
  Layers,
  DollarSign,
  TrendingUp,
  Star,
  Clock,
  RefreshCw,
} from "lucide-react";

interface ProductFiltersProps {
  filters: {
    category: string;
    brand: string;
    status: string;
    minPrice: string;
    maxPrice: string;
    stockStatus: string;
    tags: string[];
    productType: string;
    sortBy: string;
    sortOrder: string;
  };
  onChange: (filters: any) => void;
  categories: any[];
  brands: any[];
  tags?: any[];
}

export default function ProductFilters({
  filters,
  onChange,
  categories,
  brands,
  tags = [],
}: ProductFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    parseInt(filters.minPrice) || 0,
    parseInt(filters.maxPrice) || 100000,
  ]);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // Count active filters
  useEffect(() => {
    let count = 0;
    if (filters.category) count++;
    if (filters.brand) count++;
    if (filters.status) count++;
    if (filters.minPrice) count++;
    if (filters.maxPrice) count++;
    if (filters.stockStatus) count++;
    if (filters.productType) count++;
    if (filters.tags.length > 0) count += filters.tags.length;
    setActiveFilterCount(count);
  }, [filters]);

  const updateFilter = (key: string, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const clearFilter = (key: string) => {
    onChange({ ...filters, [key]: key === "tags" ? [] : "" });
  };

  const clearAllFilters = () => {
    onChange({
      category: "",
      brand: "",
      status: "",
      minPrice: "",
      maxPrice: "",
      stockStatus: "",
      tags: [],
      productType: "",
      sortBy: "",
      sortOrder: "asc",
    });
    setPriceRange([0, 100000]);
  };

  const toggleTag = (tagId: string) => {
    const currentTags = filters.tags;
    if (currentTags.includes(tagId)) {
      updateFilter("tags", currentTags.filter((id: string) => id !== tagId));
    } else {
      updateFilter("tags", [...currentTags, tagId]);
    }
  };

  const handlePriceRangeChange = (values: number[]) => {
    setPriceRange([values[0], values[1]]);
  };

  const applyPriceRange = () => {
    updateFilter("minPrice", priceRange[0].toString());
    updateFilter("maxPrice", priceRange[1].toString());
  };

  const sortOptions = [
    { value: "name_asc", label: "Name (A-Z)" },
    { value: "name_desc", label: "Name (Z-A)" },
    { value: "price_asc", label: "Price (Low to High)" },
    { value: "price_desc", label: "Price (High to Low)" },
    { value: "stock_asc", label: "Stock (Low to High)" },
    { value: "stock_desc", label: "Stock (High to Low)" },
    { value: "created_desc", label: "Newest First" },
    { value: "created_asc", label: "Oldest First" },
  ];

  const productTypes = [
    { value: "simple", label: "Simple Products", icon: Package },
    { value: "variable", label: "Variable Products", icon: Layers },
    { value: "bundle", label: "Bundle Products", icon: Package },
    { value: "digital", label: "Digital Products", icon: Package },
    { value: "service", label: "Services", icon: Package },
  ];

  const stockStatuses = [
    { value: "in", label: "In Stock", color: "text-success" },
    { value: "low", label: "Low Stock (<10)", color: "text-warning" },
    { value: "out", label: "Out of Stock", color: "text-destructive" },
  ];

  const statuses = [
    { value: "active", label: "Active", color: "text-success" },
    { value: "draft", label: "Draft", color: "text-warning" },
    { value: "archived", label: "Archived", color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-3">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort Dropdown */}
        <Select
          value={filters.sortBy ? `${filters.sortBy}_${filters.sortOrder}` : ""}
          onValueChange={(val) => {
            const [sortBy, sortOrder] = val.split("_");
            updateFilter("sortBy", sortBy);
            updateFilter("sortOrder", sortOrder);
          }}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Active Filter Chips */}
        {filters.category && (
          <Badge variant="secondary" className="gap-1 px-2 py-1">
            {categories.find(c => c.id === filters.category)?.name || filters.category}
            <button onClick={() => clearFilter("category")} className="ml-1 hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        )}
        
        {filters.brand && (
          <Badge variant="secondary" className="gap-1 px-2 py-1">
            {brands.find(b => b.id === filters.brand)?.name || filters.brand}
            <button onClick={() => clearFilter("brand")} className="ml-1 hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        )}
        
        {filters.status && (
          <Badge variant="secondary" className="gap-1 px-2 py-1">
            Status: {filters.status}
            <button onClick={() => clearFilter("status")} className="ml-1 hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        )}
        
        {filters.stockStatus && (
          <Badge variant="secondary" className="gap-1 px-2 py-1">
            Stock: {stockStatuses.find(s => s.value === filters.stockStatus)?.label}
            <button onClick={() => clearFilter("stockStatus")} className="ml-1 hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        )}
        
        {filters.productType && (
          <Badge variant="secondary" className="gap-1 px-2 py-1">
            Type: {productTypes.find(t => t.value === filters.productType)?.label}
            <button onClick={() => clearFilter("productType")} className="ml-1 hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        )}
        
        {(filters.minPrice || filters.maxPrice) && (
          <Badge variant="secondary" className="gap-1 px-2 py-1">
            Price: ${filters.minPrice || 0} - ${filters.maxPrice || "∞"}
            <button onClick={() => {
              clearFilter("minPrice");
              clearFilter("maxPrice");
              setPriceRange([0, 100000]);
            }} className="ml-1 hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        )}
        
        {filters.tags.map((tagId: string) => {
          const tag = tags.find(t => t.id === tagId);
          return tag ? (
            <Badge
              key={tagId}
              style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined }}
              className="gap-1 px-2 py-1"
            >
              <Tag className="w-3 h-3" style={{ color: tag.color }} />
              {tag.name}
              <button onClick={() => toggleTag(tagId)} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ) : null;
        })}
        
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-8 text-xs gap-1 text-muted-foreground"
          >
            <RefreshCw className="w-3 h-3" /> Clear all
          </Button>
        )}

        {/* Filter Button */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto gap-2">
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[400px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filter Products</SheetTitle>
              <SheetDescription>
                Refine your product list with advanced filters
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Category Filter */}
              <Accordion type="single" collapsible defaultValue="category">
                <AccordionItem value="category">
                  <AccordionTrigger className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Category
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          updateFilter("category", "");
                          setIsOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors ${
                          !filters.category ? "bg-primary/10 text-primary" : "hover:bg-muted"
                        }`}
                      >
                        All Categories
                      </button>
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => {
                            updateFilter("category", category.id);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors ${
                            filters.category === category.id
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          {category.name}
                          <span className="text-xs text-muted-foreground ml-2">
                            ({category.code})
                          </span>
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Brand Filter */}
              <Accordion type="single" collapsible>
                <AccordionItem value="brand">
                  <AccordionTrigger className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Brand
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <button
                        onClick={() => updateFilter("brand", "")}
                        className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors ${
                          !filters.brand ? "bg-primary/10 text-primary" : "hover:bg-muted"
                        }`}
                      >
                        All Brands
                      </button>
                      {brands.map((brand) => (
                        <button
                          key={brand.id}
                          onClick={() => updateFilter("brand", brand.id)}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors ${
                            filters.brand === brand.id
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          {brand.name}
                          <span className="text-xs text-muted-foreground ml-2">
                            ({brand.code})
                          </span>
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Price Range Filter */}
              <Accordion type="single" collapsible>
                <AccordionItem value="price">
                  <AccordionTrigger className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Price Range
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="pt-2">
                        <Slider
                          value={priceRange}
                          min={0}
                          max={100000}
                          step={100}
                          onValueChange={handlePriceRangeChange}
                          className="my-4"
                        />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Min</span>
                          <span className="text-muted-foreground">Max</span>
                        </div>
                        <div className="flex gap-2 mt-1">
                          <Input
                            type="number"
                            value={priceRange[0]}
                            onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])}
                            className="h-8 text-sm"
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="number"
                            value={priceRange[1]}
                            onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 100000])}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <Button onClick={applyPriceRange} size="sm" className="w-full">
                        Apply Price Range
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Stock Status Filter */}
              <Accordion type="single" collapsible>
                <AccordionItem value="stock">
                  <AccordionTrigger className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Stock Status
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {stockStatuses.map((status) => (
                        <button
                          key={status.value}
                          onClick={() => updateFilter("stockStatus", status.value)}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors ${
                            filters.stockStatus === status.value
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          <span className={status.color}>{status.label}</span>
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Product Type Filter */}
              <Accordion type="single" collapsible>
                <AccordionItem value="type">
                  <AccordionTrigger className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Product Type
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {productTypes.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => updateFilter("productType", type.value)}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors ${
                            filters.productType === type.value
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Status Filter */}
              <Accordion type="single" collapsible>
                <AccordionItem value="status">
                  <AccordionTrigger className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4" />
                      Product Status
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {statuses.map((status) => (
                        <button
                          key={status.value}
                          onClick={() => updateFilter("status", status.value)}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors ${
                            filters.status === status.value
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          <span className={status.color}>{status.label}</span>
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Tags Filter */}
              {tags.length > 0 && (
                <Accordion type="single" collapsible>
                  <AccordionItem value="tags">
                    <AccordionTrigger className="text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Tags
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            className={`px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                              filters.tags.includes(tag.id)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/40 hover:bg-muted"
                            }`}
                            style={
                              filters.tags.includes(tag.id) && tag.color
                                ? { backgroundColor: tag.color, color: "#fff" }
                                : undefined
                            }
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              {/* Date Filter */}
              <Accordion type="single" collapsible>
                <AccordionItem value="date">
                  <AccordionTrigger className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Created Date
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">From</Label>
                        <Input type="date" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">To</Label>
                        <Input type="date" className="mt-1" />
                      </div>
                      <Button size="sm" className="w-full">
                        Apply Date Range
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div className="mt-6 pt-4 border-t border-border sticky bottom-0 bg-background">
              <div className="flex gap-2">
                <Button onClick={clearAllFilters} variant="outline" className="flex-1">
                  Clear All
                </Button>
                <Button onClick={() => setIsOpen(false)} className="flex-1">
                  Apply Filters
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Filter Summary Bar - shows when filters are active */}
      {activeFilterCount > 0 && (
        <div className="text-xs text-muted-foreground flex items-center gap-2 px-1">
          <Filter className="w-3 h-3" />
          {activeFilterCount} active filter{activeFilterCount !== 1 ? "s" : ""} applied
        </div>
      )}
    </div>
  );
}