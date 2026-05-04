// src/components/reuseable/FormSelectWithCreate.tsx
"use client";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: Option[];
  placeholder?: string;
  onCreate?: () => void;
}

export default function FormSelectWithCreate({ label, value, onChange, options, placeholder = "Select...", onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);
  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setQuery(selectedOption?.label || "");
  }, [value, selectedOption]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <div className="relative flex items-center">
        <div
          onClick={() => setOpen(true)}
          className={`w-full h-10 px-3 pr-8 flex items-center justify-between rounded-xl border transition-all cursor-pointer
            ${open ? "ring-2 ring-primary/40 border-primary/50" : "border-border hover:border-primary/30"}
            ${!value ? "text-muted-foreground" : "text-foreground"} bg-muted/20`}
        >
          <span className="truncate">{selectedOption?.label || placeholder}</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-muted/30 pl-8 pr-2 h-8 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>
              ) : (
                filtered.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={`w-full px-3 py-2 text-sm text-left rounded-lg transition-colors
                      ${value === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/40"}`}
                  >
                    {opt.label}
                  </button>
                ))
              )}
              {onCreate && (
                <button
                  type="button"
                  onClick={() => { onCreate(); setOpen(false); }}
                  className="w-full mt-1 flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors border-t border-border pt-3"
                >
                  <Plus className="w-4 h-4" /> Create new {label.toLowerCase()}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}