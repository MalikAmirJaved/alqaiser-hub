"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface QtySplitResult {
  product_qty: number;
  damage_qty: number;
  damage_reason: string;
}

interface QtySplitModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (result: QtySplitResult) => void;
  title?: string;
  itemName: string;
  totalQty: number;
  confirmLabel?: string;
  isSubmitting?: boolean;
}

export default function QtySplitModal({
  open,
  onClose,
  onConfirm,
  title = "Split Quantity",
  itemName,
  totalQty,
  confirmLabel = "Confirm",
  isSubmitting = false,
}: QtySplitModalProps) {
  const [productQty, setProductQty] = useState(totalQty);
  const [damageQty, setDamageQty] = useState(0);
  const [damageReason, setDamageReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setProductQty(totalQty);
      setDamageQty(0);
      setDamageReason("");
      setError("");
    }
  }, [open, totalQty]);

  if (!open) return null;

  const handleProductChange = (val: number) => {
    const p = Math.max(0, Math.min(val, totalQty));
    setProductQty(p);
    setDamageQty(totalQty - p);
    setError("");
  };

  const handleDamageChange = (val: number) => {
    const d = Math.max(0, Math.min(val, totalQty));
    setDamageQty(d);
    setProductQty(totalQty - d);
    setError("");
  };

  const handleConfirm = () => {
    if (productQty + damageQty !== totalQty) {
      setError(`Product (${productQty}) + damage (${damageQty}) must equal total (${totalQty}).`);
      return;
    }
    if (damageQty > 0 && !damageReason.trim()) {
      setError("Damage reason is required when damage quantity > 0.");
      return;
    }
    onConfirm({
      product_qty: productQty,
      damage_qty: damageQty,
      damage_reason: damageReason.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-medium text-foreground">{itemName}</span>
          {" · "}Total qty: <span className="font-mono">{totalQty}</span>
        </p>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Go to product (restock)</Label>
            <Input
              type="number"
              min={0}
              max={totalQty}
              value={productQty}
              onChange={(e) => handleProductChange(Number(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Damaged (no restock)</Label>
            <Input
              type="number"
              min={0}
              max={totalQty}
              value={damageQty}
              onChange={(e) => handleDamageChange(Number(e.target.value) || 0)}
            />
          </div>

          {damageQty > 0 && (
            <div className="space-y-1.5">
              <Label>Damage reason <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Describe the damage..."
                value={damageReason}
                onChange={(e) => {
                  setDamageReason(e.target.value);
                  setError("");
                }}
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export type LineDispositionAction = "go_to_product" | "return_to_supplier";

export interface LineDispositionState {
  action: LineDispositionAction;
  product_qty: number;
  damage_qty: number;
  damage_reason: string;
}

interface ManualLineActionModalProps {
  open: boolean;
  onClose: () => void;
  itemName: string;
  totalQty: number;
  onSelectAction: (action: LineDispositionAction) => void;
}

/** Step 1: choose go to product vs return to supplier */
export function ManualLineActionModal({
  open,
  onClose,
  itemName,
  totalQty,
  onSelectAction,
}: ManualLineActionModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Manual Item Disposition</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-medium text-foreground">{itemName}</span>
          {" · "}Qty: {totalQty}
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Choose how to handle this manual item. &quot;Go to Product&quot; keeps the supplier bill unchanged.
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onSelectAction("go_to_product")}
            className="w-full px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            Go to Product
          </button>
          <button
            onClick={() => onSelectAction("return_to_supplier")}
            className="w-full px-4 h-10 rounded-lg border border-border text-sm font-medium hover:bg-muted"
          >
            Return Back to Supplier
          </button>
        </div>
      </div>
    </div>
  );
}
