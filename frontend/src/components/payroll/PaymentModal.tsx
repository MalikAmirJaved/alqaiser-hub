// src/components/payroll/PaymentModal.tsx
"use client";

import { useState, useEffect } from "react";
import { useEmployeeLoans, useCompensations, usePayrollPreview, useProcessPayroll } from "@/hooks/usePayroll";
import { CreditCard, Plus, Minus, X, CheckCircle, Clock, CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PaymentModal({
  formatCurrency,
  employee,
  isOpen,
  onClose,
  onSuccess,
  selectedMonth,
  selectedYear,
}: {
  formatCurrency: (amount: number) => string;
  employee: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedMonth: number;
  selectedYear: number;
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
  const [previewData, setPreviewData] = useState<any>(null);

  const { data: allLoans = [] } = useEmployeeLoans();
  const { data: compensations = [] } = useCompensations();
  const previewMutation = usePayrollPreview();
  const processPayroll = useProcessPayroll();

  const activeCompensation = compensations.find(
    c => c.employee_id === employee?.id && c.status === "ACTIVE"
  );
  const activeLoans = allLoans.filter(
    l => l.employee_id === employee?.id && l.status === "ACTIVE"
  );


  

  // Reset selections when modal opens
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

  // Fetch preview whenever relevant inputs change
  useEffect(() => {
    if (!isOpen || !employee) return;

    const selectedLoanIds = Object.keys(selectedLoanDeductions).filter(
      id => selectedLoanDeductions[id]
    );

    previewMutation.mutate({
      employee_id: employee.id,
      month: selectedMonth,
      year: selectedYear,
      overtime_hours: overtimeHours,
      bonus: bonus,
      deductions: deductions,
      selected_loans: selectedLoanIds.map(Number),
    });
  }, [isOpen, employee, selectedMonth, selectedYear, overtimeHours, bonus, deductions, selectedLoanDeductions]);

  const baseSalary = parseFloat(employee?.salary || "0");

  const handleProcessPayment = async () => {
    try {
      await processPayroll.mutateAsync({
        employee_id: employee.id,
        month: selectedMonth,
        year: selectedYear,
        base_salary: baseSalary,
        bonus: bonus,
        deductions: deductions,
        deduction_reason: deductionReason,
        transaction_type: transactionType,
        transaction_number: transactionReference || `PAY-${selectedYear}${String(selectedMonth).padStart(2, '0')}-${employee?.employee_id || 'EMP'}`,
        payment_method: paymentMethod,
        custom_note: customNote,
        overtime_hours: overtimeHours,
        selected_loans: Object.keys(selectedLoanDeductions).filter(id => selectedLoanDeductions[id]).map(Number),
      });
      toast.success("Payment processed successfully");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to process payment");
    }
  };

  if (!isOpen) return null;

  const isLoading = previewMutation.isPending;
  const preview = previewMutation.data;


  const leaveDeduction = preview?.leave_deduction ?? 0;
const loanDeductions = preview?.loan_deductions ?? 0;
const leaveDays = preview?.leave_days ?? 0;

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
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            Payroll period: {new Date(selectedYear, selectedMonth-1).toLocaleString('default', { month: 'long' })} {selectedYear}
          </div>

          {/* Salary Breakdown - Static */}
          <div className="bg-muted/40 rounded-xl p-3 space-y-2">
            <div className="text-xs font-medium text-primary mb-2">Salary Breakdown</div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base Salary</span>
              <span className="font-medium">{formatCurrency(baseSalary)}</span>
            </div>
            {activeCompensation && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Compensation Allowances</span>
                <span className="font-medium text-success">{formatCurrency(parseFloat(activeCompensation.total_allowances || "0"))}</span>
              </div>
            )}
          </div>

          {/* Overtime Input */}
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
                  <div className="font-medium">{formatCurrency(parseFloat(activeCompensation.overtime_rate || "0"))}</div>
                </div>
                <div className="text-sm text-center">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="font-medium text-info">
                    {isLoading ? "..." : formatCurrency(preview?.overtime_amount || 0)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Info */}
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
                  placeholder={`PAY-${selectedYear}${String(selectedMonth).padStart(2, '0')}-${employee?.employee_id || 'EMP'}`}
                  className="bg-card border border-border rounded-md h-8 px-2 text-sm font-mono"
                />
              </label>
            </div>
          </div>

          {/* Bonus Input */}
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Plus className="w-3 h-3 text-success" /> Bonus / Extra Amount
            </span>
            <input
              type="number"
              value={bonus}
              onChange={(e) => setBonus(Number(e.target.value) || 0)}
              className="bg-muted/40 border border-border rounded-md h-10 px-3"
              placeholder="0"
            />
          </label>

          {/* Active Loans Checkboxes */}
          {activeLoans.length > 0 && (
            <div className="border border-border rounded-xl p-3">
              <div className="text-xs font-medium text-warning mb-2">Active Loans Deductions (Principal + Interest)</div>
              {activeLoans.map((loan) => {
                return (
                  <label key={loan.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedLoanDeductions[loan.id] || false}
                        onChange={(e) => setSelectedLoanDeductions(prev => ({ ...prev, [loan.id]: e.target.checked }))}
                        className="rounded border-border"
                      />
                      <div>
                        <div className="text-sm">{loan.loan_type_display || loan.loan_type}</div>
                        <div className="text-xs text-muted-foreground">
                          Remaining: {formatCurrency(parseFloat(loan.remaining_amount))} ({loan.paid_months}/{loan.total_months} months)
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <div className="text-sm font-medium text-warning">
                          -{formatCurrency(preview?.loan_details?.find((d: any) => d.loan_id === loan.id)?.total || 0)}
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
              className="bg-muted/40 border border-border rounded-md h-10 px-3"
              placeholder="0"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Deduction Reason</span>
            <input
              type="text"
              value={deductionReason}
              onChange={(e) => setDeductionReason(e.target.value)}
              className="bg-muted/40 border border-border rounded-md h-10 px-3"
              placeholder="e.g., Late attendance, Advance, etc."
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Note (Optional)</span>
            <textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              rows={2}
              className="bg-muted/40 border border-border rounded-md p-2"
              placeholder="Additional notes..."
            />
          </label>

          {/* Net Salary Preview from Backend */}
          <div className="pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Base Salary</span>
              <span>{formatCurrency(baseSalary)}</span>
            </div>
            {activeCompensation && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Compensation</span>
                <span className="text-success">+{formatCurrency(parseFloat(activeCompensation.total_allowances || "0"))}</span>
              </div>
            )}
            {overtimeHours > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Overtime ({overtimeHours}h)</span>
                <span className="text-info">+{isLoading ? "..." : formatCurrency(preview?.overtime_amount || 0)}</span>
              </div>
            )}
            {bonus > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Bonus</span>
                <span className="text-success">+{formatCurrency(bonus)}</span>
              </div>
            )}
           {leaveDeduction > 0 && (
  <div className="flex justify-between text-sm text-muted-foreground">
    <span>Leave Deduction ({leaveDays.toFixed(1)} day(s) off work)</span>
    <span className="text-destructive">-{formatCurrency(leaveDeduction)}</span>
  </div>
)}

{loanDeductions > 0 && (
  <div className="flex justify-between text-sm text-muted-foreground">
    <span>Loan Deductions</span>
    <span className="text-destructive">-{formatCurrency(loanDeductions)}</span>
  </div>
)}
            {deductions > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Additional Deductions</span>
                <span className="text-destructive">-{formatCurrency(deductions)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm font-medium">Net Payable</span>
              <span className="text-2xl font-bold text-success">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  formatCurrency(preview?.net_salary || 0)
                )}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 h-10 rounded-md border border-border text-sm hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={handleProcessPayment}
              disabled={processPayroll.isPending || isLoading}
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