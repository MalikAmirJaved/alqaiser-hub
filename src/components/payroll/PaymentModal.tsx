"use client";

import { useState, useEffect } from "react";
import { ls, uid } from "@/services/localStorageService";
import { permissionService } from "@/services/permissionService";
import {  CreditCard, Plus, Minus, X,  CheckCircle } from "lucide-react";
// ============================================
// PAYMENT MODAL (Enhanced with transaction fields)
// ============================================
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
  const [processing, setProcessing] = useState(false);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [selectedLoanDeductions, setSelectedLoanDeductions] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (isOpen && employee) {
      const loans = (ls.get("employeeLoans") || []);
      const active = loans.filter((l: any) => l.employee_id === employee.id && l.status === "ACTIVE");
      setActiveLoans(active);

      // Auto-select all active loans for deduction
      const initialSelections: { [key: string]: boolean } = {};
      active.forEach((loan: any) => {
        initialSelections[loan.id] = true;
      });
      setSelectedLoanDeductions(initialSelections);
    }
  }, [isOpen, employee]);

  const baseSalary = employee?.salary || 0;
  const loanDeductionsTotal = activeLoans
    .filter(loan => selectedLoanDeductions[loan.id])
    .reduce((sum, loan) => sum + (loan.monthly_deduction || 0), 0);

  const totalDeductions = deductions + loanDeductionsTotal;
  const netSalary = baseSalary + bonus - totalDeductions;

  // Auto-generate transaction reference
  const autoReference = `PAY-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${employee?.employee_id || 'EMP'}`;

  const handleProcessPayment = async () => {
    setProcessing(true);

    try {
      const payrollRecords = (ls.get("payroll") || []);
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Check if already processed
      const alreadyProcessed = payrollRecords.some(
        (r: any) => r.employee_id === employee.id && r.month === currentMonth && r.year === currentYear
      );

      if (alreadyProcessed) {
        alert("Payroll for this employee has already been processed this month.");
        setProcessing(false);
        return;
      }

      // Create payroll record with transaction details
      const payrollRecord = {
        id: uid("pay"),
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name || ""}`,
        employee_code: employee.employee_id,
        department: employee.department,
        designation: employee.designation,
        month: currentMonth,
        year: currentYear,
        base_salary: baseSalary,
        bonus: bonus,
        deductions: totalDeductions,
        deduction_breakdown: {
          custom_deductions: deductions,
          custom_reason: deductionReason,
          loan_deductions: activeLoans
            .filter(loan => selectedLoanDeductions[loan.id])
            .map(loan => ({
              loan_id: loan.id,
              loan_type: loan.loan_type,
              amount: loan.monthly_deduction
            }))
        },
        net_salary: netSalary,
        custom_note: customNote,
        transaction_type: transactionType,
        transaction_number: transactionReference || autoReference,
        payment_method: paymentMethod,
        status: "PAID",
        processed_at: new Date().toISOString(),
        company_id: employee.company_id,
        branch_id: employee.branch_id,
        created_by: permissionService.getCurrentUser()?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      ls.set("payroll", [payrollRecord, ...payrollRecords]);

      // Update loan remaining amounts
      const allLoans = (ls.get("employeeLoans") || []);
      const updatedLoans = allLoans.map((loan: any) => {
        if (selectedLoanDeductions[loan.id] && loan.status === "ACTIVE") {
          const newRemaining = loan.remaining_amount - loan.monthly_deduction;
          const newPaidMonths = (loan.paid_months || 0) + 1;
          return {
            ...loan,
            remaining_amount: newRemaining,
            paid_months: newPaidMonths,
            status: newRemaining <= 0 ? "PAID" : "ACTIVE",
            updated_at: new Date().toISOString()
          };
        }
        return loan;
      });
      ls.set("employeeLoans", updatedLoans);

      // Update payment status
      const paymentStatuses = (ls.get("paymentStatuses") || []);
      const paymentRecord = {
        id: uid("pstat"),
        employee_id: employee.id,
        month: currentMonth,
        year: currentYear,
        transaction_number: transactionReference || autoReference,
        transaction_type: transactionType,
        status: "PAID",
        paid_at: new Date().toISOString(),
      };
      ls.set("paymentStatuses", [paymentRecord, ...paymentStatuses.filter((s: any) =>
        !(s.employee_id === employee.id && s.month === currentMonth && s.year === currentYear)
      )]);

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error processing payment:", error);
      alert("Error processing payment. Please try again.");
    } finally {
      setProcessing(false);
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
                  className="bg-card border border-border rounded-md h-8 px-2 text-sm"
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
                      <div className="text-sm">{loan.loan_type?.replace(/_/g, " ")}</div>
                      <div className="text-xs text-muted-foreground">
                        Remaining: {formatCurrency(loan.remaining_amount)} ({loan.paid_months || 0}/{loan.total_months} months)
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-warning">
                    -{formatCurrency(loan.monthly_deduction)}
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
              disabled={processing}
              className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processing ? (
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