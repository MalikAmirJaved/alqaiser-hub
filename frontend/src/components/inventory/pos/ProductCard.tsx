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
      className={`group bg-card border border-border rounded-xl p-3 text-left transition-all active:scale-[0.98] flex flex-col gap-2 ${
        isOutOfStock 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:border-primary/40 hover:bg-accent/30'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground">
            {variant.product_name}
          </p>
          {variant.variant_title && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
              {variant.variant_title}
            </p>
          )}
        </div>
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

      {/* Attributes */}
      {variant.attributes && variant.attributes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {variant.attributes.slice(0, 4).map((attr, i) => (
            <span
              key={i}
              className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-accent/50 text-[10px] font-medium text-muted-foreground border border-border/50"
            >
              {attr.key}: <span className="text-foreground ml-0.5">{attr.value}</span>
            </span>
          ))}
          {variant.attributes.length > 4 && (
            <span className="text-[10px] text-muted-foreground">+{variant.attributes.length - 4}</span>
          )}
        </div>
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
        <span className="text-base font-semibold text-primary">
          {formatCurrency(variant.selling_price)}
        </span>
        {!isOutOfStock && (
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
            +
          </span>
        )}
      </div>
    </button>
  );
});