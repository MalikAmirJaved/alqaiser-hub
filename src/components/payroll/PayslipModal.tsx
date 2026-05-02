"use client";

import { useState, useEffect } from "react";
import { ls } from "@/services/localStorageService";
import {  X,  Receipt, } from "lucide-react";

// ============================================
// PAYSLIP MODAL (Enhanced)
// ============================================
export default function PayslipModal({ employee, isOpen,formatCurrency, onClose,  }: { employee: any; isOpen: boolean; onClose: () => void }) {
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [compensation, setCompensation] = useState<any>(null);

  useEffect(() => {
    if (isOpen && employee) {
      const records = ls.get("payroll", []);
      const employeeRecords = records.filter((r: any) => r.employee_id === employee.id);
      setPayrollRecords(employeeRecords);

      const allLoans = ls.get("employeeLoans", []);
      const employeeLoans = allLoans.filter((l: any) => l.employee_id === employee.id);
      setLoans(employeeLoans);

      const compensations = ls.get("compensation", []);
      const activeComp = compensations.find((c: any) => c.employee_id === employee.id && c.status === "ACTIVE");
      setCompensation(activeComp);
    }
  }, [isOpen, employee]);

  const currentMonthPayroll = payrollRecords[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Payslip - {employee?.first_name} {employee?.last_name || ""}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Employee Information */}
          <div className="bg-muted/40 rounded-xl p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Employee ID</div>
                <div className="font-medium">{employee?.employee_id || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Department</div>
                <div className="font-medium">{employee?.department || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Designation</div>
                <div className="font-medium">{employee?.designation || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Joining Date</div>
                <div className="font-medium">{employee?.joining_date || "—"}</div>
              </div>
            </div>
          </div>

          {/* Compensation Breakdown */}
          {compensation && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2">Compensation Structure</h3>
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Basic Salary</div>
                    <div>{formatCurrency(compensation.basic_salary)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">HRA</div>
                    <div>{formatCurrency(compensation.house_rent_allowance)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Medical</div>
                    <div>{formatCurrency(compensation.medical_allowance)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Transport</div>
                    <div>{formatCurrency(compensation.transport_allowance)}</div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-border flex justify-between">
                  <span className="text-sm font-medium">Total Monthly</span>
                  <span className="font-bold text-primary">{formatCurrency(compensation.total_compensation)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Active Loans */}
          {loans.filter(l => l.status === "ACTIVE").length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2 text-warning">Active Loans</h3>
              <div className="space-y-2">
                {loans.filter(l => l.status === "ACTIVE").map((loan) => (
                  <div key={loan.id} className="bg-warning/10 rounded-xl p-3">
                    <div className="flex justify-between text-sm">
                      <span>{loan.loan_type?.replace(/_/g, " ")}</span>
                      <span className="font-medium">{formatCurrency(loan.monthly_deduction)}/month</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Remaining</span>
                      <span>{formatCurrency(loan.remaining_amount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Started: {new Date(loan.start_date).toLocaleDateString()}</span>
                      <span>Progress: {loan.paid_months || 0}/{loan.total_months} months</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment History */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Payment History</h3>
            {payrollRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payment records found
              </div>
            ) : (
              <div className="space-y-2">
                {payrollRecords.map((record) => (
                  <div key={record.id} className="bg-card border border-border rounded-xl p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {record.month}/{record.year}
                        </div>
                        {record.transaction_number && (
                          <div className="text-xs font-mono text-primary">{record.transaction_number}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-success/15 text-success px-2 py-0.5 rounded-full">
                          {record.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{record.payment_method}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Base Salary</div>
                        <div>{formatCurrency(record.base_salary)}</div>
                      </div>
                      {record.bonus > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground">Bonus</div>
                          <div className="text-success">+{formatCurrency(record.bonus)}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-xs text-muted-foreground">Deductions</div>
                        <div className="text-destructive">-{formatCurrency(record.deductions)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Net Pay</div>
                        <div className="font-bold text-primary">{formatCurrency(record.net_salary)}</div>
                      </div>
                    </div>

                    {record.custom_note && (
                      <div className="mt-2 text-xs text-muted-foreground border-t border-border pt-2">
                        {record.custom_note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}