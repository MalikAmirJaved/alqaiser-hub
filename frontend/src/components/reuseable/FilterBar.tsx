"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Filter, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

export interface FilterField {
  name: string;
  label: string;
  type: "search" | "select" | "status" | "date" | "boolean";
  options?: { value: string; label: string }[];
  /** For dynamic/foreign key selects that should use SearchableSelect instead of native select */
  searchable?: boolean;
  /** Static/simple selects (like status) use native select */
  static?: boolean;
}

export interface FilterBarProps {
  fields: FilterField[];
  filters: Record<string, string>;
  onChange: (filters: Record<string, string>) => void;
}

export default function FilterBar({ fields, filters, onChange }: FilterBarProps) {
  const [activeFilterCount, setActiveFilterCount] = useState(0);
  const [localSearch, setLocalSearch] = useState(filters.search || "");

  useEffect(() => {
    let count = 0;
    for (const key in filters) {
      if (filters[key] && filters[key] !== "") count++;
    }
    setActiveFilterCount(count);
  }, [filters]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== (filters.search || "")) {
        onChange({ ...filters, search: localSearch });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch]);

  useEffect(() => {
    setLocalSearch(filters.search || "");
  }, [filters.search]);

  const updateFilter = (key: string, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const clearFilter = (key: string) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onChange(newFilters);
  };

  const clearAllFilters = () => {
    const empty: Record<string, string> = {};
    onChange(empty);
    setLocalSearch("");
  };

  const hasSearch = fields.some((f) => f.type === "search");
  const filterFields = fields.filter((f) => f.type !== "search");

  return (
    <div className="space-y-3">
      {/* Search bar */}
      {hasSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Filter chips + dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Active filter chips */}
        {Object.entries(filters).map(([key, value]) => {
          if (!value || key === "search") return null;
          const field = fields.find((f) => f.name === key);
          const label = field?.label || key;
          const option = field?.options?.find((o) => o.value === value);
          const display = option?.label || value;
          return (
            <Badge key={key} variant="secondary" className="gap-1">
              {label}: {display}
              <button onClick={() => clearFilter(key)} className="ml-1">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          );
        })}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs gap-1">
            <RefreshCw className="w-3 h-3" /> Clear all
          </Button>
        )}

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {filterFields.map((field) => {
            if (field.type === "select" && field.searchable && !field.static) {
              // Use SearchableSelect for dynamic/huge lists
              return (
                <div key={field.name} className="w-48">
                  <SearchableSelect
                    value={filters[field.name] || ""}
                    onChange={(val) => updateFilter(field.name, val)}
                    options={field.options || []}
                    placeholder={field.label}
                  />
                </div>
              );
            }

            if (field.type === "select" || field.type === "status" || field.type === "boolean") {
              const boolOptions = field.type === "boolean" 
                ? [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]
                : [];
              return (
                <div key={field.name} className="w-48">
                  <SearchableSelect
                    value={filters[field.name] || ""}
                    onChange={(val) => updateFilter(field.name, val)}
                    options={[
                      { value: "", label: `All ${field.label}` },
                      ...(boolOptions.length > 0 ? boolOptions : (field.options || [])),
                    ]}
                    placeholder={`All ${field.label}`}
                  />
                </div>
              );
            }

            if (field.type === "date") {
              return (
                <input
                  key={field.name}
                  type="date"
                  value={filters[field.name] || ""}
                  onChange={(e) => updateFilter(field.name, e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring min-w-[140px]"
                  placeholder={field.label}
                />
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}
