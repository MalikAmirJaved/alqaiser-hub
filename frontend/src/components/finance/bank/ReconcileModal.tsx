"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { usePayments } from "@/hooks/finance/usePayments";
import { formatCurrency } from "@/lib/currency";
import type { BankTransaction } from "@/hooks/finance/useBank";

interface Props {
  open: boolean;
  onClose: () => void;
  transaction: BankTransaction | null;
  onReconcile: (paymentId: string) => Promise<void>;   // string UUID
}

export default function ReconcileModal({ open, onClose, transaction, onReconcile }: Props) {
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const paymentType = transaction?.transaction_type === "DEPOSIT" ? "RECEIPT" : "PAYMENT";
  const { data: payments, isLoading } = usePayments({
    payment_type: paymentType,
    start_date: transaction?.transaction_date,
    end_date: transaction?.transaction_date,
  });

  const matchingPayments = payments?.filter(
    (p) => Math.abs(p.amount - (transaction?.amount || 0)) < 0.01
  );

  if (!open || !transaction) return null;

  const handleReconcile = async () => {
    if (!selectedPaymentId) return;
    setLoading(true);
    await onReconcile(selectedPaymentId);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">Reconcile Transaction</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-sm">
            <p className="text-muted-foreground">Transaction details:</p>
            <p>{transaction.description} – {formatCurrency(transaction.amount)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Select {paymentType === "RECEIPT" ? "Receipt" : "Payment"} to Reconcile
            </label>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading payments...</div>
            ) : matchingPayments?.length === 0 ? (
              <div className="text-sm text-destructive">
                No matching {paymentType === "RECEIPT" ? "receipts" : "payments"} found for this amount on {transaction.transaction_date}.
                <br />
                <span className="text-xs">Please create a payment first.</span>
              </div>
            ) : (
              <select
                value={selectedPaymentId || ""}
                onChange={(e) => setSelectedPaymentId(e.target.value || null)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              >
                <option value="">-- Select --</option>
                {matchingPayments?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.reference_number || p.id} – {formatCurrency(p.amount)} ({p.payment_method})
                    {p.supplier_bill && ` (Supplier Bill)`}
                    {p.customer_invoice && ` (Customer Invoice)`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleReconcile}
              disabled={!selectedPaymentId || loading || !matchingPayments?.length}
              className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Reconciling..." : "Reconcile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}