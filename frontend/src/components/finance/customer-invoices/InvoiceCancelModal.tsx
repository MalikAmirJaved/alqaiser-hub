"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import QtySplitModal, {
  ManualLineActionModal,
  type LineDispositionAction,
  type LineDispositionState,
} from "./LineDispositionModals";

export interface CancelLineInfo {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  is_manual_entry: boolean;
}

interface InvoiceCancelModalProps {
  open: boolean;
  onClose: () => void;
  invoiceNumber: string;
  paidAmount: number;
  requiresRefund: boolean;
  lines: CancelLineInfo[];
  reason: string;
  isSubmitting: boolean;
  onConfirm: (payload: {
    line_actions: { source_line_id: string; action: string }[];
    stock_dispositions: {
      source_line_id: string;
      product_qty: number;
      damage_qty: number;
      damage_reason: string;
    }[];
  }) => void;
}

export default function InvoiceCancelModal({
  open,
  onClose,
  invoiceNumber,
  paidAmount,
  requiresRefund,
  lines,
  reason,
  isSubmitting,
  onConfirm,
}: InvoiceCancelModalProps) {
  const formatCurrency = useFormatCurrency();
  const [dispositions, setDispositions] = useState<Record<string, LineDispositionState>>({});
  const [splitLineId, setSplitLineId] = useState<string | null>(null);
  const [actionLineId, setActionLineId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const init: Record<string, LineDispositionState> = {};
      lines.forEach((l) => {
        init[l.id] = {
          action: l.is_manual_entry ? "return_to_supplier" : "go_to_product",
          product_qty: l.quantity,
          damage_qty: 0,
          damage_reason: "",
        };
      });
      setDispositions(init);
      setSplitLineId(null);
      setActionLineId(null);
    }
  }, [open, lines]);

  if (!open) return null;

  const splitLine = splitLineId ? lines.find((l) => l.id === splitLineId) : null;
  const actionLine = actionLineId ? lines.find((l) => l.id === actionLineId) : null;

  const handleManualAction = (action: LineDispositionAction) => {
    if (!actionLineId) return;
    setDispositions((prev) => ({
      ...prev,
      [actionLineId]: {
        ...prev[actionLineId],
        action,
        product_qty: action === "go_to_product" ? prev[actionLineId]?.product_qty ?? lines.find((l) => l.id === actionLineId)!.quantity : 0,
        damage_qty: 0,
        damage_reason: "",
      },
    }));
    setActionLineId(null);
    if (action === "go_to_product") {
      setSplitLineId(actionLineId);
    }
  };

  const handleConfirm = () => {
    const line_actions: { source_line_id: string; action: string }[] = [];
    const stock_dispositions: {
      source_line_id: string;
      product_qty: number;
      damage_qty: number;
      damage_reason: string;
    }[] = [];

    for (const line of lines) {
      const d = dispositions[line.id];
      if (!d) continue;

      if (line.is_manual_entry) {
        const apiAction = d.action === "go_to_product" ? "go_to_inventory" : "return_to_supplier";
        line_actions.push({ source_line_id: line.id, action: apiAction });
        if (d.action === "go_to_product") {
          if (d.damage_qty > 0 && !d.damage_reason.trim()) return;
          stock_dispositions.push({
            source_line_id: line.id,
            product_qty: d.product_qty,
            damage_qty: d.damage_qty,
            damage_reason: d.damage_reason,
          });
        }
      } else {
        if (d.damage_qty > 0 && !d.damage_reason.trim()) return;
        stock_dispositions.push({
          source_line_id: line.id,
          product_qty: d.product_qty,
          damage_qty: d.damage_qty,
          damage_reason: d.damage_reason,
        });
      }
    }

    onConfirm({ line_actions, stock_dispositions });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-5 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {requiresRefund ? "Refund & Cancel Invoice" : "Cancel Invoice"}
            </h3>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-sm">
            {requiresRefund && (
              <p className="text-muted-foreground">
                This invoice has{" "}
                <strong className="text-foreground">{formatCurrency(paidAmount)}</strong> in
                confirmed payments that will be refunded before cancellation.
              </p>
            )}

            <p className="text-muted-foreground">
              Invoice <strong className="text-foreground">{invoiceNumber}</strong>
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Reason:</strong> {reason}
            </p>

            {lines.length > 0 && (
              <div className="rounded-xl border border-border bg-card px-3 py-3 space-y-2">
                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                  Line Items — set disposition
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {lines.map((line) => {
                    const d = dispositions[line.id];
                    const isManual = line.is_manual_entry;
                    const isGoToProduct = d?.action === "go_to_product";
                    return (
                      <div key={line.id} className="p-2 rounded-lg border border-border/60 space-y-1.5">
                        <div>
                          <p className="text-xs font-medium truncate">{line.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Qty: {line.quantity} · {formatCurrency(line.unit_price)}
                            {isManual && <span className="ml-1.5 text-warning">(Manual)</span>}
                          </p>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {isManual ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setActionLineId(line.id)}
                                className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-all ${
                                  isGoToProduct
                                    ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:border-blue-800"
                                    : "border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:border-orange-800"
                                }`}
                              >
                                {isGoToProduct ? "Go to Product" : "Return to Supplier"}
                              </button>
                              {isGoToProduct && (
                                <button
                                  type="button"
                                  onClick={() => setSplitLineId(line.id)}
                                  className="px-2.5 py-1 rounded text-[10px] font-medium border border-emerald-300 bg-emerald-50 text-emerald-700"
                                >
                                  Split: {d?.product_qty ?? 0} product / {d?.damage_qty ?? 0} damage
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSplitLineId(line.id)}
                              className="px-2.5 py-1 rounded text-[10px] font-medium border border-emerald-300 bg-emerald-50 text-emerald-700"
                            >
                              Split: {d?.product_qty ?? line.quantity} restock / {d?.damage_qty ?? 0} damage
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={onClose}
              className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted"
            >
              Go Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 h-9 rounded-md bg-destructive text-destructive-foreground text-sm hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {requiresRefund ? "Refund & Cancel" : "Cancel Invoice"}
            </button>
          </div>
        </div>
      </div>

      <ManualLineActionModal
        open={!!actionLine}
        onClose={() => setActionLineId(null)}
        itemName={actionLine?.name || "Item"}
        totalQty={actionLine?.quantity || 0}
        onSelectAction={handleManualAction}
      />

      <QtySplitModal
        open={!!splitLine}
        onClose={() => setSplitLineId(null)}
        title="Product vs Damage Split"
        itemName={splitLine?.name || "Item"}
        totalQty={splitLine?.quantity || 0}
        confirmLabel="Save Split"
        onConfirm={(result) => {
          if (!splitLineId) return;
          setDispositions((prev) => ({
            ...prev,
            [splitLineId]: {
              ...prev[splitLineId],
              product_qty: result.product_qty,
              damage_qty: result.damage_qty,
              damage_reason: result.damage_reason,
            },
          }));
          setSplitLineId(null);
        }}
      />
    </>
  );
}
