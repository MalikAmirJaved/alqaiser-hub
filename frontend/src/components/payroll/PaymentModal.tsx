// src/components/payroll/PaymentModal.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useEmployeeLoans, useCompensations, usePayrollPreview, useProcessPayroll, useProcessPayrollAdvance, computeTotalMonths } from "@/hooks/usePayroll";
import { CreditCard, Plus, Minus, X, CheckCircle, Clock, CalendarDays, Loader2, Sparkles } from "lucide-react";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

export default function PaymentModal({
  formatCurrency,
  employee,
  isOpen,
  onClose,
  onSuccess,
  selectedMonth,
  selectedYear,
  apiModule = "hr",
}: {
  formatCurrency: (amount: number) => string;
  employee: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedMonth: number;
  selectedYear: number;
  apiModule?: "hr" | "finance";
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
  const [carryoverMonth, setCarryoverMonth] = useState<number>((selectedMonth % 12) + 1);
  const [carryoverYear, setCarryoverYear] = useState<number>(selectedYear + (selectedMonth === 12 ? 1 : 0));
  const [isInitialized, setIsInitialized] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: allLoans = [] } = useEmployeeLoans();
  const { data: compensations = [] } = useCompensations();
  const advanceExists = employee && allLoans.some(
    l => l.employee_id === employee.id
        && l.loan_type === "SALARY_ADVANCE"
        && l.advance_for_month === selectedMonth
        && l.advance_for_year === selectedYear
        && l.approval === "CONFIRM"
  );
  const isAdvance = !advanceExists && (selectedYear > currentYear || (selectedYear === currentYear && selectedMonth >= currentMonth));
  const previewMutation = usePayrollPreview(apiModule);
  const processPayroll = useProcessPayroll(apiModule);
  const processPayrollAdvance = useProcessPayrollAdvance(apiModule);

  const activeCompensation = compensations.find(
    c => c.employee_id === employee?.id && c.status === "ACTIVE"
  );
  const activeLoans = allLoans.filter(l => {
    if (l.employee_id !== employee?.id || l.approval !== "CONFIRM" || l.status !== "PAID" || l.loan_type === "SALARY_ADVANCE") return false;
    // Only include loans whose selected months or month range matches the current payroll period
    const freq = l.frequency_type;
    if (freq === 'SELECTED_MONTH' || freq === 'ONE_TIME') {
      return l.selected_months?.some((sm: any) => sm.month === selectedMonth && sm.year === selectedYear) ?? false;
    }
    if (freq === 'MONTH_RANGE') {
      const mr = l.month_range;
      if (!mr) return false;
      const startVal = mr.start_year * 12 + mr.start_month;
      const endVal = mr.end_year * 12 + mr.end_month;
      const curVal = selectedYear * 12 + selectedMonth;
      return curVal >= startVal && curVal <= endVal;
    }
    return true;
  });

  const preview = previewMutation.data;
  const fullBaseSalary = useMemo(() => preview?.original_base_salary ?? parseFloat(employee?.salary || "0"), [preview?.original_base_salary, employee?.salary]);
  const proratedBaseSalary = preview?.base_salary ?? fullBaseSalary;
  const prorationDeduction = fullBaseSalary - proratedBaseSalary;
  const hasProration = prorationDeduction > 0;
  const joiningDay = preview?.joining_date ? new Date(preview.joining_date).getDate() : null;
  const proratedDays = preview?.prorated_days;
  const daysInMonth = preview?.days_in_month;

  const selectedLoanIds = useMemo(() =>
    Object.keys(selectedLoanDeductions).filter(id => selectedLoanDeductions[id]),
    [selectedLoanDeductions]
  );

  // Calculate the per-month deduction for a loan in the current payroll period
  const getLoanMonthlyDeduction = (loan: any): number => {
    const freq = loan.frequency_type;
    if (freq === 'SELECTED_MONTH' || freq === 'ONE_TIME') {
      const matched = loan.selected_months?.find((sm: any) => sm.month === selectedMonth && sm.year === selectedYear);
      if (matched) return parseFloat(String(matched.deduction ?? "0"));
      if (freq === 'ONE_TIME') return parseFloat(loan.remaining_amount || "0");
      return 0;
    }
    if (freq === 'MONTH_RANGE') {
      const matched = loan.selected_months?.find((sm: any) => sm.month === selectedMonth && sm.year === selectedYear);
      if (matched) return parseFloat(String(matched.deduction ?? "0"));
      try {
        const mr = loan.month_range;
        if (mr) return parseFloat(String(mr.deduction ?? "0"));
      } catch {}
      return 0;
    }
    return parseFloat(loan.remaining_amount || "0");
  };

  // Total from explicitly selected loans (once initialized)
  const totalFromSelections = useMemo(() =>
    selectedLoanIds.reduce((sum, id) => {
      const loan = allLoans.find(l => l.id === id);
      return sum + (loan ? getLoanMonthlyDeduction(loan) : 0);
    }, 0),
    [selectedLoanIds, allLoans, selectedMonth, selectedYear]
  );

  // Fallback: total from active loans
  const totalFromAllActive = useMemo(() =>
    activeLoans.reduce((sum, loan) =>
      sum + getLoanMonthlyDeduction(loan), 0
    ),
    [activeLoans, selectedMonth, selectedYear]
  );

  // Use selections if active, otherwise fall back to all active loans
  const totalSelectedLoanAmount = selectedLoanIds.length > 0
    ? totalFromSelections
    : totalFromAllActive;

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
      setIsInitialized(true);
    } else {
      setIsInitialized(false);
    }
  }, [isOpen, employee, activeLoans.length]);

  // Fetch preview whenever relevant inputs change (not for advance mode)
  useEffect(() => {
    if (!isOpen || !employee || isAdvance || !isInitialized) return;

    previewMutation.mutate({
      employee_id: employee.id,
      month: selectedMonth,
      year: selectedYear,
      overtime_hours: overtimeHours,
      bonus: bonus,
      deductions: deductions,
      selected_loans: selectedLoanIds,
    });
  }, [isOpen, employee, selectedMonth, selectedYear, overtimeHours, bonus, deductions, selectedLoanIds, isAdvance, isInitialized]);

  const handleProcessPayment = async () => {
    try {
      const payload: any = {
        employee_id: employee.id,
        month: selectedMonth,
        year: selectedYear,
        base_salary: proratedBaseSalary,
        bonus: bonus,
        deductions: deductions,
        deduction_reason: deductionReason,
        transaction_type: transactionType,
        transaction_number: transactionReference || `PAY-${selectedYear}${String(selectedMonth).padStart(2, '0')}-${employee?.employee_id || 'EMP'}`,
        payment_method: paymentMethod,
        custom_note: customNote,
        overtime_hours: overtimeHours,
        selected_loans: selectedLoanIds,
      };
      // Include carryover fields when net would be negative
      if (clientNetSalary <= 0 && preview?.carryover_required) {
        payload.carryover_month = carryoverMonth;
        payload.carryover_year = carryoverYear;
      }
      if (isAdvance) {
        await processPayrollAdvance.mutateAsync(payload);
      } else {
        await processPayroll.mutateAsync(payload);
      }
      onSuccess();
      onClose();
    } catch (error: any) {
    }
  };

  if (!isOpen) return null;

  const isLoading = previewMutation.isPending;

  const leaveDeduction = preview?.leave_deduction ?? 0;
  const leaveDays = preview?.leave_days ?? 0;

  // Client-side net calculation: always include selected loan deductions
  const effectiveLoanDeductions = Math.max(
    preview?.loan_deductions ?? 0,
    totalSelectedLoanAmount
  );

  const compensationAmount = useMemo(() => {
    if (isAdvance) return 0;
    if (!activeCompensation) return 0;
    if (preview?.compensation !== undefined) return preview.compensation;
    const freq = activeCompensation.frequency_type;
    const total = parseFloat(activeCompensation.total_allowances || "0");
    if (freq === 'ONE_TIME' || freq === 'SELECTED_MONTH') {
      const hasMonth = activeCompensation.selected_months?.some(
        sm => sm.month === selectedMonth && sm.year === selectedYear
      ) ?? false;
      return hasMonth ? total : 0;
    }
    if (freq === 'MONTH_RANGE') {
      const mr = activeCompensation.month_range;
      if (!mr) return 0;
      const startVal = mr.start_year * 12 + mr.start_month;
      const endVal = mr.end_year * 12 + mr.end_month;
      const curVal = selectedYear * 12 + selectedMonth;
      return (curVal >= startVal && curVal <= endVal) ? total : 0;
    }
    return total;
  }, [isAdvance, activeCompensation, selectedMonth, selectedYear, preview?.compensation]);
  const overtimeAmount = preview?.overtime_amount ?? 0;

  // Net pay: prorated salary + compensation + overtime + bonus - leave - loan - deductions
  const clientNetSalary = Math.max(0,
    proratedBaseSalary + compensationAmount + overtimeAmount + bonus
    - leaveDeduction - effectiveLoanDeductions - deductions
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold flex items-center gap-2">
            {isAdvance ? (
              <Sparkles className="w-5 h-5 text-amber" />
            ) : (
              <CreditCard className="w-5 h-5 text-primary" />
            )}
            {isAdvance ? "Advance Salary" : "Process Payment"} - {employee?.first_name} {employee?.last_name || ""}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {isAdvance ? "Advance for" : "Payroll period"}: {new Date(selectedYear, selectedMonth-1).toLocaleString('default', { month: 'long' })} {selectedYear}
          </div>
          {isAdvance && (
            <div className="bg-amber/10 border border-amber/30 rounded-lg p-2.5 text-xs flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber shrink-0" />
              <span className="text-amber-foreground">This will create a <strong>Salary Advance</strong> loan that will be deducted when processing payroll for this month.</span>
            </div>
          )}

          {/* Salary Breakdown */}
          <div className="bg-muted/40 rounded-xl p-3 space-y-2">
            <div className="text-xs font-medium text-primary mb-2">Salary Breakdown</div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base Salary</span>
              <span className="font-medium">{formatCurrency(fullBaseSalary)}</span>
            </div>
            {hasProration && (
              <div className="flex justify-between text-sm text-destructive">
                <span className="text-xs">
                  Proration Deduction (Joining {joiningDay}, {proratedDays}/{daysInMonth} days)
                </span>
                <span className="font-medium">-{formatCurrency(prorationDeduction)}</span>
              </div>
            )}
            {activeCompensation && compensationAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Compensation Allowances</span>
                <span className="font-medium text-success">{formatCurrency(compensationAmount)}</span>
              </div>
            )}
          </div>

          {/* Overtime Input (not for advance salary) */}
          {activeCompensation && !isAdvance && (
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
                    {isLoading ? "..." : formatCurrency(overtimeAmount)}
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
                <SearchableSelect
                  value={paymentMethod}
                  onChange={(val) => setPaymentMethod(val)}
                  options={[
                    { value: "BANK_TRANSFER", label: "Bank Transfer" },
                    { value: "CASH", label: "Cash" },
                    { value: "CHEQUE", label: "Cheque" },
                    { value: "WALLET", label: "Digital Wallet" },
                  ]}
                  placeholder="Select method"
                />
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

          {/* Active Loans Deductions - always included, not deselectable */}
          {activeLoans.length > 0 && (
            <div className="border border-border rounded-xl p-3">
              <div className="text-xs font-medium text-warning mb-2">Active Loans Deductions (Principal + Interest)</div>
              {activeLoans.map((loan) => {
                const deductionForLoan = preview?.loan_details?.find((d: any) => d.loan_id === loan.id)?.total;
                const clientDeduction = parseFloat(loan.remaining_amount || "0");
                return (
                  <div key={loan.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked disabled className="rounded border-border opacity-60" />
                      <div>
                        <div className="text-sm">{loan.loan_type_display || loan.loan_type}</div>
                        <div className="text-xs text-muted-foreground">
                          Remaining: {formatCurrency(clientDeduction)} ({loan.paid_months}/{computeTotalMonths(loan)} months)
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-warning">
                        -{formatCurrency(deductionForLoan || clientDeduction)}
                      </div>
                    </div>
                  </div>
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

          {/* Net Amount Preview */}
          <div className="pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Base Salary</span>
              <span>{formatCurrency(fullBaseSalary)}</span>
            </div>
            {hasProration && (
              <div className="flex justify-between text-sm text-destructive">
                <span className="text-xs">Proration (Joining {joiningDay}, {proratedDays}/{daysInMonth} days)</span>
                <span>-{formatCurrency(prorationDeduction)}</span>
              </div>
            )}
            {activeCompensation && compensationAmount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Compensation</span>
                <span className="text-success">+{formatCurrency(compensationAmount)}</span>
              </div>
            )}
            {overtimeHours > 0 && (
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
            {leaveDeduction > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Leave Deduction ({leaveDays.toFixed(1)} day(s) off work)</span>
                <span className="text-destructive">-{formatCurrency(leaveDeduction)}</span>
              </div>
            )}
            {effectiveLoanDeductions > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Loan Deductions</span>
                <span className="text-destructive">-{formatCurrency(effectiveLoanDeductions)}</span>
              </div>
            )}
            {deductions > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Additional Deductions</span>
                <span className="text-destructive">-{formatCurrency(deductions)}</span>
              </div>
            )}
            {/* Carryover: when deductions exceed salary */}
            {clientNetSalary <= 0 && (
              <div className="bg-amber/10 border border-amber/30 rounded-xl p-3 space-y-2">
                <p className="font-medium text-xs text-amber">
                  Net payable is zero or negative after deductions
                </p>
                <p className="text-xs text-muted-foreground">
                  A new <strong>Salary Advance</strong> loan will be created for the remaining amount.
                </p>
                {preview?.carryover_required && preview?.carryover_amount ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Carryover Amount</span>
                      <span className="font-medium text-amber">{formatCurrency(preview.carryover_amount)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs flex flex-col gap-1">
                        <span className="text-muted-foreground">Deduct in Month</span>
                        <SearchableSelect
                          value={String(carryoverMonth)}
                          onChange={(val) => setCarryoverMonth(Number(val))}
                          options={Array.from({ length: 12 }, (_, i) => ({
                            value: String(i + 1),
                            label: new Date(2000, i).toLocaleString('default', { month: 'long' })
                          }))}
                          placeholder="Month"
                        />
                      </label>
                      <label className="text-xs flex flex-col gap-1">
                        <span className="text-muted-foreground">Year</span>
                        <SearchableSelect
                          value={String(carryoverYear)}
                          onChange={(val) => setCarryoverYear(Number(val))}
                          options={Array.from({ length: 5 }, (_, i) => ({
                            value: String(selectedYear + i),
                            label: String(selectedYear + i)
                          }))}
                          placeholder="Year"
                        />
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The advance of <strong>{formatCurrency(preview.carryover_amount)}</strong> will be auto-deducted when processing payroll for {new Date(carryoverYear, carryoverMonth - 1).toLocaleString('default', { month: 'long' })} {carryoverYear}.
                    </p>
                  </div>
                ) : clientNetSalary <= 0 && (
                  <div className="text-xs text-muted-foreground">
                    Estimated carryover: <strong>{formatCurrency(Math.abs(proratedBaseSalary + compensationAmount + overtimeAmount + bonus - leaveDeduction - effectiveLoanDeductions - deductions))}</strong>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm font-medium">{isAdvance ? "Advance Amount" : "Net Payable"}</span>
              <span className="text-2xl font-bold text-success">
                {formatCurrency(clientNetSalary)}
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
                  {isAdvance ? <Sparkles className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  {isAdvance ? "Process Advance Salary" : "Process Payment"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
