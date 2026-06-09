// src/components/payroll/PaymentModal.tsx
"use client";

import { useState, useEffect } from "react";
import { useEmployeeLoans, useProcessPayroll, useCompensations } from "@/hooks/usePayroll";
import { CreditCard, Plus, Minus, X, CheckCircle, Clock } from "lucide-react";
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
  const [overtimeHours, setOvertimeHours] = useState(0);

  const { data: allLoans = [] } = useEmployeeLoans();
  const { data: compensations = [] } = useCompensations();
  const processPayroll = useProcessPayroll();

  // Get active compensation for this employee
  const activeCompensation = compensations.find(
    c => c.employee_id === employee?.id && c.status === "ACTIVE"
  );

  // Filter active loans for this employee
  const activeLoans = allLoans.filter(
    l => l.employee_id === employee?.id && l.status === "ACTIVE"
  );

  useEffect(() => {
    if (isOpen && employee) {
      const initialSelections: { [key: string]: boolean } = {};
      activeLoans.forEach((loan) => {
        initialSelections[loan.id] = true;
      });
      setSelectedLoanDeductions(initialSelections);
      setOvertimeHours(0);
      setBonus(0);
      setDeductions(0);
    }
  }, [isOpen, employee, activeLoans.length]);

  const baseSalary = parseFloat(employee?.salary || "0");
  
  // Calculate compensation total
  const compensationTotal = activeCompensation 
    ? parseFloat(activeCompensation.total_allowances || "0") 
    : 0;
  
  // Calculate overtime
  const overtimeRate = activeCompensation 
    ? parseFloat(activeCompensation.overtime_rate || "0") 
    : 0;
  const overtimeAmount = overtimeHours * overtimeRate;

  // Calculate loan deductions with interest
  const loanDeductionsTotal = activeLoans
    .filter(loan => selectedLoanDeductions[loan.id])
    .reduce((sum, loan) => {
      const monthlyDeduction = parseFloat(loan.monthly_deduction);
      const interestRate = parseFloat(loan.interest_rate || "0");
      let totalDeduction = monthlyDeduction;
      
      if (interestRate > 0) {
        const remainingAmount = parseFloat(loan.remaining_amount);
        const remainingMonths = loan.remaining_months || 1;
        const interestAmount = (remainingAmount * interestRate / 100) / remainingMonths;
        totalDeduction += interestAmount;
      }
      
      return sum + totalDeduction;
    }, 0);

  const totalDeductions = deductions + loanDeductionsTotal;
  
  // Net salary calculation: base + compensation + overtime + bonus - deductions
  const netSalary = baseSalary + compensationTotal + overtimeAmount + bonus - totalDeductions;

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
        overtime_hours: overtimeHours,
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
          {/* Salary Breakdown */}
          <div className="bg-muted/40 rounded-xl p-3 space-y-2">
            <div className="text-xs font-medium text-primary mb-2">Salary Breakdown</div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base Salary</span>
              <span className="font-medium">{formatCurrency(baseSalary)}</span>
            </div>
            {activeCompensation && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Compensation Allowances</span>
                <span className="font-medium text-success">{formatCurrency(compensationTotal)}</span>
              </div>
            )}
          </div>

          {/* Overtime Section */}
          {activeCompensation && (
            <div className="border border-border rounded-xl p-3">
              <div className="text-xs font-medium mb-2 flex items-center gap-2">
                <Clock className="w-3 h-3 text-info" />
                Overtime
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm flex flex-col gap-1 flex-1">
                  <span className="text-muted-foreground text-xs">Hours</span>
                  <input
                    type="number"
                    value={overtimeHours}
                    onChange={(e) => setOvertimeHours(Number(e.target.value) || 0)}
                    className="bg-card border border-border rounded-md h-9 px-2"
                    min="0"
                    step="0.5"
                  />
                </label>
                <div className="text-sm text-center">
                  <div className="text-xs text-muted-foreground">Rate/hr</div>
                  <div className="font-medium">{formatCurrency(overtimeRate)}</div>
                </div>
                <div className="text-sm text-center">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="font-medium text-info">{formatCurrency(overtimeAmount)}</div>
                </div>
              </div>
            </div>
          )}

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
              <div className="text-xs font-medium text-warning mb-2">Active Loans Deductions (Principal + Interest)</div>
              {activeLoans.map((loan) => {
                const monthlyDeduction = parseFloat(loan.monthly_deduction);
                const interestRate = parseFloat(loan.interest_rate || "0");
                let interestAmount = 0;
                
                if (interestRate > 0) {
                  const remainingAmount = parseFloat(loan.remaining_amount);
                  const remainingMonths = loan.remaining_months || 1;
                  interestAmount = (remainingAmount * interestRate / 100) / remainingMonths;
                }
                
                const totalDeduction = monthlyDeduction + interestAmount;
                
                return (
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
                          {interestRate > 0 && <span className="text-destructive ml-2">+{interestRate}% interest</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-warning">
                        -{formatCurrency(totalDeduction)}
                      </div>
                      {interestRate > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Principal: {formatCurrency(monthlyDeduction)} + Interest: {formatCurrency(interestAmount)}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
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
          <div className="pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Base Salary</span>
              <span>{formatCurrency(baseSalary)}</span>
            </div>
            {compensationTotal > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Compensation</span>
                <span className="text-success">+{formatCurrency(compensationTotal)}</span>
              </div>
            )}
            {overtimeAmount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Overtime ({overtimeHours}h)</span>
                <span className="text-info">+{formatCurrency(overtimeAmount)}</span>
              </div>
            )}
            {bonus > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Bonus</span>
                <span className="text-success">+{formatCurrency(bonus)}</span>
              </div>
            )}
            {totalDeductions > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Total Deductions</span>
                <span className="text-destructive">-{formatCurrency(totalDeductions)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm font-medium">Net Payable</span>
              <span className="text-2xl font-bold text-success">
                {formatCurrency(Math.max(0, netSalary))}
              </span>
            </div>
            {loanDeductionsTotal > 0 && (
              <div className="text-xs text-muted-foreground">
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