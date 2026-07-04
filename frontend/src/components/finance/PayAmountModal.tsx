"use client";

import { useEffect, useState } from "react";
import { X, Wallet, CreditCard, CalendarDays, Hash, AlertCircle } from "lucide-react";
import { StatusBadge } from "@/components/finance/ui";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";

export interface PayAmountModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  documentLabel: string;
  documentNumber: string;
  subtitle?: string;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  paymentStatus?: "UNPAID" | "PARTIAL" | "PAID" | string;
  isPending?: boolean;
  creditAmount?: number;
  onSubmit: (data: {
    amount: number;
    payment_date: string;
    payment_method: string;
    reference_number?: string;
  }) => Promise<void>;
}

const PAYMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CASH", label: "Cash" },
];

export default function PayAmountModal({
  open,
  onClose,
  title = "Record Payment",
  documentLabel,
  documentNumber,
  subtitle,
  totalAmount,
  paidAmount,
  outstanding,
  paymentStatus = "UNPAID",
  isPending = false,
  creditAmount = 0,
  onSubmit,
}: PayAmountModalProps) {
  const formatCurrency = useFormatCurrency();
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [error, setError] = useState("");

  const outstandingNum = Number(outstanding) || 0;
  const totalNum = Number(totalAmount) || 0;
  const paidNum = Number(paidAmount) || 0;
  const creditNum = Number(creditAmount) || 0;
  const effectiveOutstanding = Math.max(0, outstandingNum - creditNum);
  // Credit alone covers the full bill — no cash amount needed, but backend
  // still needs the full outstanding amount sent so it can apply credit there.
  const isCreditCovered = outstandingNum > 0 && creditNum >= outstandingNum;

  useEffect(() => {
    if (open) {
      setAmount(effectiveOutstanding > 0 ? String(effectiveOutstanding) : "");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("BANK_TRANSFER");
      setReferenceNumber("");
      setError("");
    }
  }, [open, effectiveOutstanding]);

  if (!open) return null;

  const parsedAmount = parseFloat(amount);
  const isValidAmount =
    isCreditCovered ||
    (!isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= effectiveOutstanding + 0.001);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount) {
      setError(`Enter an amount between 0.01 and ${formatCurrency(effectiveOutstanding)}`);
      return;
    }
    setError("");
    await onSubmit({
      amount: isCreditCovered ? outstandingNum : parsedAmount,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      reference_number: referenceNumber.trim() || undefined,
    });
  };

  const setQuickAmount = (val: number) => {
    const clamped = Math.min(Math.max(val, 0), effectiveOutstanding);
    setAmount(clamped > 0 ? String(clamped) : "");
    setError("");
  };

  // remainingAfter = how much will still be owed to the supplier after this payment (credit already excluded)
  const remainingAfter = isValidAmount ? Math.max(0, effectiveOutstanding - parsedAmount) : effectiveOutstanding;
  const newStatus =
    !isValidAmount
      ? paymentStatus
      : remainingAfter <= 0.001
        ? "PAID"
        : parsedAmount < effectiveOutstanding
          ? "PARTIAL"
          : "PAID";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {documentLabel}{" "}
                <span className="font-mono font-medium text-foreground">{documentNumber}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {subtitle && (
            <p className="text-sm text-muted-foreground -mt-1">{subtitle}</p>
          )}

          {creditNum > 0 && (
            <div className="rounded-xl border border-info/30 bg-info/5 px-4 py-2.5 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Outstanding due</span>
                <span className="font-mono">{formatCurrency(outstandingNum)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Credit applied <span className="text-info font-medium">(auto)</span></span>
                <span className="font-mono text-info">− {formatCurrency(Math.min(creditNum, outstandingNum))}</span>
              </div>
              <div className="flex items-center justify-between border-t border-info/20 pt-1.5">
                <span className="font-medium">{isCreditCovered ? "Cash needed" : "You pay supplier"}</span>
                <span className="font-semibold font-mono text-info">
                  {isCreditCovered ? "0.00 (credit covers it)" : formatCurrency(effectiveOutstanding)}
                </span>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
              <p className="text-sm font-semibold font-mono mt-0.5">{formatCurrency(totalNum)}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid</p>
              <p className="text-sm font-semibold font-mono mt-0.5 text-success">{formatCurrency(paidNum)}</p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {creditNum > 0 ? "You Pay" : "Due"}
              </p>
              <p className="text-sm font-bold font-mono mt-0.5 text-primary">{formatCurrency(effectiveOutstanding)}</p>
              {creditNum > 0 && (
                <p className="text-[9px] text-muted-foreground line-through font-mono">{formatCurrency(outstandingNum)}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Current status</span>
            <StatusBadge status={paymentStatus} />
          </div>

          {/* Amount */}
          {isCreditCovered ? (
            <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-center">
              <p className="font-medium text-success">Fully covered by available credit</p>
              <p className="text-xs text-muted-foreground mt-0.5">No cash payment required — confirm to settle this bill.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                Payment amount <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={effectiveOutstanding}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError("");
                  }}
                  className={`w-full h-11 rounded-xl border bg-background px-4 text-right text-lg font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    error ? "border-destructive" : "border-border"
                  }`}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              {error && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="w-3 h-3" />
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAmount(effectiveOutstanding)}
                  className="flex-1 h-8 text-xs rounded-lg border border-border hover:bg-muted transition-colors font-medium"
                >
                  Pay full ({formatCurrency(effectiveOutstanding)})
                </button>
                {effectiveOutstanding > 2 && (
                  <button
                    type="button"
                    onClick={() => setQuickAmount(Math.round(effectiveOutstanding / 2 * 100) / 100)}
                    className="flex-1 h-8 text-xs rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    Pay half
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Preview after payment */}
          {isValidAmount && !isCreditCovered && (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">After payment</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">
                  Remaining: <strong>{formatCurrency(remainingAfter)}</strong>
                </span>
                <StatusBadge status={newStatus} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Hash className="w-3 h-3" /> Reference <span className="font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Cheque #, transfer ref…"
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !isValidAmount || outstandingNum <= 0}
              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending
                ? "Processing…"
                : isCreditCovered
                  ? "Settle with Credit"
                  : `Pay ${isValidAmount ? formatCurrency(parsedAmount) : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}