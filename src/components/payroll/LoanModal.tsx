"use client";
import { useState } from "react";
import { ls, uid } from "@/services/localStorageService";
import { permissionService } from "@/services/permissionService";
import {  X,  CheckCircle,  HandCoins} from "lucide-react";
import { DatePicker } from "../DatePicker";

// ============================================
// LOAN MODAL
// ============================================
export default function LoanModal({
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
  const [formData, setFormData] = useState({
    loan_type: "SALARY_ADVANCE",
    loan_amount: 0,
    monthly_deduction: 0,
    total_months: 12,
    interest_rate: 0,
    reason: "",
    start_date: new Date().toISOString().slice(0, 10),
    reference_number: ""
  });
  const [loading, setLoading] = useState(false);

  const totalRepayment = formData.loan_amount + (formData.loan_amount * formData.interest_rate / 100);
  const calculatedMonthlyDeduction = totalRepayment / formData.total_months;

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const loans = (ls.get("employeeLoans") || []);
      const newLoan = {
        id: uid("loan"),
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name || ""}`,
        employee_code: employee.employee_id,
        department: employee.department,
        ...formData,
        total_repayment: totalRepayment,
        remaining_amount: totalRepayment,
        paid_months: 0,
        status: "ACTIVE",
        transaction_number: `LN-${Date.now()}`,
        transaction_type: "LOAN_DISBURSEMENT",
        approved_by: permissionService.getCurrentUser()?.id,
        approved_at: new Date().toISOString(),
        company_id: employee.company_id,
        branch_id: employee.branch_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      ls.set("employeeLoans", [newLoan, ...loans]);
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating loan:", error);
      alert("Error creating loan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-primary" />
            Employee Loan - {employee?.first_name} {employee?.last_name || ""}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Loan Type */}
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Loan Type *</span>
            <select
              value={formData.loan_type}
              onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })}
              className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="SALARY_ADVANCE">Salary Advance</option>
              <option value="PERSONAL_LOAN">Personal Loan</option>
              <option value="CAR_LOAN">Car Loan</option>
              <option value="HOUSE_LOAN">House Loan</option>
              <option value="EDUCATION_LOAN">Education Loan</option>
              <option value="MEDICAL_LOAN">Medical Loan</option>
            </select>
          </label>

          {/* Transaction Reference */}
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Transaction Number</span>
              <input
                type="text"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                placeholder="Auto-generated"
                disabled
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring opacity-70"
              />
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Start Date</span>
              <DatePicker
                value={formData.start_date}
                onChange={(value) => setFormData({ ...formData, start_date: value })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>

          {/* Loan Amount & Terms */}
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Loan Amount *</span>
              <input
                type="number"
                value={formData.loan_amount}
                onChange={(e) => setFormData({ ...formData, loan_amount: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Interest Rate (%)</span>
              <input
                type="number"
                value={formData.interest_rate}
                onChange={(e) => setFormData({ ...formData, interest_rate: Number(e.target.value) || 0 })}
                step="0.1"
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Monthly Deduction</span>
              <input
                type="number"
                value={formData.monthly_deduction || calculatedMonthlyDeduction}
                onChange={(e) => setFormData({ ...formData, monthly_deduction: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="Auto-calculated"
              />
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Total Months</span>
              <input
                type="number"
                value={formData.total_months}
                onChange={(e) => setFormData({ ...formData, total_months: Number(e.target.value) || 1 })}
                min={1}
                max={60}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>

          {/* Reason */}
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Reason for Loan</span>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={2}
              className="bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring"
              placeholder="Describe the reason for this loan..."
            />
          </label>

          {/* Loan Summary */}
          <div className="bg-info/10 rounded-xl p-4">
            <div className="text-sm font-medium text-info mb-2">Loan Summary</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Principal Amount:</span>
                <span>{formatCurrency(formData.loan_amount)}</span>
              </div>
              {formData.interest_rate > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interest ({formData.interest_rate}%):</span>
                  <span>{formatCurrency(formData.loan_amount * formData.interest_rate / 100)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-1 border-t border-border">
                <span>Total Repayment:</span>
                <span>{formatCurrency(totalRepayment)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Deduction:</span>
                <span>{formatCurrency(formData.monthly_deduction || calculatedMonthlyDeduction)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Term:</span>
                <span>{formData.total_months} months</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-10 rounded-md border border-border text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || formData.loan_amount === 0}
            className="px-4 h-10 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Create Loan
          </button>
        </div>
      </div>
    </div>
  );
}