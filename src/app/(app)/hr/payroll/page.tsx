// src/app/(app)/hr/payroll/page.tsx
"use client";

import { useState, useEffect } from "react";
import { ls } from "@/services/localStorageService";
import { companyContext } from "@/services/companyContextService";
import { permissionService } from "@/services/permissionService";
import PageHeader from "@/components/PageHeader";
import { DollarSign, Users, Clock, TrendingUp, Search, Filter, Eye, CreditCard, Plus, Minus, X, Calendar, FileText, CheckCircle, AlertCircle, Wallet, HandCoins, Receipt, Hash, User, Building2, Briefcase, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import PaymentModal from "@/components/payroll/PaymentModal";
import PayslipModal from "@/components/payroll/PayslipModal";
import MonthSelectorModal from "@/components/payroll/MonthSelectorModal";
import CompensationLoanPage from "@/components/payroll/CompensationLoanPage";

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return `PKR ${(amount || 0).toLocaleString()}`;
};
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
    const allEmployees = (ls.get("employees") || []);
    const filtered = companyContext.filterByContext(allEmployees);
    const activeEmployees = filtered.filter((e: any) => e.employment_status === "ACTIVE");
    setEmployees(activeEmployees);
  };

  const loadPaymentStatuses = () => {
    const statuses = (ls.get("paymentStatuses") || []);
    const filteredForMonth = statuses.filter((s: any) => s.month === selectedMonth && s.year === selectedYear);
    setPaymentStatuses(filteredForMonth);
  };

  const getPaymentStatusForMonth = (employeeId: string) => {
    const status = paymentStatuses.find((s: any) => s.employee_id === employeeId);
    return status?.status || "PENDING";
  };

  const getPayrollRecord = (employeeId: string) => {
    const records = (ls.get("payroll") || []);
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
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border ${isPaid
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
      <CompensationLoanPage onRefresh={handleRefresh} formatCurrency={formatCurrency} />

      {/* Modals */}
      {paymentModalOpen && selectedEmployee && (
        <PaymentModal
        formatCurrency={formatCurrency}
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
                formatCurrency={formatCurrency}
          employee={selectedEmployee}
          isOpen={payslipModalOpen}
          onClose={() => {
            setPayslipModalOpen(false);
            setSelectedEmployee(null);
          }}
        />
      )}

      <MonthSelectorModal
      formatCurrency={formatCurrency}
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