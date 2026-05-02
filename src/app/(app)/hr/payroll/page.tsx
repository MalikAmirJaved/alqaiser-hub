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
  AlertCircle
} from "lucide-react";

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return `PKR ${amount.toLocaleString()}`;
};

// Payment Modal Component
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
  const [loanAmount, setLoanAmount] = useState(0);
  const [loanMonthlyDeduction, setLoanMonthlyDeduction] = useState(0);
  const [loanMonths, setLoanMonths] = useState(12);
  const [customNote, setCustomNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"payment" | "loan">("payment");

  const baseSalary = employee?.salary || 0;
  const netSalary = baseSalary + bonus - deductions;
  const monthlyLoanDeduction = loanMonthlyDeduction;

  const handleProcessPayment = async () => {
    setProcessing(true);
    
    try {
      // Get existing payroll records
      const payrollRecords = ls.get("payroll", []);
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      // Check if already processed for this month
      const alreadyProcessed = payrollRecords.some(
        (r: any) => r.employee_id === employee.id && r.month === currentMonth && r.year === currentYear
      );
      
      if (alreadyProcessed) {
        alert("Payroll for this employee has already been processed this month.");
        setProcessing(false);
        return;
      }
      
      // Create payroll record
      const payrollRecord = {
        id: uid("pay"),
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name || ""}`,
        month: currentMonth,
        year: currentYear,
        base_salary: baseSalary,
        bonus: bonus,
        deductions: deductions,
        deduction_reason: deductionReason,
        net_salary: netSalary,
        custom_note: customNote,
        status: "PAID",
        processed_at: new Date().toISOString(),
        company_id: employee.company_id,
        branch_id: employee.branch_id,
        created_by: permissionService.getCurrentUser()?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      ls.set("payroll", [payrollRecord, ...payrollRecords]);
      
      // If loan is being processed
      if (activeTab === "loan" && loanAmount > 0) {
        const existingLoans = ls.get("employeeLoans", []);
        const newLoan = {
          id: uid("loan"),
          employee_id: employee.id,
          employee_name: `${employee.first_name} ${employee.last_name || ""}`,
          loan_amount: loanAmount,
          monthly_deduction: loanMonthlyDeduction,
          total_months: loanMonths,
          remaining_amount: loanAmount,
          paid_months: 0,
          start_date: new Date().toISOString(),
          status: "ACTIVE",
          approved_by: permissionService.getCurrentUser()?.id,
          company_id: employee.company_id,
          branch_id: employee.branch_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        ls.set("employeeLoans", [newLoan, ...existingLoans]);
      }
      
      // Update employee payment status (optional - could store in a separate table)
      const paymentStatuses = ls.get("paymentStatuses", []);
      const paymentRecord = {
        id: uid("pstat"),
        employee_id: employee.id,
        month: currentMonth,
        year: currentYear,
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
        
        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("payment")}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "payment" 
                ? "text-primary border-b-2 border-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Payment Adjustment
          </button>
          <button
            onClick={() => setActiveTab("loan")}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "loan" 
                ? "text-primary border-b-2 border-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Apply Loan
          </button>
        </div>
        
        <div className="p-4">
          {/* Base Salary Display */}
          <div className="bg-muted/40 rounded-xl p-3 mb-4">
            <div className="text-xs text-muted-foreground">Base Salary</div>
            <div className="text-xl font-bold text-primary">{formatCurrency(baseSalary)}</div>
          </div>
          
          {activeTab === "payment" ? (
            <div className="space-y-4">
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
              
              {/* Deductions */}
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Minus className="w-3 h-3 text-destructive" /> Deductions
                </span>
                <input
                  type="number"
                  value={deductions}
                  onChange={(e) => setDeductions(Number(e.target.value) || 0)}
                  className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0"
                />
              </label>
              
              {/* Deduction Reason */}
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
              
              {/* Custom Note */}
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
            </div>
          ) : (
            <div className="space-y-4">
              {/* Loan Amount */}
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Loan Amount</span>
                <input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value) || 0)}
                  className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter loan amount"
                />
              </label>
              
              {/* Monthly Deduction */}
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Monthly Deduction Amount</span>
                <input
                  type="number"
                  value={loanMonthlyDeduction}
                  onChange={(e) => setLoanMonthlyDeduction(Number(e.target.value) || 0)}
                  className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Amount to deduct each month"
                />
              </label>
              
              {/* Loan Months */}
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Number of Months</span>
                <input
                  type="number"
                  value={loanMonths}
                  onChange={(e) => setLoanMonths(Number(e.target.value) || 1)}
                  min={1}
                  max={60}
                  className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              
              {/* Loan Summary */}
              {loanAmount > 0 && loanMonthlyDeduction > 0 && (
                <div className="bg-primary/10 rounded-xl p-3">
                  <div className="text-xs text-primary font-medium">Loan Summary</div>
                  <div className="text-sm mt-1">
                    Total: {formatCurrency(loanAmount)} | 
                    Monthly: {formatCurrency(loanMonthlyDeduction)} | 
                    Term: {loanMonths} months
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    This will be deducted from future payrolls
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Net Salary Preview */}
          {(activeTab === "payment" || (activeTab === "loan" && loanAmount > 0)) && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Net Payable (This Month)</span>
                <span className="text-2xl font-bold text-success">
                  {formatCurrency(activeTab === "payment" ? netSalary : baseSalary - monthlyLoanDeduction)}
                </span>
              </div>
              {activeTab === "loan" && loanMonthlyDeduction > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Includes loan deduction of {formatCurrency(monthlyLoanDeduction)}
                </div>
              )}
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
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

// View Payslip Modal
function PayslipModal({ employee, isOpen, onClose }: { employee: any; isOpen: boolean; onClose: () => void }) {
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  
  useEffect(() => {
    if (isOpen && employee) {
      const records = ls.get("payroll", []);
      const employeeRecords = records.filter((r: any) => r.employee_id === employee.id);
      setPayrollRecords(employeeRecords);
      
      const allLoans = ls.get("employeeLoans", []);
      const employeeLoans = allLoans.filter((l: any) => l.employee_id === employee.id);
      setLoans(employeeLoans);
    }
  }, [isOpen, employee]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Payslip - {employee?.first_name} {employee?.last_name || ""}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4">
          {/* Employee Info */}
          <div className="bg-muted/40 rounded-xl p-3 mb-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
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
                <div className="text-xs text-muted-foreground">Base Salary</div>
                <div className="font-medium text-primary">{formatCurrency(employee?.salary || 0)}</div>
              </div>
            </div>
          </div>
          
          {/* Active Loans */}
          {loans.filter(l => l.status === "ACTIVE").length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2">Active Loans</h3>
              <div className="space-y-2">
                {loans.filter(l => l.status === "ACTIVE").map((loan) => (
                  <div key={loan.id} className="bg-warning/10 rounded-xl p-3">
                    <div className="flex justify-between text-sm">
                      <span>Loan Amount</span>
                      <span className="font-medium">{formatCurrency(loan.loan_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span>Remaining</span>
                      <span className="font-medium">{formatCurrency(loan.remaining_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span>Monthly Deduction</span>
                      <span>{formatCurrency(loan.monthly_deduction)}</span>
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
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {record.month}/{record.year}
                        </div>
                        <div className="text-sm font-medium mt-1">
                          {formatCurrency(record.net_salary)}
                        </div>
                      </div>
                      <span className="text-xs bg-success/15 text-success px-2 py-0.5 rounded-full">
                        {record.status}
                      </span>
                    </div>
                    {record.bonus > 0 && (
                      <div className="text-xs text-success mt-1">+ Bonus: {formatCurrency(record.bonus)}</div>
                    )}
                    {record.deductions > 0 && (
                      <div className="text-xs text-destructive mt-1">
                        - Deductions: {formatCurrency(record.deductions)}
                        {record.deduction_reason && ` (${record.deduction_reason})`}
                      </div>
                    )}
                    {record.custom_note && (
                      <div className="text-xs text-muted-foreground mt-1">{record.custom_note}</div>
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

// Main Payroll Page Component
export default function PayrollPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [paymentStatuses, setPaymentStatuses] = useState<any[]>([]);
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
  }, []);
  
  const loadEmployees = () => {
    const allEmployees = ls.get("employees", []);
    const filtered = companyContext.filterByContext(allEmployees);
    // Only show active employees for payroll
    const activeEmployees = filtered.filter(e => e.employment_status === "ACTIVE");
    setEmployees(activeEmployees);
  };
  
  const loadPaymentStatuses = () => {
    const statuses = ls.get("paymentStatuses", []);
    setPaymentStatuses(statuses);
  };
  
  const getPaymentStatusForMonth = (employeeId: string) => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const status = paymentStatuses.find(
      (s: any) => s.employee_id === employeeId && s.month === currentMonth && s.year === currentYear
    );
    return status?.status || "PENDING";
  };
  
  const handleRefresh = () => {
    loadEmployees();
    loadPaymentStatuses();
  };
  
  // Calculate statistics
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
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-muted"
          >
            <Calendar className="w-4 h-4" />
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
          </button>
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
          <div className="mt-1 text-[11px] text-success">+3% from last month</div>
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
          <div className="mt-1 text-[11px] text-success">+3% vs last month</div>
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
                {new Date().toLocaleString('default', { month: 'short', year: 'numeric' })}
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
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    No employees found.
                  </td>
                </tr>
              )}
              {filteredEmployees.map((employee) => {
                const status = getPaymentStatusForMonth(employee.id);
                const isPaid = status === "PAID";
                return (
                  <tr key={employee.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{employee.first_name} {employee.last_name || ""}</div>
                      <div className="text-xs text-muted-foreground">{employee.designation || employee.department || "—"}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(employee.salary || 0)}
                    </td>
                    <td className="px-4 py-3 text-success">
                      {isPaid ? "—" : <span className="text-xs">+ Add</span>}
                    </td>
                    <td className="px-4 py-3 text-destructive">
                      {isPaid ? "—" : <span className="text-xs">- Add</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {formatCurrency(employee.salary || 0)}
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
    </div>
  );
}