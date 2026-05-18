// src/components/inventory/pos/ProductCard.tsx

"use client";
import { VariantDetail } from "@/hooks/useAllVariants";
import { fmt } from "@/lib/utils";

export function ProductCard({ variant, onAdd }: { variant: VariantDetail; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="group bg-card border border-border rounded-xl p-3 text-left hover:border-primary/40 hover:bg-accent/30 transition-all active:scale-[0.98] flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground">{variant.product_name}</p>
        <div className="flex-shrink-0 mt-0.5">
          {variant.is_active ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/20 text-success">Active</span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">Inactive</span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground font-mono">{variant.sku}</p>
      {variant.barcode && <p className="text-xs text-muted-foreground">BC: {variant.barcode}</p>}
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-border">
        <span className="text-base font-semibold text-primary">{fmt(Number(variant.selling_price))}</span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">+</span>
      </div>
    </button>
  );
}