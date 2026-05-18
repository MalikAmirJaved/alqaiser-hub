// src/components/inventory/pos/CartLineItem.tsx
"use client";
import { CartLine, fmt } from "@/lib/utils";

export function CartLineItem({
  line,
  idx,
  effectiveLine,
  expanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}: {
  line: CartLine;
  idx: number;
  effectiveLine: CartLine;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<CartLine>) => void;
  onRemove: () => void;
}) {
  const lineTotal = (l: CartLine) => {
    const base = l.qty * l.unitPrice;
    const disc = l.discountFixed > 0 ? l.discountFixed : (base * l.discountPct) / 100;
    const subtotal = Math.max(0, base - disc);
    return subtotal + subtotal * (l.taxRate / 100);
  };

  return (
    <div className="bg-background border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex items-center gap-1 bg-muted rounded-lg">
          <button onClick={() => line.qty <= 1 ? onRemove() : onUpdate({ qty: line.qty - 1 })} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-accent text-lg font-medium leading-none">−</button>
          <input
            type="number"
            value={line.qty}
            min={1}
            onChange={(e) => onUpdate({ qty: Math.max(1, Number(e.target.value)) })}
            className="w-8 bg-transparent text-center text-sm font-medium outline-none"
          />
          <button onClick={() => onUpdate({ qty: line.qty + 1 })} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-accent text-lg font-medium leading-none">+</button>
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
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Unit price</span>
              <input type="number" value={line.unitPrice} onChange={(e) => onUpdate({ unitPrice: Number(e.target.value) })} className="w-full bg-muted rounded-md px-2 py-1 text-sm outline-none focus:ring-1 ring-primary" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Tax %</span>
              <input type="number" value={line.taxRate} onChange={(e) => onUpdate({ taxRate: Number(e.target.value) })} className="w-full bg-muted rounded-md px-2 py-1 text-sm outline-none focus:ring-1 ring-primary" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Disc %</span>
              <input type="number" value={line.discountPct} onChange={(e) => onUpdate({ discountPct: Number(e.target.value), discountFixed: 0 })} className="w-full bg-muted rounded-md px-2 py-1 text-sm outline-none focus:ring-1 ring-primary" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Disc fixed</span>
              <input type="number" value={line.discountFixed} onChange={(e) => onUpdate({ discountFixed: Number(e.target.value), discountPct: 0 })} className="w-full bg-muted rounded-md px-2 py-1 text-sm outline-none focus:ring-1 ring-primary" />
            </label>
          </div>
          <input value={line.notes} onChange={(e) => onUpdate({ notes: e.target.value })} placeholder="Line notes…" className="w-full bg-muted rounded-md px-2 py-1 text-xs outline-none focus:ring-1 ring-primary placeholder:text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9" /></svg>;
}
function XIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>; }