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
    <div className={`group bg-background border border-border rounded-[20px] overflow-hidden transition-all duration-200 ${expanded ? "ring-2 ring-primary/20 border-primary/30" : "hover:border-border/80"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/40">
          <button
            onClick={handleDecrement}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-card hover:shadow-sm text-lg font-black transition-all"
          >
            −
          </button>
          <input
            type="number"
            value={line.qty}
            min={1}
            max={maxQty}
            onChange={(e) => handleQtyChange(Number(e.target.value))}
            className="w-10 bg-transparent text-center text-sm font-black outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={handleIncrement}
            disabled={line.qty >= maxQty}
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg font-black transition-all ${
              line.qty >= maxQty
                ? "text-muted-foreground/30 cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground hover:bg-card hover:shadow-sm"
            }`}
          >
            +
          </button>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground truncate leading-none mb-1">{line.variant.product_name}</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground/60 uppercase">{line.variant.sku}</span>
            {line.variant.variant_title && (
              <>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span className="text-[10px] font-bold text-muted-foreground/80 truncate">{line.variant.variant_title}</span>
              </>
            )}
          </div>
        </div>

        <div className="text-right pr-1">
          <p className="text-sm font-black text-primary leading-none mb-0.5">{fmt(lineTotal(effectiveLine))}</p>
          {lineTotal(effectiveLine) !== line.qty * line.unitPrice && (
            <p className="text-[10px] text-muted-foreground line-through font-bold">{fmt(line.qty * line.unitPrice)}</p>
          )}
        </div>

        <div className="flex gap-1">
          <button 
            onClick={onToggleExpand} 
            className={`p-2 rounded-xl transition-all ${expanded ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-muted text-muted-foreground"}`}
          >
            <SettingsIcon size={14} />
          </button>
          <button 
            onClick={onRemove} 
            className="p-2 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/20 animate-in slide-in-from-top-2 duration-200">
          {isOverStock && (
            <div className="bg-destructive/10 text-destructive text-[10px] font-bold px-3 py-2 rounded-xl flex items-center gap-2 border border-destructive/20 uppercase tracking-wider">
              <WarningIcon size={14} />
              <span>Quantity exceeds available stock ({maxQty} available)</span>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Unit price</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₦</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={line.unitPrice}
                  onChange={(e) => onUpdate({ unitPrice: Number(e.target.value) })}
                  className="w-full bg-card border border-border/50 rounded-xl pl-7 pr-3 py-2 text-sm font-bold outline-none focus:ring-2 ring-primary/20 focus:border-primary/40 transition-all"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Tax (%)</span>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={line.taxRate}
                  onChange={(e) => onUpdate({ taxRate: Number(e.target.value) })}
                  className="w-full bg-card border border-border/50 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 ring-primary/20 focus:border-primary/40 transition-all"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Discount (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={line.discountPct}
                onChange={(e) => {
                  let val = Number(e.target.value);
                  if (val > 100) val = 100;
                  if (val < 0) val = 0;
                  onUpdate({ discountPct: val, discountFixed: 0 });
                }}
                className="w-full bg-card border border-border/50 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 ring-primary/20 focus:border-primary/40 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Fixed Disc</span>
              <input
                type="number"
                min={0}
                max={line.qty * line.unitPrice}
                step={0.01}
                value={line.discountFixed}
                onChange={(e) => {
                  let val = Number(e.target.value);
                  const maxAllowed = line.qty * line.unitPrice;
                  if (val > maxAllowed) val = maxAllowed;
                  if (val < 0) val = 0;
                  onUpdate({ discountFixed: val, discountPct: 0 });
                }}
                className="w-full bg-card border border-border/50 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 ring-primary/20 focus:border-primary/40 transition-all"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-card border border-border/50 rounded-xl px-3 py-2 group-focus-within:ring-2 ring-primary/20 transition-all">
            <NotesIcon size={14} className="text-muted-foreground/60" />
            <input
              value={line.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Add item notes..."
              className="flex-1 bg-transparent text-xs font-bold outline-none placeholder:text-muted-foreground/40 placeholder:font-medium"
            />
          </div>
          
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${maxQty <= 5 ? "bg-warning animate-pulse" : "bg-success"}`} />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Live Stock: {maxQty} {line.variant.unit || "Units"}</span>
            </div>
            <button 
              onClick={onToggleExpand}
              className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
            >
              Close Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
    </svg>
  );
}

function NotesIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function WarningIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01" />
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
    </svg>
  );
}