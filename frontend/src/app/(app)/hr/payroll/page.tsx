// src/app/(app)/hr/payroll/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useActiveEmployees } from "@/hooks/useEmployees";
import { usePayroll, usePayrollStats, useEmployeeLoans, useCompensations } from "@/hooks/usePayroll";
import { useLeaves } from "@/hooks/useLeaves";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import PageHeader from "@/components/PageHeader";
import PaymentModal from "@/components/payroll/PaymentModal";
import PayslipModal from "@/components/payroll/PayslipModal";
import MonthSelectorModal from "@/components/payroll/MonthSelectorModal";
import { useRouter } from "next/navigation";
import { Search, Filter, Eye, CreditCard, Calendar, RefreshCw, Info } from "lucide-react";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { getPermissions } from "@/lib/permissions";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
type PayrollApiModule = "hr" | "finance";

export default function HrPayrollPage() {
  return <PayrollPage module="hr" title="Payroll Management" permissionModule="HR" />;
}

export function PayrollPage({
  module = "hr",
  title = "Payroll Management",
  permissionModule = "HR",
}: {
  module?: PayrollApiModule;
  title?: string;
  permissionModule?: "HR" | "FINANCE";
}) {
  const router = useRouter();
  const formatCurrency = useFormatCurrency();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const defaultPrevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const defaultPrevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const [selectedMonth, setSelectedMonth] = useState(defaultPrevMonth);
  const [selectedYear, setSelectedYear] = useState(defaultPrevYear);
  const [monthSelectorOpen, setMonthSelectorOpen] = useState(false);

  // Fetch data from backend
  const { data: employees = [], isLoading: employeesLoading } = useActiveEmployees();
  const { data: allLoans = [] } = useEmployeeLoans();
  const { data: compensations = [] } = useCompensations();
  const { data: leaves = [] } = useLeaves();
  const { data: payrollRecords = [], isLoading: payrollLoading } = usePayroll({
    month: String(selectedMonth),
    year: String(selectedYear),
  }, module);
  const { data: stats, isLoading: statsLoading } = usePayrollStats({
    month: String(selectedMonth),
    year: String(selectedYear),
  }, module);

  const permissions = useSelector(
  (state: RootState) => state.permissions.permissions
);

const payrollPermissions = getPermissions(
  permissions,
  permissionModule,
  "payroll"
);
  // Get payment status for employee in selected month
  const getPaymentStatus = (employeeId: string) => {
    const record = payrollRecords.find(
      r => r.employee_id === employeeId && r.month === selectedMonth && r.year === selectedYear
    );
    return record?.payment_status || record?.status || "PENDING";
  };

  // Get payroll record for employee
  const getPayrollRecord = (employeeId: string) => {
    return payrollRecords.find(
      r => r.employee_id === employeeId && r.month === selectedMonth && r.year === selectedYear
    );
  };

  // Get advance loan for this employee/month (PAID = not yet returned)
  const getAdvanceLoan = (employeeId: string) => {
    return allLoans.find(
      l => l.employee_id === employeeId
        && l.loan_type === "SALARY_ADVANCE"
        && l.advance_for_month === selectedMonth
        && l.advance_for_year === selectedYear
        && l.approval === "CONFIRM"
        && l.status === "PAID"
    );
  };

  // Helper: check if an active compensation applies to the selected month
  const compensationAppliesToMonth = (comp: any): boolean => {
    if (comp.status !== 'ACTIVE') return false;
    const freq = comp.frequency_type;
    if (freq === 'ONE_TIME' || freq === 'SELECTED_MONTH') {
      return comp.selected_months?.some(
        (sm: any) => sm.month === selectedMonth && sm.year === selectedYear
      ) ?? false;
    }
    if (freq === 'MONTH_RANGE') {
      const mr = comp.month_range;
      if (!mr) return false;
      const startVal = mr.start_year * 12 + mr.start_month;
      const endVal = mr.end_year * 12 + mr.end_month;
      const curVal = selectedYear * 12 + selectedMonth;
      return curVal >= startVal && curVal <= endVal;
    }
    return true; // OTHER/MONTHLY — always applies
  };

  // Helper: does an advance payroll have outstanding items (comp/leave/loans) to process?
  const hasAdvanceItems = (employeeId: string): boolean => {
    const payrollRecord = getPayrollRecord(employeeId);
    if (!payrollRecord || payrollRecord.transaction_type !== 'ADVANCE') return false;

    // Check if compensation applies to this month
    const empComp = compensations.find(c => c.employee_id === employeeId && c.status === 'ACTIVE');
    if (empComp && compensationAppliesToMonth(empComp)) return true;

    // Check paid non-advance loans that apply to this month
    const empLoans = allLoans.filter((l: any) => {
      if (l.employee_id !== employeeId || l.approval !== 'CONFIRM' || l.status !== 'PAID' || l.loan_type === 'SALARY_ADVANCE') return false;
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
    if (empLoans.length > 0) return true;

    // Check approved leaves overlapping this month
    const hasLeave = leaves.some(l => {
      if (l.employee_id !== employeeId || l.status !== 'APPROVED') return false;
      const startDate = new Date(l.start_date);
      const endDate = new Date(l.end_date);
      const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
      const monthEnd = new Date(selectedYear, selectedMonth, 0);
      return startDate <= monthEnd && endDate >= monthStart;
    });
    if (hasLeave) return true;

    return false;
  };

  // Filter employees by search, status, and joining date
  const filteredEmployees = employees.filter(emp => {
    // Exclude employees who haven't joined by the selected month
    if (emp.joining_date) {
      const joinDate = new Date(emp.joining_date);
      const joinMonth = joinDate.getMonth() + 1;
      const joinYear = joinDate.getFullYear();
      if (joinYear > selectedYear || (joinYear === selectedYear && joinMonth > selectedMonth)) {
        return false;
      }
    }

    const searchTerm = searchQuery.toLowerCase();
    const matchesSearch =
      emp.first_name?.toLowerCase().includes(searchTerm) ||
      emp.last_name?.toLowerCase().includes(searchTerm) ||
      emp.department_name?.toLowerCase().includes(searchTerm) ||
      emp.designation_name?.toLowerCase().includes(searchTerm) ||
      emp.employee_id?.toLowerCase().includes(searchTerm);
    
    const status = getPaymentStatus(emp.id);
    const matchesStatus = statusFilter === "all" || status === statusFilter.toUpperCase();
    
    return matchesSearch && matchesStatus;
  });

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

const payrollQuery = usePayroll({
  month: String(selectedMonth),
  year: String(selectedYear),
}, module);

const statsQuery = usePayrollStats({
  month: String(selectedMonth),
  year: String(selectedYear),
}, module);

const handleRefresh = () => {
  payrollQuery.refetch();
  statsQuery.refetch();
};

  if ( employeesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const paidCount = stats?.paidCount || employees.filter(e => getPaymentStatus(e.id) === "PAID").length;
  const pendingCount = employees.length - paidCount;
  const totalPayroll = stats?.totalPayroll ? parseFloat(stats.totalPayroll) : employees.reduce((sum, e) => sum + (parseFloat(e.salary) || 0), 0);
  const avgSalary = stats?.avgSalary ? parseFloat(stats.avgSalary) : (employees.length > 0 ? totalPayroll / employees.length : 0);

  const overallPayable = employees.reduce((sum, employee) => {
    if (getPaymentStatus(employee.id) === "PAID") return sum;
    const record = getPayrollRecord(employee.id);
    return sum + parseFloat(record?.net_salary || employee.salary || "0");
  }, 0);

  return (
    <div>
      <PageHeader
        title={title}
        subtitle="Process salaries and manage payslips via centralized payments"
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
<StatsCards
  className="mb-5"
  stats={[
    {
      id: "total-payroll",
      label: "Total Payroll",
      value: `${formatCurrency(totalPayroll)}`,
    },
    {
      id: "paid-employees",
      label: "Paid Employees",
      value:
        employees.length > 0
          ? `${paidCount} (${Math.round(
              (paidCount / employees.length) * 100
            )}%)`
          : paidCount,
    },
    {
      id: "pending-payments",
      label: "Pending Payments",
      value: `${pendingCount}`,
    },
    {
      id: "avg-salary",
      label: "Avg. Salary",
      value: `${formatCurrency(avgSalary)}`,
    },
    {
      id: "overall-payable",
      label: "Overall Payable",
      value: `${formatCurrency(overallPayable)}`,
    },
  ]}
/>

      {/* Advance Salary Banner */}
      {(selectedYear > currentYear || (selectedYear === currentYear && selectedMonth >= currentMonth)) && (
        <div className="bg-amber/10 border border-amber/30 rounded-xl p-4 mb-4 flex items-center gap-3">
          <Info className="w-5 h-5 text-amber shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber">Future Month - Advance Salary</p>
            <p className="text-xs text-muted-foreground">
              Click <strong>Process Payment</strong> on any employee to create a Salary Advance loan. The advance will be auto-deducted when regular payroll runs for this month.
            </p>
          </div>
        </div>
      )}

      {/* Employee Payment Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm">
        <div className="p-3 border-b border-border">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, department..."
                className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-9 pr-3 h-9 rounded-md border border-border bg-muted/40 text-sm outline-none"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Employee</th>
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
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">
                    No employees found for {monthNames[selectedMonth - 1]}, {selectedYear}.
                  </td>
                </tr>
              )}
              {filteredEmployees.map((employee) => {
                const status = getPaymentStatus(employee.id);
                const isPaid = status === "PAID";
                const payrollRecord = getPayrollRecord(employee.id);

                return (
                  <tr key={employee.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`payroll/${employee.id}`)}
                        className="text-left hover:underline"
                      >
                        <div className="font-medium">{employee.first_name} {employee.last_name || ""}</div>
                        <div className="text-xs text-muted-foreground">{employee.designation_name || employee.department_name || ""}</div>
                      </button>
                      {(() => {
                        const advance = getAdvanceLoan(employee.id);
                        return advance ? (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-full bg-amber/10 text-amber border border-amber/30">
                              Advance: {formatCurrency(parseFloat(advance.remaining_amount || advance.total_payable))}
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-primary">
                        {payrollRecord?.transaction_number || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(parseFloat(payrollRecord?.base_salary || employee.salary || "0"))}
                    </td>
                    <td className="px-4 py-3 text-success">
                      {payrollRecord?.bonus && parseFloat(payrollRecord.bonus) > 0 
                        ? formatCurrency(parseFloat(payrollRecord.bonus)) 
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-destructive">
                      {payrollRecord?.deductions && parseFloat(payrollRecord.deductions) > 0 
                        ? formatCurrency(parseFloat(payrollRecord.deductions)) 
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {payrollRecord?.net_salary 
                        ? formatCurrency(parseFloat(payrollRecord.net_salary)) 
                        : formatCurrency(parseFloat(employee.salary || "0"))}
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
                          title="View Payslip"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(selectedYear > currentYear || (selectedYear === currentYear && selectedMonth >= currentMonth)
                          ? !getAdvanceLoan(employee.id) && !isPaid
                          : !isPaid || hasAdvanceItems(employee.id)
                        ) && payrollPermissions.pay_salary && (
                          <button
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setPaymentModalOpen(true);
                            }}
                            className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary"
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
        <div className="p-3 border-t border-border flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Showing {filteredEmployees.length} of {employees.length} employees
          </div>
          <div className="text-xs text-muted-foreground">
            Total Payroll: {formatCurrency(totalPayroll)}
          </div>
        </div>
      </div>

      {/* Modals */}
      {(paymentModalOpen && selectedEmployee && payrollPermissions.pay_salary)&& (
        <PaymentModal
          formatCurrency={formatCurrency}
          employee={selectedEmployee}
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedEmployee(null);
          }}
          onSuccess={handleRefresh}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          apiModule={module}
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