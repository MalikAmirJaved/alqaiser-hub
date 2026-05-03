"use client";
import { useState, useRef, useEffect } from "react";
import { Search, X, Check, ChevronDown } from "lucide-react";

export interface EmployeeOption {
  value: string;
  label: string;
  department?: string;
}

interface EmployeeMultiSelectProps {
  options: EmployeeOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function EmployeeMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select employees...",
  disabled = false,
}: EmployeeMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(query.toLowerCase()) ||
    opt.department?.toLowerCase().includes(query.toLowerCase())
  );

  const toggleSelection = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((id) => id !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full flex flex-wrap items-center gap-1.5 bg-muted/40 border border-border rounded-md h-10 px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          selected.map((id) => {
            const emp = options.find((o) => o.value === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-md text-xs"
              >
                {emp?.label || id}
                <X className="w-3 h-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleSelection(id); }} />
              </span>
            );
          })
        )}
        <ChevronDown className={`w-4 h-4 ml-auto text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-64 overflow-auto py-1">
          <div className="px-2 py-1.5 border-b border-border">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employees..."
                className="w-full bg-transparent pl-7 pr-2 h-8 text-sm outline-none"
                autoFocus
              />
            </div>
          </div>
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No employees found.</div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleSelection(opt.value)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40 transition-colors text-left"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{opt.label}</div>
                    {opt.department && <div className="text-[10px] text-muted-foreground">{opt.department}</div>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}