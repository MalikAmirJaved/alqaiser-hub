
"use client";

import { useState, useEffect } from "react";
import { ls } from "@/services/localStorageService";
import { X,  HandCoins,  Hash } from "lucide-react";


// ============================================
// LOAN LIST MODAL
// ============================================
export default function LoanListModal({
  formatCurrency,
  employee,
  isOpen,
  onClose,
  onRefresh
}: {
  formatCurrency: (amount: number) => string;
  employee: any;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [loans, setLoans] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && employee) {
      const allLoans = ls.get<any[]>("employeeLoans", []);
      const employeeLoans = allLoans.filter((l: any) => l.employee_id === employee.id);
      setLoans(employeeLoans);
    }
  }, [isOpen, employee]);

  const handleCloseLoan = (loanId: string) => {
    if (confirm("Close this loan? The remaining amount will be written off.")) {
      const allLoans = ls.get<any[]>("employeeLoans", []);
      const updatedLoans = allLoans.map((l: any) =>
        l.id === loanId ? { ...l, status: "CLOSED", closed_at: new Date().toISOString() } : l
      );
      ls.set("employeeLoans", updatedLoans);
      setLoans(updatedLoans.filter((l: any) => l.employee_id === employee.id));
      onRefresh();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-primary" />
            Loan History - {employee?.first_name} {employee?.last_name || ""}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {loans.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No loan records found
            </div>
          ) : (
            <div className="space-y-3">
              {loans.map((loan) => (
                <div key={loan.id} className={`border rounded-xl p-4 ${loan.status === "ACTIVE" ? "border-warning/30 bg-warning/5" :
                    loan.status === "PAID" ? "border-success/30 bg-success/5" : "border-border"
                  }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Hash className="w-3 h-3" />
                        {loan.transaction_number || loan.id}
                      </div>
                      <div className="font-medium">{loan.loan_type?.replace(/_/g, " ")}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${loan.status === "ACTIVE" ? "bg-warning/15 text-warning" :
                          loan.status === "PAID" ? "bg-success/15 text-success" :
                            "bg-muted text-muted-foreground"
                        }`}>
                        {loan.status}
                      </span>
                      {loan.status === "ACTIVE" && (
                        <button
                          onClick={() => handleCloseLoan(loan.id)}
                          className="text-xs text-destructive hover:underline"
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Loan Amount</div>
                      <div className="font-medium">{formatCurrency(loan.loan_amount)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Monthly Deduction</div>
                      <div>{formatCurrency(loan.monthly_deduction)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Remaining</div>
                      <div className={loan.remaining_amount > 0 ? "text-warning" : "text-success"}>
                        {formatCurrency(loan.remaining_amount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Progress</div>
                      <div>{loan.paid_months || 0}/{loan.total_months} months</div>
                    </div>
                  </div>

                  {loan.reason && (
                    <div className="mt-2 text-xs text-muted-foreground">{loan.reason}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
