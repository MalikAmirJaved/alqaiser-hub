// src/app/(app)/hr/payroll/page.tsx
"use client";

import { useState, useEffect } from "react";
import { ls, uid } from "@/services/localStorageService";
import { companyContext } from "@/services/companyContextService";
import { permissionService } from "@/services/permissionService";
import PageHeader from "@/components/PageHeader";
import { 
  DollarSign, 
  Users, 
  Clock, 
  TrendingUp, 
  Search, 
  Filter,
  Eye,
  CreditCard,
  Plus,
  Minus,
  X,
  Calendar,
  FileText,
  CheckCircle,
  AlertCircle,
  Wallet,
  HandCoins,
  Receipt,
  Hash,
  User,
  Building2,
  Briefcase,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return `PKR ${(amount || 0).toLocaleString()}`;
};

// ============================================
// COMPENSATION MODAL
// ============================================
function CompensationModal({ 
  employee, 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  employee: any; 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    basic_salary: employee?.salary || 0,
    house_rent_allowance: 0,
    medical_allowance: 0,
    transport_allowance: 0,
    utilities_allowance: 0,
    education_allowance: 0,
    other_allowances: 0,
    overtime_rate: 0,
    bonus_percentage: 0,
    effective_date: new Date().toISOString().slice(0, 10),
    notes: ""
  });
  const [loading, setLoading] = useState(false);

  const totalCompensation = formData.basic_salary + 
    formData.house_rent_allowance + 
    formData.medical_allowance + 
    formData.transport_allowance +
    formData.utilities_allowance +
    formData.education_allowance +
    formData.other_allowances;

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      const compensations = ls.get("compensation", []);
      const newCompensation = {
        id: uid("comp"),
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name || ""}`,
        employee_code: employee.employee_id,
        department: employee.department,
        designation: employee.designation,
        ...formData,
        total_compensation: totalCompensation,
        status: "ACTIVE",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        company_id: employee.company_id,
        branch_id: employee.branch_id,
        created_by: permissionService.getCurrentUser()?.id
      };
      
      // Deactivate old compensation
      const updatedCompensations = compensations.map((c: any) => 
        c.employee_id === employee.id ? { ...c, status: "INACTIVE", updated_at: new Date().toISOString() } : c
      );
      
      ls.set("compensation", [newCompensation, ...updatedCompensations]);
      
      // Update employee's salary
      const employees = ls.get("employees", []);
      const updatedEmployees = employees.map((e: any) => 
        e.id === employee.id 
          ? { ...e, salary: totalCompensation, compensation_id: newCompensation.id }
          : e
      );
      ls.set("employees", updatedEmployees);
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving compensation:", error);
      alert("Error saving compensation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Compensation Structure - {employee?.first_name} {employee?.last_name || ""}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          {/* Employee Info */}
          <div className="bg-muted/40 rounded-xl p-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Employee ID</div>
              <div className="font-medium">{employee?.employee_id}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Department</div>
              <div className="font-medium">{employee?.department}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Designation</div>
              <div className="font-medium">{employee?.designation || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Effective Date</div>
              <input
                type="date"
                value={formData.effective_date}
                onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                className="bg-muted/40 border border-border rounded-md h-8 px-2 text-sm"
              />
            </div>
          </div>
          
          {/* Salary Components */}
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Basic Salary *</span>
              <input
                type="number"
                value={formData.basic_salary}
                onChange={(e) => setFormData({ ...formData, basic_salary: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">House Rent Allowance (HRA)</span>
              <input
                type="number"
                value={formData.house_rent_allowance}
                onChange={(e) => setFormData({ ...formData, house_rent_allowance: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Medical Allowance</span>
              <input
                type="number"
                value={formData.medical_allowance}
                onChange={(e) => setFormData({ ...formData, medical_allowance: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Transport Allowance</span>
              <input
                type="number"
                value={formData.transport_allowance}
                onChange={(e) => setFormData({ ...formData, transport_allowance: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Utilities Allowance</span>
              <input
                type="number"
                value={formData.utilities_allowance}
                onChange={(e) => setFormData({ ...formData, utilities_allowance: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Education Allowance</span>
              <input
                type="number"
                value={formData.education_allowance}
                onChange={(e) => setFormData({ ...formData, education_allowance: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Other Allowances</span>
              <input
                type="number"
                value={formData.other_allowances}
                onChange={(e) => setFormData({ ...formData, other_allowances: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Overtime Rate (per hour)</span>
              <input
                type="number"
                value={formData.overtime_rate}
                onChange={(e) => setFormData({ ...formData, overtime_rate: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="Hourly rate for overtime"
              />
            </label>
            
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Bonus Percentage (%)</span>
              <input
                type="number"
                value={formData.bonus_percentage}
                onChange={(e) => setFormData({ ...formData, bonus_percentage: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="Annual bonus % of basic"
              />
            </label>
          </div>
          
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Notes</span>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring"
              placeholder="Additional notes about compensation structure..."
            />
          </label>
          
          {/* Total Summary */}
          <div className="bg-primary/10 rounded-xl p-4">
            <div className="text-sm font-medium text-primary mb-2">Total Monthly Compensation</div>
            <div className="text-3xl font-bold text-primary">{formatCurrency(totalCompensation)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              This will be used as the base salary for all future payroll calculations
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-10 rounded-md border border-border text-sm hover:bg-muted">
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={loading}
            className="px-4 h-10 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Save Compensation
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// LOAN MODAL
// ============================================
function LoanModal({ 
  employee, 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
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
      const loans = ls.get("employeeLoans", []);
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
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
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

// ============================================
// COMPENSATION LIST MODAL
// ============================================
function CompensationListModal({ 
  employee, 
  isOpen, 
  onClose 
}: { 
  employee: any; 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const [compensations, setCompensations] = useState<any[]>([]);
  
  useEffect(() => {
    if (isOpen && employee) {
      const allCompensations = ls.get("compensation", []);
      const employeeCompensations = allCompensations.filter((c: any) => c.employee_id === employee.id);
      setCompensations(employeeCompensations);
    }
  }, [isOpen, employee]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Compensation History - {employee?.first_name} {employee?.last_name || ""}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4">
          {compensations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No compensation records found
            </div>
          ) : (
            <div className="space-y-3">
              {compensations.map((comp) => (
                <div key={comp.id} className={`border rounded-xl p-4 ${comp.status === "ACTIVE" ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Effective Date</div>
                      <div className="font-medium">{new Date(comp.effective_date).toLocaleDateString()}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${comp.status === "ACTIVE" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {comp.status === "ACTIVE" ? "Active" : "Inactive"}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Basic Salary</div>
                      <div className="font-medium">{formatCurrency(comp.basic_salary)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">HRA</div>
                      <div>{formatCurrency(comp.house_rent_allowance)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Medical</div>
                      <div>{formatCurrency(comp.medical_allowance)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="font-semibold text-primary">{formatCurrency(comp.total_compensation)}</div>
                    </div>
                  </div>
                  
                  {comp.notes && (
                    <div className="mt-2 text-xs text-muted-foreground">{comp.notes}</div>
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

// ============================================
// LOAN LIST MODAL
// ============================================
function LoanListModal({ 
  employee, 
  isOpen, 
  onClose,
  onRefresh
}: { 
  employee: any; 
  isOpen: boolean; 
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [loans, setLoans] = useState<any[]>([]);
  
  useEffect(() => {
    if (isOpen && employee) {
      const allLoans = ls.get("employeeLoans", []);
      const employeeLoans = allLoans.filter((l: any) => l.employee_id === employee.id);
      setLoans(employeeLoans);
    }
  }, [isOpen, employee]);
  
  const handleCloseLoan = (loanId: string) => {
    if (confirm("Close this loan? The remaining amount will be written off.")) {
      const allLoans = ls.get("employeeLoans", []);
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
                <div key={loan.id} className={`border rounded-xl p-4 ${
                  loan.status === "ACTIVE" ? "border-warning/30 bg-warning/5" : 
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
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        loan.status === "ACTIVE" ? "bg-warning/15 text-warning" :
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

// ============================================
// PAYMENT MODAL (Enhanced with transaction fields)
// ============================================
function PaymentModal({ 
  employee, 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
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
  const [selectedLoanDeductions, setSelectedLoanDeductions] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    if (isOpen && employee) {
      const loans = ls.get("employeeLoans", []);
      const active = loans.filter((l: any) => l.employee_id === employee.id && l.status === "ACTIVE");
      setActiveLoans(active);
      
      // Auto-select all active loans for deduction
      const initialSelections: {[key: string]: boolean} = {};
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
      const payrollRecords = ls.get("payroll", []);
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
      const allLoans = ls.get("employeeLoans", []);
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
      const paymentStatuses = ls.get("paymentStatuses", []);
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

// ============================================
// PAYSLIP MODAL (Enhanced)
// ============================================
function PayslipModal({ employee, isOpen, onClose }: { employee: any; isOpen: boolean; onClose: () => void }) {
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

// ============================================
// MONTH SELECTOR MODAL
// ============================================
function MonthSelectorModal({ 
  isOpen, 
  onClose, 
  selectedMonth, 
  selectedYear, 
  onSelect 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  selectedMonth: number; 
  selectedYear: number; 
  onSelect: (month: number, year: number) => void;
}) {
  const [tempMonth, setTempMonth] = useState(selectedMonth);
  const [tempYear, setTempYear] = useState(selectedYear);
  
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const years = [2024, 2025, 2026, 2027];
  
  const handleSelect = () => {
    onSelect(tempMonth, tempYear);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Select Month</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-2">Year</label>
            <div className="grid grid-cols-3 gap-2">
              {years.map((year) => (
                <button
                  key={year}
                  onClick={() => setTempYear(year)}
                  className={`py-2 rounded-md text-sm transition-colors ${
                    tempYear === year 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted/40 hover:bg-muted"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-sm text-muted-foreground block mb-2">Month</label>
            <div className="grid grid-cols-3 gap-2">
              {months.map((month, index) => (
                <button
                  key={month}
                  onClick={() => setTempMonth(index + 1)}
                  className={`py-2 rounded-md text-sm transition-colors ${
                    tempMonth === index + 1 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted/40 hover:bg-muted"
                  }`}
                >
                  {month.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSelect} className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPENSATION & LOAN MANAGEMENT PAGE
// ============================================
function CompensationLoanPage({ onRefresh }: { onRefresh: () => void }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [compListModalOpen, setCompListModalOpen] = useState(false);
  const [loanListModalOpen, setLoanListModalOpen] = useState(false);
  const [compensations, setCompensations] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = () => {
    const allEmployees = ls.get("employees", []);
    const filtered = companyContext.filterByContext(allEmployees);
    setEmployees(filtered);
    
    const allCompensations = ls.get("compensation", []);
    setCompensations(allCompensations);
    
    const allLoans = ls.get("employeeLoans", []);
    setLoans(allLoans);
  };
  
  const getActiveCompensation = (employeeId: string) => {
    return compensations.find(c => c.employee_id === employeeId && c.status === "ACTIVE");
  };
  
  const getActiveLoans = (employeeId: string) => {
    return loans.filter(l => l.employee_id === employeeId && l.status === "ACTIVE");
  };
  
  const filteredEmployees = employees.filter(emp => 
    emp.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.employee_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm mt-5">
      <div className="p-4 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Compensation & Loan Management
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Manage employee compensation structures and loan agreements
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employees..."
              className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Employee</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Current Compensation</th>
              <th className="text-left px-4 py-3">Active Loans</th>
              <th className="text-left px-4 py-3">Total Loan Balance</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-muted-foreground">
                  No employees found.
                </td>
              </tr>
            )}
            {filteredEmployees.map((employee) => {
              const activeComp = getActiveCompensation(employee.id);
              const activeLoans = getActiveLoans(employee.id);
              const totalLoanBalance = activeLoans.reduce((sum, l) => sum + (l.remaining_amount || 0), 0);
              
              return (
                <tr key={employee.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{employee.first_name} {employee.last_name || ""}</div>
                    <div className="text-xs text-muted-foreground">{employee.employee_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    {employee.department}<br />
                    <span className="text-xs text-muted-foreground">{employee.designation || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {activeComp ? (
                      <div>
                        <div className="font-medium text-primary">{formatCurrency(activeComp.total_compensation)}</div>
                        <div className="text-xs text-muted-foreground">Basic: {formatCurrency(activeComp.basic_salary)}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {activeLoans.length > 0 ? (
                      <div className="space-y-1">
                        {activeLoans.slice(0, 2).map((loan) => (
                          <div key={loan.id} className="text-xs">
                            <span className="text-warning">{loan.loan_type?.replace(/_/g, " ")}</span>
                            <span className="text-muted-foreground ml-1">{formatCurrency(loan.monthly_deduction)}/mo</span>
                          </div>
                        ))}
                        {activeLoans.length > 2 && (
                          <div className="text-xs text-muted-foreground">+{activeLoans.length - 2} more</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">No active loans</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {totalLoanBalance > 0 ? (
                      <span className="font-medium text-warning">{formatCurrency(totalLoanBalance)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setCompModalOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted"
                        title="Set Compensation"
                      >
                        <Wallet className="w-4 h-4 text-primary" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setLoanModalOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted"
                        title="Create Loan"
                      >
                        <HandCoins className="w-4 h-4 text-warning" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setCompListModalOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted"
                        title="View Compensation History"
                      >
                        <Eye className="w-4 h-4 text-info" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setLoanListModalOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted"
                        title="View Loan History"
                      >
                        <Receipt className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Modals */}
      {compModalOpen && selectedEmployee && (
        <CompensationModal
          employee={selectedEmployee}
          isOpen={compModalOpen}
          onClose={() => {
            setCompModalOpen(false);
            setSelectedEmployee(null);
          }}
          onSuccess={() => {
            loadData();
            onRefresh();
          }}
        />
      )}
      
      {loanModalOpen && selectedEmployee && (
        <LoanModal
          employee={selectedEmployee}
          isOpen={loanModalOpen}
          onClose={() => {
            setLoanModalOpen(false);
            setSelectedEmployee(null);
          }}
          onSuccess={() => {
            loadData();
            onRefresh();
          }}
        />
      )}
      
      {compListModalOpen && selectedEmployee && (
        <CompensationListModal
          employee={selectedEmployee}
          isOpen={compListModalOpen}
          onClose={() => {
            setCompListModalOpen(false);
            setSelectedEmployee(null);
          }}
        />
      )}
      
      {loanListModalOpen && selectedEmployee && (
        <LoanListModal
          employee={selectedEmployee}
          isOpen={loanListModalOpen}
          onClose={() => {
            setLoanListModalOpen(false);
            setSelectedEmployee(null);
          }}
          onRefresh={() => loadData()}
        />
      )}
    </div>
  );
}

// ============================================
// MAIN PAYROLL PAGE
// ============================================
export default function PayrollPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [paymentStatuses, setPaymentStatuses] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthSelectorOpen, setMonthSelectorOpen] = useState(false);
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canView: true,
    loading: true,
  });
  
  // Load data on mount
  useEffect(() => {
    permissionService.init();
    setPermissions({
      canCreate: permissionService.hasPermission("HR", "Payroll", "create"),
      canUpdate: permissionService.hasPermission("HR", "Payroll", "update"),
      canView: permissionService.hasPermission("HR", "Payroll", "view"),
      loading: false,
    });
    
    loadEmployees();
    loadPaymentStatuses();
  }, [selectedMonth, selectedYear]);
  
  const loadEmployees = () => {
    const allEmployees = ls.get("employees", []);
    const filtered = companyContext.filterByContext(allEmployees);
    const activeEmployees = filtered.filter(e => e.employment_status === "ACTIVE");
    setEmployees(activeEmployees);
  };
  
  const loadPaymentStatuses = () => {
    const statuses = ls.get("paymentStatuses", []);
    const filteredForMonth = statuses.filter((s: any) => s.month === selectedMonth && s.year === selectedYear);
    setPaymentStatuses(filteredForMonth);
  };
  
  const getPaymentStatusForMonth = (employeeId: string) => {
    const status = paymentStatuses.find((s: any) => s.employee_id === employeeId);
    return status?.status || "PENDING";
  };
  
  const getPayrollRecord = (employeeId: string) => {
    const records = ls.get("payroll", []);
    return records.find((r: any) => 
      r.employee_id === employeeId && r.month === selectedMonth && r.year === selectedYear
    );
  };
  
  const handleRefresh = () => {
    loadEmployees();
    loadPaymentStatuses();
  };
  
  // Calculate statistics for selected month
  const totalPayroll = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
  const paidCount = employees.filter(emp => getPaymentStatusForMonth(emp.id) === "PAID").length;
  const pendingCount = employees.length - paidCount;
  const avgSalary = employees.length > 0 ? totalPayroll / employees.length : 0;
  
  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const searchTerm = searchQuery.toLowerCase();
    const matchesSearch = 
      emp.first_name?.toLowerCase().includes(searchTerm) ||
      emp.last_name?.toLowerCase().includes(searchTerm) ||
      emp.department?.toLowerCase().includes(searchTerm) ||
      emp.designation?.toLowerCase().includes(searchTerm) ||
      emp.employee_id?.toLowerCase().includes(searchTerm);
    
    const matchesStatus = statusFilter === "all" 
      ? true 
      : statusFilter === "pending" 
        ? getPaymentStatusForMonth(emp.id) === "PENDING"
        : getPaymentStatusForMonth(emp.id) === "PAID";
    
    return matchesSearch && matchesStatus;
  });
  
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
  if (permissions.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <PageHeader
        title="Payroll Management"
        subtitle="Manage employee salaries and payslips"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setMonthSelectorOpen(true)}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-muted/40 border border-border text-sm hover:bg-muted"
            >
              <Calendar className="w-4 h-4" />
              {monthNames[selectedMonth - 1]}, {selectedYear}
            </button>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-muted"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        }
      />
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Total Payroll</span>
            <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary grid place-items-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold">{formatCurrency(totalPayroll)}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">For {monthNames[selectedMonth - 1]}, {selectedYear}</div>
        </div>
        
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Paid Employees</span>
            <div className="w-9 h-9 rounded-lg bg-success/15 text-success grid place-items-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold">{paidCount}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{Math.round((paidCount / employees.length) * 100)}% of all staff</div>
        </div>
        
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Pending Payments</span>
            <div className="w-9 h-9 rounded-lg bg-warning/15 text-warning grid place-items-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold">{pendingCount}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Require processing</div>
        </div>
        
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Avg. Salary</span>
            <div className="w-9 h-9 rounded-lg bg-info/15 text-info grid place-items-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold">{formatCurrency(avgSalary)}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Across all employees</div>
        </div>
      </div>
      
      {/* Employee Payment Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm">
        {/* Search & Filter Bar */}
        <div className="p-3 border-b border-border">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, role or department..."
                className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-9 pr-3 h-9 rounded-md border border-border bg-muted/40 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div className="text-sm text-muted-foreground px-3 py-2 border border-border rounded-md bg-muted/40">
                {monthNames[selectedMonth - 1]}, {selectedYear}
              </div>
            </div>
          </div>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Employee list</th>
                <th className="text-left px-4 py-3">Transaction #</th>
                <th className="text-left px-4 py-3">Base Salary</th>
                <th className="text-left px-4 py-3">Bonus</th>
                <th className="text-left px-4 py-3">Deductions</th>
                <th className="text-left px-4 py-3">Net Pay</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-muted-foreground">
                    No employees found for {monthNames[selectedMonth - 1]}, {selectedYear}.
                  </td>
                </tr>
              )}
              {filteredEmployees.map((employee) => {
                const status = getPaymentStatusForMonth(employee.id);
                const isPaid = status === "PAID";
                const payrollRecord = getPayrollRecord(employee.id);
                
                return (
                  <tr key={employee.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{employee.first_name} {employee.last_name || ""}</div>
                      <div className="text-xs text-muted-foreground">{employee.designation || employee.department || "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-info/15 text-info">
                        {payrollRecord?.transaction_type || "SALARY"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {payrollRecord?.transaction_number || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(employee.salary || 0)}
                    </td>
                    <td className="px-4 py-3 text-success">
                      {payrollRecord?.bonus ? formatCurrency(payrollRecord.bonus) : "—"}
                    </td>
                    <td className="px-4 py-3 text-destructive">
                      {payrollRecord?.deductions ? formatCurrency(payrollRecord.deductions) : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {payrollRecord?.net_salary ? formatCurrency(payrollRecord.net_salary) : formatCurrency(employee.salary || 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border ${
                        isPaid 
                          ? "bg-success/15 text-success border-success/30" 
                          : "bg-warning/15 text-warning border-warning/30"
                      }`}>
                        {isPaid ? "Paid" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setPayslipModalOpen(true);
                          }}
                          className="p-1.5 rounded-md hover:bg-muted"
                          aria-label="View Payslip"
                          title="View Payslip"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!isPaid && permissions.canCreate && (
                          <button
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setPaymentModalOpen(true);
                            }}
                            className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary"
                            aria-label="Process Payment"
                            title="Process Payment"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
           </table>
        </div>
        
        {/* Table Footer */}
        <div className="p-3 border-t border-border flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Showing {filteredEmployees.length} of {employees.length} employees
          </div>
          <div className="text-xs text-muted-foreground">
            Total Payroll: {formatCurrency(filteredEmployees.reduce((sum, e) => sum + (e.salary || 0), 0))}
          </div>
        </div>
      </div>
      
      {/* Compensation & Loan Management Section */}
      <CompensationLoanPage onRefresh={handleRefresh} />
      
      {/* Modals */}
      {paymentModalOpen && selectedEmployee && (
        <PaymentModal
          employee={selectedEmployee}
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedEmployee(null);
          }}
          onSuccess={handleRefresh}
        />
      )}
      
      {payslipModalOpen && selectedEmployee && (
        <PayslipModal
          employee={selectedEmployee}
          isOpen={payslipModalOpen}
          onClose={() => {
            setPayslipModalOpen(false);
            setSelectedEmployee(null);
          }}
        />
      )}
      
      <MonthSelectorModal
        isOpen={monthSelectorOpen}
        onClose={() => setMonthSelectorOpen(false)}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onSelect={(month, year) => {
          setSelectedMonth(month);
          setSelectedYear(year);
        }}
      />
    </div>
  );
}