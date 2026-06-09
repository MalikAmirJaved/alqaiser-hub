"use client";

import { useState, useEffect } from "react";
import { useEmployeeLoans, useProcessPayroll } from "@/hooks/usePayroll";
import { CreditCard, Plus, Minus, X, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function PaymentModal({
  formatCurrency,
  employee,
  isOpen,
  onClose,
  onSuccess
}: {
  formatCurrency: (amount: number) => string;
  employee: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [bonus, setBonus] = useState(0);
  const [deductions, setDeductions] = useState(0);
  const [deductionReason, setDeductionReason] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [transactionType, setTransactionType] = useState("SALARY");
  const [transactionReference, setTransactionReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [selectedLoanDeductions, setSelectedLoanDeductions] = useState<{ [key: string]: boolean }>({});

  const { data: allLoans = [] } = useEmployeeLoans();
  const processPayroll = useProcessPayroll();

  // Filter active loans for this employee
  const activeLoans = allLoans.filter(
    l => l.employee_id === employee?.id && l.status === "ACTIVE"
  );

  useEffect(() => {
    if (isOpen && employee) {
      // Auto-select all active loans for deduction
      const initialSelections: { [key: string]: boolean } = {};
      activeLoans.forEach((loan) => {
        initialSelections[loan.id] = true;
      });
      setSelectedLoanDeductions(initialSelections);
    }
  }, [isOpen, employee, activeLoans.length]);

  const baseSalary = parseFloat(employee?.salary || "0");
  const loanDeductionsTotal = activeLoans
    .filter(loan => selectedLoanDeductions[loan.id])
    .reduce((sum, loan) => sum + parseFloat(loan.monthly_deduction), 0);

  const totalDeductions = deductions + loanDeductionsTotal;
  const netSalary = baseSalary + bonus - totalDeductions;

  const autoReference = `PAY-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${employee?.employee_id || 'EMP'}`;

  const handleProcessPayment = async () => {
    try {
      await processPayroll.mutateAsync({
        employee_id: employee.id,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        base_salary: baseSalary,
        bonus: bonus,
        deductions: deductions,
        deduction_reason: deductionReason,
        transaction_type: transactionType,
        transaction_number: transactionReference || autoReference,
        payment_method: paymentMethod,
        custom_note: customNote,
        selected_loans: Object.keys(selectedLoanDeductions).filter(
          id => selectedLoanDeductions[id]
        ).map(Number),
      });
      toast.success("Payment processed successfully");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to process payment");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Process Payment - {employee?.first_name} {employee?.last_name || ""}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Transaction Information */}
          <div className="bg-muted/40 rounded-xl p-3">
            <div className="text-xs font-medium text-primary mb-2">Transaction Information</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Payment Method</span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="bg-card border border-border rounded-md h-8 px-2 text-sm"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="WALLET">Digital Wallet</option>
                </select>
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Transaction Reference</span>
                <input
                  type="text"
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  placeholder={autoReference}
                  className="bg-card border border-border rounded-md h-8 px-2 text-sm font-mono"
                />
              </label>
            </div>
          </div>

          {/* Base Salary Display */}
          <div className="bg-primary/10 rounded-xl p-3">
            <div className="text-xs text-muted-foreground">Base Salary</div>
            <div className="text-xl font-bold text-primary">{formatCurrency(baseSalary)}</div>
          </div>

          {/* Bonus */}
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Plus className="w-3 h-3 text-success" /> Bonus / Extra Amount
            </span>
            <input
              type="number"
              value={bonus}
              onChange={(e) => setBonus(Number(e.target.value) || 0)}
              className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              placeholder="0"
            />
          </label>

          {/* Active Loans Section */}
          {activeLoans.length > 0 && (
            <div className="border border-border rounded-xl p-3">
              <div className="text-xs font-medium text-warning mb-2">Active Loans Deductions</div>
              {activeLoans.map((loan) => (
                <label key={loan.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedLoanDeductions[loan.id] || false}
                      onChange={(e) => setSelectedLoanDeductions(prev => ({
                        ...prev,
                        [loan.id]: e.target.checked
                      }))}
                      className="rounded border-border"
                    />
                    <div>
                      <div className="text-sm">{loan.loan_type_display || loan.loan_type}</div>
                      <div className="text-xs text-muted-foreground">
                        Remaining: {formatCurrency(parseFloat(loan.remaining_amount))} ({loan.paid_months}/{loan.total_months} months)
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-warning">
                    -{formatCurrency(parseFloat(loan.monthly_deduction))}
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Custom Deductions */}
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Minus className="w-3 h-3 text-destructive" /> Additional Deductions
            </span>
            <input
              type="number"
              value={deductions}
              onChange={(e) => setDeductions(Number(e.target.value) || 0)}
              className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              placeholder="0"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Deduction Reason</span>
            <input
              type="text"
              value={deductionReason}
              onChange={(e) => setDeductionReason(e.target.value)}
              className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g., Late attendance, Advance, etc."
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Note (Optional)</span>
            <textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              rows={2}
              className="bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring"
              placeholder="Additional notes..."
            />
          </label>

          {/* Net Salary Preview */}
          <div className="pt-4 border-t border-border">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Net Payable (This Month)</span>
              <span className="text-2xl font-bold text-success">
                {formatCurrency(netSalary)}
              </span>
            </div>
            {loanDeductionsTotal > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                Includes loan deduction of {formatCurrency(loanDeductionsTotal)}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-md border border-border text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleProcessPayment}
              disabled={processPayroll.isPending}
              className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processPayroll.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Process Payment
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}