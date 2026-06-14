// src/components/inventory/product/AttributeSelector.tsx
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { X, Plus, Tag } from "lucide-react";
import { ATTRIBUTE_SUGGESTIONS, COMMON_ATTRIBUTE_KEYS } from "@/lib/productAttributes";
import { useAttributes, useCreateAttribute } from "@/hooks/useAttributes";

interface Attribute {
  key: string;
  value: string;
}

interface AttributeSelectorProps {
  attributes: Attribute[];
  onChange: (attrs: Attribute[]) => void;
  usedKeys?: string[];
}

function AttributeValueDropdown({
  attrKey,
  value,
  onChange,
  onRemove,
}: {
  attrKey: string;
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: apiAttributes } = useAttributes();
  const createAttribute = useCreateAttribute();

  const apiValues = useMemo(() => {
    const group = apiAttributes?.find((g) => g.key === attrKey);
    return group?.values || [];
  }, [apiAttributes, attrKey]);

  const suggestions = useMemo(() => {
    const staticSuggestions = ATTRIBUTE_SUGGESTIONS[attrKey] || [];
    const seen = new Set(staticSuggestions.map((s) => s.value.toLowerCase()));
    const merged = [...staticSuggestions];
    for (const v of apiValues) {
      if (!seen.has(v.value.toLowerCase())) {
        merged.push(v);
        seen.add(v.value.toLowerCase());
      }
    }
    return merged;
  }, [apiValues, attrKey]);

  const filtered = query
    ? suggestions.filter((s) => s.label.toLowerCase().includes(query.toLowerCase()))
    : suggestions;

  const exactMatch = suggestions.some((s) => s.value.toLowerCase() === query.toLowerCase());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (v: string) => {
    onChange(v);
    setQuery(v);
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!attrKey || !query) return;
    try {
      await createAttribute.mutateAsync({
        attribute_key: attrKey,
        attribute_value: query,
      });
    } catch {
    }
    select(query);
  };

  return (
    <div ref={ref} className="relative flex-1">
      <div className="flex items-center gap-1.5 bg-muted/20 border border-border rounded-lg px-2 py-1.5">
        <input
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Value..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            onChange(e.target.value);
          }}
          onFocus={() => setOpen(true)}
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && (query || suggestions.length > 0) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {filtered.length > 0 && (
              <div className="p-1">
                {filtered.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onMouseDown={() => select(s.value)}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            {query && !exactMatch && (
              <div className="border-t border-border p-1">
                <button
                  type="button"
                  onMouseDown={handleCreate}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-success/10 text-success flex items-center gap-2 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create &ldquo;{query}&rdquo;
                </button>
              </div>
            )}
            {filtered.length === 0 && !query && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No suggestions
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KeyDropdown({
  value,
  onChange,
  usedKeys,
}: {
  value: string;
  onChange: (v: string) => void;
  usedKeys: string[];
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: apiAttributes } = useAttributes();
  const createAttribute = useCreateAttribute();

  const allKeys = useMemo(() => {
    const staticKeys = [...COMMON_ATTRIBUTE_KEYS];
    if (apiAttributes) {
      for (const g of apiAttributes) {
        if (!staticKeys.includes(g.key)) {
          staticKeys.push(g.key);
        }
      }
    }
    return staticKeys;
  }, [apiAttributes]);

  const filtered = query
    ? allKeys.filter((k) => k.toLowerCase().includes(query.toLowerCase()) && !usedKeys.includes(k))
    : allKeys.filter((k) => !usedKeys.includes(k));

  const exactMatch = allKeys.some((k) => k.toLowerCase() === query.toLowerCase());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (v: string) => {
    onChange(v);
    setQuery(v);
    setOpen(false);
  };

  const handleCreateKey = async () => {
    if (!query) return;
    select(query);
    try {
      await createAttribute.mutateAsync({
        attribute_key: query,
        attribute_value: "",
      });
    } catch {
    }
  };

  return (
    <div ref={ref} className="relative w-36">
      <div className="flex items-center gap-1.5 bg-muted/20 border border-border rounded-lg px-2 py-1.5">
        <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
        <input
          className="flex-1 min-w-0 bg-transparent text-sm outline-none font-medium placeholder:text-muted-foreground placeholder:font-normal"
          placeholder="Key..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            onChange(e.target.value);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[160px]">
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length > 0 ? (
              filtered.map((k) => (
                <button
                  key={k}
                  type="button"
                  onMouseDown={() => select(k)}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {k}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                All keys used
              </div>
            )}
            {query && !exactMatch && !usedKeys.includes(query) && (
              <button
                type="button"
                onMouseDown={handleCreateKey}
                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-success/10 text-success flex items-center gap-2 font-medium border-t border-border mt-1 pt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Create &ldquo;{query}&rdquo;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttributeSelector({
  attributes,
  onChange,
  usedKeys = [],
}: AttributeSelectorProps) {
  const add = () => {
    onChange([...attributes, { key: "", value: "" }]);
  };

  const remove = (i: number) => {
    onChange(attributes.filter((_, idx) => idx !== i));
  };

  const update = (i: number, field: "key" | "value", val: string) => {
    const next = [...attributes];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  const currentUsedKeys = [...usedKeys, ...attributes.map((a) => a.key).filter(Boolean)];

  return (
    <div className="space-y-2">
      {attributes.map((attr, i) => (
        <div key={i} className="flex items-center gap-2">
          <KeyDropdown
            value={attr.key}
            onChange={(v) => update(i, "key", v)}
            usedKeys={currentUsedKeys}
          />
          <AttributeValueDropdown
            attrKey={attr.key}
            value={attr.value}
            onChange={(v) => update(i, "value", v)}
            onRemove={() => remove(i)}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium mt-1"
      >
        <Plus className="w-3.5 h-3.5" />
        Add attribute
      </button>
    </div>
  );
}
