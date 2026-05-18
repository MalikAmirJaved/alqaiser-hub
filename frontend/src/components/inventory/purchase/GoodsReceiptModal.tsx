'use client';

import { useState } from 'react';
import { X, Truck, PackageCheck } from 'lucide-react';
import type { PurchaseOrder, GoodsReceiptPayload } from '@/types/purchase';

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrder: PurchaseOrder;
  onSubmit: (data: GoodsReceiptPayload) => Promise<void>;
  loading?: boolean;
}

interface ReceiptLine {
  purchase_order_line_id: string;
  quantity_received: number;
  unit_cost: number;
  accepted: boolean;
  maxQty: number;
}

function fmtAmt(val: number | string) {
  return Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function GoodsReceiptModal({
  isOpen,
  onClose,
  purchaseOrder,
  onSubmit,
  loading,
}: GoodsReceiptModalProps) {
  const [receivedDate, setReceivedDate] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [notes, setNotes] = useState('');
  const [receiptLines, setReceiptLines] = useState<ReceiptLine[]>(() =>
    purchaseOrder.lines
      .filter((l) => l.quantity_pending > 0)
      .map((l) => ({
        purchase_order_line_id: l.id,
        quantity_received: l.quantity_pending,
        unit_cost: l.unit_cost,
        accepted: true,
        maxQty: l.quantity_pending,
      }))
  );

  if (!isOpen) return null;

  const pendingLines = purchaseOrder.lines.filter((l) => l.quantity_pending > 0);
  const totalReceiving = receiptLines
    .filter((l) => l.accepted)
    .reduce((s, l) => s + l.quantity_received, 0);
  const totalValue = receiptLines
    .filter((l) => l.accepted)
    .reduce((s, l) => s + l.quantity_received * l.unit_cost, 0);

  const updateLine = (idx: number, field: keyof ReceiptLine, value: number | boolean) => {
    setReceiptLines((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: GoodsReceiptPayload = {
      purchase_order: purchaseOrder._id,
      received_date: new Date(receivedDate).toISOString(),
      notes: notes || undefined,
      receipt_lines: receiptLines
        .filter((l) => l.accepted && l.quantity_received > 0)
        .map(({ purchase_order_line_id, quantity_received, unit_cost, accepted }) => ({
          purchase_order_line_id,
          quantity_received,
          unit_cost,
          accepted,
        })),
    };
    await onSubmit(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center">
              <Truck className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-medium">Receive Goods</h2>
              <p className="text-xs text-muted-foreground">
                Order {purchaseOrder.order_number} · {pendingLines.length} item
                {pendingLines.length !== 1 ? 's' : ''} pending
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* Receipt meta */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Received date &amp; time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  required
                  className="field-input"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional delivery notes…"
                  className="field-input"
                />
              </div>
            </div>

            {/* Line items */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-3 pb-2 border-b border-border">
                Items to receive
              </p>

              {pendingLines.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <PackageCheck className="w-8 h-8 mx-auto mb-2 text-green-400" />
                  <p className="text-sm">All items have been received</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {receiptLines.map((line, idx) => {
                    const orig = purchaseOrder.lines.find(
                      (l) => l.id === line.purchase_order_line_id
                    );
                    if (!orig) return null;

                    return (
                      <div
                        key={idx}
                        className={`border rounded-lg p-3.5 transition-colors ${
                          line.accepted
                            ? 'border-border bg-card'
                            : 'border-border/50 bg-muted/30 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Accept toggle */}
                          <input
                            type="checkbox"
                            checked={line.accepted}
                            onChange={(e) => updateLine(idx, 'accepted', e.target.checked)}
                            className="mt-0.5 rounded"
                            title="Accept this line"
                          />

                          <div className="flex-1 min-w-0">
                            {/* Product name + SKU */}
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className="text-sm font-medium">{orig.variant_name}</span>
                              <span className="text-xs font-mono text-muted-foreground">
                                {orig.variant_sku}
                              </span>
                            </div>

                            {/* Qty pills */}
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
                              <span>
                                Ordered:{' '}
                                <span className="font-medium text-foreground">
                                  {orig.quantity_ordered}
                                </span>
                              </span>
                              <span>
                                Already received:{' '}
                                <span className="font-medium text-foreground">
                                  {orig.quantity_received}
                                </span>
                              </span>
                              <span>
                                Pending:{' '}
                                <span className="font-medium text-amber-600">
                                  {orig.quantity_pending}
                                </span>
                              </span>
                            </div>

                            {/* Inputs */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] text-muted-foreground">
                                  Receiving now (max {line.maxQty})
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={line.maxQty}
                                  value={line.quantity_received}
                                  onChange={(e) =>
                                    updateLine(
                                      idx,
                                      'quantity_received',
                                      Math.min(parseInt(e.target.value) || 0, line.maxQty)
                                    )
                                  }
                                  disabled={!line.accepted}
                                  className="field-input text-right tabular-nums"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] text-muted-foreground">
                                  Unit cost
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                    $
                                  </span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={line.unit_cost}
                                    disabled
                                    className="field-input text-right tabular-nums pl-5 bg-muted/40"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Line value */}
                          {line.accepted && line.quantity_received > 0 && (
                            <div className="text-sm font-medium flex-shrink-0 self-end pb-0.5">
                              {fmtAmt(line.quantity_received * line.unit_cost)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary */}
            {totalReceiving > 0 && (
              <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-green-700">
                  Receiving{' '}
                  <span className="font-medium">{totalReceiving} unit{totalReceiving !== 1 ? 's' : ''}</span>{' '}
                  across{' '}
                  <span className="font-medium">
                    {receiptLines.filter((l) => l.accepted && l.quantity_received > 0).length} line
                    {receiptLines.filter((l) => l.accepted && l.quantity_received > 0).length !== 1
                      ? 's'
                      : ''}
                  </span>
                </span>
                <span className="font-semibold text-green-800">{fmtAmt(totalValue)}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-muted/30 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || totalReceiving === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <PackageCheck className="w-4 h-4" />
              {loading ? 'Processing…' : 'Confirm Receipt'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .field-input {
          width: 100%;
          padding: 7px 10px;
          font-size: 13px;
          border: 1px solid hsl(var(--border));
          border-radius: 6px;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          outline: none;
          font-family: inherit;
          transition: border-color 0.15s;
        }
        .field-input:focus { border-color: hsl(var(--ring)); }
        .field-input:disabled { background: hsl(var(--muted)); }
      `}</style>
    </div>
  );
}