// src/components/inventory/pos/CartLineItem.tsx
"use client";
import { CartLine, fmt } from "@/hooks/useSalesOrder";

export function CartLineItem({
  line,
  idx,
  effectiveLine,
  expanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  maxQty,
}: {
  line: CartLine;
  idx: number;
  effectiveLine: CartLine;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<CartLine>) => void;
  onRemove: () => void;
  maxQty: number;
}) {
  const lineTotal = (l: CartLine) => {
    const base = l.qty * l.unitPrice;
    const disc = l.discountFixed > 0 ? l.discountFixed : (base * l.discountPct) / 100;
    const subtotal = Math.max(0, base - disc);
    return subtotal + subtotal * (l.taxRate / 100);
  };

  const clampQty = (qty: number) => Math.min(maxQty, Math.max(1, qty));

  const handleQtyChange = (newQty: number) => {
    const clamped = clampQty(newQty);
    onUpdate({ qty: clamped });
  };

  const handleDecrement = () => {
    if (line.qty <= 1) {
      onRemove();
    } else {
      handleQtyChange(line.qty - 1);
    }
  };

  const handleIncrement = () => {
    handleQtyChange(line.qty + 1);
  };

  const isOverStock = line.qty > maxQty;

  return (
    <div className="bg-background border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex items-center gap-1 bg-muted rounded-lg">
          <button
            onClick={handleDecrement}
            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-accent text-lg font-medium leading-none"
          >
            −
          </button>
          <input
            type="number"
            value={line.qty}
            min={1}
            max={maxQty}
            onChange={(e) => handleQtyChange(Number(e.target.value))}
            className="w-8 bg-transparent text-center text-sm font-medium outline-none"
          />
          <button
            onClick={handleIncrement}
            disabled={line.qty >= maxQty}
            className={`w-7 h-7 flex items-center justify-center rounded-md text-lg font-medium leading-none ${
              line.qty >= maxQty
                ? "text-muted-foreground/30 cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            +
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{line.variant.product_name}</p>
          <p className="text-xs text-muted-foreground font-mono">{line.variant.sku}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{fmt(lineTotal(effectiveLine))}</p>
          {lineTotal(effectiveLine) !== line.qty * line.unitPrice && (
            <p className="text-xs text-muted-foreground line-through">{fmt(line.qty * line.unitPrice)}</p>
          )}
        </div>
        <div className="flex gap-0.5">
          <button onClick={onToggleExpand} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
            <ChevronIcon open={expanded} />
          </button>
          <button onClick={onRemove} className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
            <XIcon size={14} />
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-border px-3 py-2.5 space-y-2 bg-muted/30">
          {/* Stock warning */}
          {isOverStock && (
            <div className="bg-destructive/10 text-destructive text-xs px-2 py-1.5 rounded-md flex items-center gap-2">
              <WarningIcon size={12} />
              <span>Quantity exceeds available stock ({maxQty} available)</span>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Unit price</span>
              <input
                type="number"
                value={line.unitPrice}
                onChange={(e) => onUpdate({ unitPrice: Number(e.target.value) })}
                className="w-full bg-muted rounded-md px-2 py-1 text-sm outline-none focus:ring-1 ring-primary"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Tax %</span>
              <input
                type="number"
                value={line.taxRate}
                onChange={(e) => onUpdate({ taxRate: Number(e.target.value) })}
                className="w-full bg-muted rounded-md px-2 py-1 text-sm outline-none focus:ring-1 ring-primary"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Disc %</span>
              <input
                type="number"
                value={line.discountPct}
                onChange={(e) => onUpdate({ discountPct: Number(e.target.value), discountFixed: 0 })}
                className="w-full bg-muted rounded-md px-2 py-1 text-sm outline-none focus:ring-1 ring-primary"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Disc fixed</span>
              <input
                type="number"
                value={line.discountFixed}
                onChange={(e) => onUpdate({ discountFixed: Number(e.target.value), discountPct: 0 })}
                className="w-full bg-muted rounded-md px-2 py-1 text-sm outline-none focus:ring-1 ring-primary"
              />
            </label>
          </div>
          
          {/* Stock info */}
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Available stock:</span>
            <span className={`font-mono font-medium ${maxQty <= 5 ? "text-warning" : "text-success"}`}>
              {maxQty} units
            </span>
          </div>
          
          <input
            value={line.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Line notes…"
            className="w-full bg-muted rounded-md px-2 py-1 text-xs outline-none focus:ring-1 ring-primary placeholder:text-muted-foreground"
          />
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function WarningIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01" />
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
    </svg>
  );
}