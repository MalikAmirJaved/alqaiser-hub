"use client";

import { useEffect, useState } from "react";
import { X, Wallet, CreditCard, CalendarDays, Hash, AlertCircle, BadgeCheck, ArrowRight, PiggyBank, Banknote } from "lucide-react";
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

  // Credit that can be applied (can't exceed outstanding)
  const creditToApply = Math.min(creditNum, outstandingNum);
  // What the user still owes after credit is applied
  const effectiveOutstanding = Math.max(0, outstandingNum - creditToApply);
  // Credit alone covers the full bill
  const isCreditCovered = outstandingNum > 0 && creditToApply >= outstandingNum;

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

  // After payment preview
  const cashPaid = isCreditCovered ? 0 : (isValidAmount ? parsedAmount : 0);
  const remainingAfter = isValidAmount ? Math.max(0, effectiveOutstanding - cashPaid) : effectiveOutstanding;
  const creditConsumed = cashPaid > 0 || isCreditCovered ? creditToApply : 0;
  const totalPaidNow = cashPaid + creditConsumed;
  const totalPaidAfterPayment = paidNum + totalPaidNow;

  const newStatus =
    !isValidAmount
      ? paymentStatus
      : remainingAfter <= 0.001
        ? "PAID"
        : cashPaid < effectiveOutstanding
          ? "PARTIAL"
          : "PAID";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[95vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─────── Fixed Header ─────── */}
        <div className="flex-shrink-0 flex items-start justify-between px-6 py-4 border-b border-border bg-muted/20 rounded-t-2xl">
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

        {/* ─────── Scrollable Content ─────── */}
        <div className="overflow-y-auto flex-1 p-6">
          <form id="pay-form" onSubmit={handleSubmit} className="space-y-5">
            {subtitle && (
              <p className="text-sm text-muted-foreground -mt-1">{subtitle}</p>
            )}

            {/* ─────── Payment Breakdown (when credit exists) ─────── */}
            {creditNum > 0 && (
              <div className="rounded-xl border border-info/30 bg-info/[0.04] p-4 space-y-2 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground font-medium mb-1">
                  <PiggyBank className="w-3.5 h-3.5" />
                  Payment Breakdown
                </div>

                {/* Payable */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bill payable</span>
                  <span className="font-mono font-medium">{formatCurrency(outstandingNum)}</span>
                </div>

                {/* Credit amount available — shown as a deduction */}
                <div className="flex items-center justify-between bg-info/[0.06] rounded-lg px-3 py-1.5 -mx-1">
                  <div className="flex items-center gap-1.5">
                    <BadgeCheck className="w-3.5 h-3.5 text-info" />
                    <span className="text-info font-medium">Supplier credit applied</span>
                  </div>
                  <span className="font-mono font-semibold text-info">− {formatCurrency(creditToApply)}</span>
                </div>

                {/* Visual separator */}
                <div className="border-t border-dashed border-info/20 my-1" />

                {/* Net cash needed */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5" />
                    <span className="font-semibold">
                      {isCreditCovered ? "Cash needed" : "Net cash you pay"}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-lg">
                    {isCreditCovered
                      ? "0.00"
                      : formatCurrency(effectiveOutstanding)}
                  </span>
                </div>

                {/* Credit balance after — shown only when relevant */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-info/10">
                  <span>Credit balance after</span>
                  <span className="font-mono">
                    {formatCurrency(creditNum)} <ArrowRight className="inline w-3 h-3 mx-0.5" />{" "}
                    <span className={creditToApply >= creditNum ? "text-destructive font-semibold" : "text-info font-semibold"}>
                      {formatCurrency(Math.max(0, creditNum - creditToApply))}
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* ─────── Summary cards ─────── */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="text-sm font-semibold font-mono mt-0.5">{formatCurrency(totalNum)}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid so far</p>
                <p className="text-sm font-semibold font-mono mt-0.5 text-success">{formatCurrency(paidNum)}</p>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {creditNum > 0 ? "Net Payable" : "Due"}
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

            {/* ─────── Amount input or Credit-covered info ─────── */}
            {isCreditCovered ? (
              <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-center space-y-1">
                <BadgeCheck className="w-5 h-5 text-success mx-auto" />
                <p className="font-medium text-success">Fully covered by supplier credit</p>
                <p className="text-xs text-muted-foreground">
                  Credit of {formatCurrency(creditToApply)} will be applied — no cash needed.
                </p>
                <p className="text-[11px] text-muted-foreground border-t border-success/10 pt-1.5 mt-1.5">
                  Credit balance: {formatCurrency(creditNum)} <ArrowRight className="inline w-3 h-3 mx-0.5" />{" "}
                  <span className="text-destructive font-semibold">0.00</span>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                  Payment amount <span className="text-destructive">*</span>
                  {creditNum > 0 && (
                    <span className="text-xs font-normal text-info ml-auto">
                      (credit {formatCurrency(creditToApply)} auto-applied)
                    </span>
                  )}
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

            {/* ─────── After payment preview ─────── */}
            {isValidAmount && (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 space-y-2 text-sm">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">After payment</p>

                {/* Credit consumed */}
                {creditNum > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3 text-info" />
                      <span>Credit consumed</span>
                    </span>
                    <span className="font-mono font-medium text-info">
                      {formatCurrency(creditConsumed)}
                    </span>
                  </div>
                )}

                {/* Cash paid */}
                {!isCreditCovered && cashPaid > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <Banknote className="w-3 h-3 text-success" />
                      <span>Cash paid</span>
                    </span>
                    <span className="font-mono font-medium text-success">
                      {formatCurrency(cashPaid)}
                    </span>
                  </div>
                )}

                {/* Total paid (credit + cash) */}
                {creditNum > 0 && (
                  <div className="flex items-center justify-between text-xs font-medium border-t border-border/40 pt-1.5">
                    <span>Total applied to bill</span>
                    <span className="font-mono">{formatCurrency(totalPaidNow)}</span>
                  </div>
                )}

                {/* Total paid overall (before + now) */}
                <div className="flex items-center justify-between text-xs border-t border-border/40 pt-1.5">
                  <span>Total paid (all time)</span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(totalPaidAfterPayment)}
                    <span className="text-muted-foreground font-normal ml-1">
                      / {formatCurrency(totalNum)}
                    </span>
                  </span>
                </div>

                {/* Remaining payable */}
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>Remaining payable</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-semibold ${remainingAfter <= 0.001 ? "text-success" : "text-warning"}`}>
                      {formatCurrency(remainingAfter)}
                    </span>
                    <StatusBadge status={newStatus} />
                  </div>
                </div>

                {/* Credit balance remaining */}
                {creditNum > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/30 pt-1.5">
                    <span className="flex items-center gap-1">
                      <PiggyBank className="w-3 h-3" />
                      Supplier credit remaining
                    </span>
                    <span className="font-mono">
                      {formatCurrency(creditNum)} <ArrowRight className="inline w-2.5 h-2.5 mx-0.5" />{" "}
                      <span className={creditToApply >= creditNum ? "text-destructive font-semibold" : "font-semibold"}>
                        {formatCurrency(Math.max(0, creditNum - creditToApply))}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ─────── Date, Method, Reference ─────── */}
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
          </form>
        </div>

        {/* ─────── Fixed Footer (buttons) ─────── */}
        <div className="flex-shrink-0 flex items-center gap-2 px-6 py-4 border-t border-border bg-muted/20 rounded-b-2xl">
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
            form="pay-form"
            disabled={isPending || !isValidAmount || outstandingNum <= 0}
            className="flex-1 h-auto min-h-[44px] py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex flex-col items-center justify-center leading-tight"
          >
            {isPending ? (
              "Processing…"
            ) : isCreditCovered ? (
              "Settle with Credit"
            ) : creditNum > 0 && isValidAmount ? (
              <>
                <span>Pay {formatCurrency(parsedAmount)}</span>
                <span className="text-[10px] opacity-80 font-normal">+{formatCurrency(creditToApply)} credit auto-applied</span>
              </>
            ) : isValidAmount ? (
              `Pay ${formatCurrency(parsedAmount)}`
            ) : (
              "Pay"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
