// src/components/inventory/pos/ProductCard.tsx
"use client";
import { VariantDetail } from "@/hooks/useAllVariants";
import { memo } from "react";
import { formatCurrency } from "@/lib/currency";

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
      className={`group bg-card border border-border rounded-xl p-3 text-left transition-all active:scale-[0.98] flex flex-col gap-2 ${
        isOutOfStock 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:border-primary/40 hover:bg-accent/30'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground">
          {variant.product_name}
        </p>
        <div className="flex-shrink-0 mt-0.5">
          {variant.is_active ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/20 text-success">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
              Inactive
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-mono">{variant.sku}</p>
      
      {variant.barcode && (
        <p className="text-xs text-muted-foreground truncate">BC: {variant.barcode}</p>
      )}

      {/* Stock Information */}
      <div className="mt-1 space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Available:</span>
          <span className={`font-mono font-medium ${
            isOutOfStock 
              ? 'text-destructive' 
              : isLowStock 
                ? 'text-warning' 
                : 'text-success'
          }`}>
            {availableStock}
          </span>
        </div>
        {reservedStock > 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Reserved:</span>
            <span className="font-mono text-muted-foreground">{reservedStock}</span>
          </div>
        )}
        {incoming > 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Incoming (PO):</span>
            <span className="font-mono text-info">{incoming}</span>
          </div>
        )}
      </div>

      {/* Price and Add Button */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
        <div className="flex flex-col">
          <span className="text-base font-semibold text-primary">
            {formatCurrency(variant.selling_price)}
          </span>
          {variant.buying_price > 0 && variant.buying_price !== variant.selling_price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatCurrency(variant.buying_price)}
            </span>
          )}
        </div>
        {!isOutOfStock && (
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
            +
          </span>
        )}
      </div>
    </button>
  );
});