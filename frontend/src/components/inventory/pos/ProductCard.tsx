// src/components/inventory/pos/ProductCard.tsx
"use client";
import { VariantDetail } from "@/hooks/useAllVariants";
import { memo } from "react";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";

interface StockData {
  available: number;
  reserved: number;
  on_hand: number;
}

interface ProductCardProps {
  variant: VariantDetail & { stock?: StockData; incoming?: number };
  onAdd: () => void;
  stockData?: StockData;
}

export const ProductCard = memo(function ProductCard({
  variant, 
  onAdd, 
  stockData 
}: ProductCardProps) {
  const formatCurrency = useFormatCurrency();
  const availableStock = stockData?.available ?? variant.stock?.available ?? 0;
  const reservedStock = stockData?.reserved ?? variant.stock?.reserved ?? 0;
  const incoming = variant.incoming ?? 0;
  const isLowStock = availableStock > 0 && availableStock <= (variant.min_stock_level || 5);
  const isOutOfStock = availableStock === 0;

  // Build tooltip title
  const getTooltipTitle = () => {
    if (isOutOfStock) {
      if (incoming > 0) {
        return `Out of stock · ${incoming} units incoming from purchase orders`;
      }
      return "Out of stock";
    }
    if (incoming > 0) {
      return `${availableStock} available · ${incoming} incoming from PO`;
    }
    return `${availableStock} units available`;
  };

  return (
    <button
      onClick={onAdd}
      disabled={isOutOfStock}
      title={getTooltipTitle()}
      className={`group relative flex flex-col bg-card border border-border rounded-2xl p-3.5 text-left transition-all duration-200 hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98] ${
        isOutOfStock 
          ? 'opacity-60 grayscale cursor-not-allowed' 
          : 'hover:border-primary/40 hover:bg-accent/40'
      }`}
    >
      {/* Availability Badge */}
      <div className="absolute top-2 right-2 z-10">
        {isOutOfStock ? (
          <span className="flex h-2 w-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
        ) : isLowStock ? (
          <span className="flex h-2 w-2 rounded-full bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
        ) : (
          <span className="flex h-2 w-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="mb-2">
          <p className="text-sm font-bold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {variant.product_name}
          </p>
          {variant.variant_title && (
            <p className="text-[11px] font-medium text-muted-foreground/80 mt-1 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-border" />
              {variant.variant_title}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/50">
              {variant.sku}
            </span>
            {variant.unit && (
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                {variant.unit}
              </span>
            )}
          </div>
          {variant.barcode && (
            <p className="text-[10px] text-muted-foreground/60 truncate italic">
              BC: {variant.barcode}
            </p>
          )}
        </div>

        {/* Attributes Grid */}
        {variant.attributes && variant.attributes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {variant.attributes.slice(0, 3).map((attr, i) => (
              <div
                key={i}
                className="flex items-center bg-accent/30 rounded-md border border-border/40 px-1.5 py-0.5"
              >
                <span className="text-[9px] font-bold text-muted-foreground uppercase mr-1">{attr.key}:</span>
                <span className="text-[9px] font-bold text-foreground">{attr.value}</span>
              </div>
            ))}
            {variant.attributes.length > 3 && (
              <span className="text-[9px] font-bold text-muted-foreground bg-muted px-1 rounded flex items-center">
                +{variant.attributes.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer Area */}
      <div className="mt-auto pt-3 border-t border-border/50 space-y-3">
        {/* Stock Stats */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Available</span>
            <span className={`text-xs font-bold font-mono ${
              isOutOfStock ? 'text-destructive' : isLowStock ? 'text-warning' : 'text-success'
            }`}>
              {availableStock.toLocaleString()}
            </span>
          </div>
          {reservedStock > 0 && (
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Reserved</span>
              <span className="text-xs font-bold font-mono text-muted-foreground">
                {reservedStock.toLocaleString()}
              </span>
            </div>
          )}
          {incoming > 0 && (
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-info uppercase tracking-tighter">Incoming</span>
              <span className="text-xs font-bold font-mono text-info">
                {incoming.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Pricing & Add */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Price</span>
            <span className="text-sm font-black text-primary">
              {formatCurrency(variant.selling_price)}
            </span>
          </div>
          {!isOutOfStock && (
            <div className="bg-primary text-primary-foreground h-7 w-7 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
              <PlusIcon size={16} />
            </div>
          )}
        </div>
      </div>
    </button>
  );
});

function PlusIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>;
}