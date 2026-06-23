// src/app/(app)/hr/payroll/page.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { usePayroll, usePayrollStats, useEmployeeLoans, useCompensations } from "@/hooks/usePayroll";
import { useLeaves } from "@/hooks/useLeaves";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import PageHeader from "@/components/PageHeader";
import PaymentModal from "@/components/payroll/PaymentModal";
import PayslipModal from "@/components/payroll/PayslipModal";
import MonthSelectorModal from "@/components/payroll/MonthSelectorModal";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { useRouter } from "next/navigation";
import { Eye, CreditCard, Calendar, RefreshCw, Info, ChevronLeft, ChevronRight } from "lucide-react";
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
  const api = useApi();
  const formatCurrency = useFormatCurrency();
  const [filters, setFilters] = useState<Record<string, string>>({});
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
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => { setPage(1); }, [filters, selectedMonth, selectedYear]);

  // Fetch paginated employees from server (filtered by search + joining date)
  const joiningDateLte = useMemo(() => {
    const lastDay = new Date(selectedYear, selectedMonth, 0);
    const y = lastDay.getFullYear();
    const m = String(lastDay.getMonth() + 1).padStart(2, '0');
    const d = String(lastDay.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedMonth, selectedYear]);

  const employeeParams = useMemo(() => ({
    page: String(page),
    page_size: String(pageSize),
    ...(filters.search ? { search: filters.search } : {}),
    joining_date__lte: joiningDateLte,
    employment_status: "ACTIVE",
  }), [page, pageSize, filters.search, joiningDateLte]);

  const employeeQuery = useQuery<{
    count: number;
    total_pages: number;
    current_page: number;
    results: any[];
  }>({
    queryKey: ["payroll-employees", employeeParams],
    queryFn: () => {
      const qs = new URLSearchParams(employeeParams).toString();
      return api(`/api/hr/employees/?${qs}`);
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const employees = employeeQuery.data?.results ?? [];
  const employeeTotal = employeeQuery.data?.count ?? 0;
  const employeeTotalPages = employeeQuery.data?.total_pages ?? 0;

  // Fetch supporting data (loans, compensations, leaves) filtered by selected month
  const { data: allLoans = [] } = useEmployeeLoans({
    advance_for_month: String(selectedMonth),
    advance_for_year: String(selectedYear),
  });
  const { data: compensations = [] } = useCompensations({ month: String(selectedMonth), year: String(selectedYear) });
  const { data: leaves = [] } = useLeaves({ month: String(selectedMonth), year: String(selectedYear) });

  // Fetch ALL payroll records for this month (needed for status lookup across all displayed employees)
  const payrollApiParams = useMemo(() => ({
    month: String(selectedMonth),
    year: String(selectedYear),
    ...(filters.search ? { search: filters.search } : {}),
    page_size: "10000",
  }), [selectedMonth, selectedYear, filters.search]);

  const { data: payrollRecords = [], refetch } = usePayroll(payrollApiParams, module);

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
    if (comp.status !== 'CONFIRM') return false;
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
    const empComp = compensations.find(c => c.employee_id === employeeId && c.status === 'CONFIRM');
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

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

const statsQuery = usePayrollStats({
  month: String(selectedMonth),
  year: String(selectedYear),
}, module);

const handleRefresh = () => {
  refetch();
  statsQuery.refetch();
};

  const paidCount = statsQuery.data?.paidCount ?? 0;
  const pendingCount = statsQuery.data?.pendingCount ?? 0;
  const totalPayroll = statsQuery.data?.totalPayroll ? parseFloat(statsQuery.data.totalPayroll) : 0;
  const avgSalary = statsQuery.data?.avgSalary ? parseFloat(statsQuery.data.avgSalary) : 0;
  const totalEmployees = statsQuery.data?.totalEmployees ?? 0;

  // Post-filter employees by payment status (client-side since status is computed from payroll records)
  const displayEmployees = useMemo(() => {
    if (!filters.status) return employees;
    return employees.filter(e => getPaymentStatus(e.id) === filters.status.toUpperCase());
  }, [employees, filters.status]);

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
        totalEmployees > 0
          ? `${paidCount} (${Math.round(
              (paidCount / totalEmployees) * 100
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
  ]}
/>

      {/* Advance Salary Banner */}
      {(selectedYear > currentYear || (selectedYear === currentYear && selectedMonth > currentMonth)) && (
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

      {/* Filter Bar */}
      <div className="mb-4">
        <FilterBar
          fields={[
            { name: "search", label: "Search", type: "search" },
            { name: "status", label: "Payment", type: "status", options: [{ value: "pending", label: "Pending" }, { value: "paid", label: "Paid" }] },
          ]}
          filters={filters}
          onChange={(f) => { setFilters(f); setPage(1); }}
        />
      </div>

      {/* Employee Payment Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm">
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
              {employeeQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-border animate-pulse">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">
                    No employees found for {monthNames[selectedMonth - 1]}, {selectedYear}.
                  </td>
                </tr>
              ) : displayEmployees.map((employee) => {
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
                        {(selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth))
                          && (!isPaid || hasAdvanceItems(employee.id))
                          && payrollPermissions.pay_salary && (
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
            Showing {employeeTotal === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, employeeTotal)} of {employeeTotal} employees
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground">
              Total Payroll: {formatCurrency(totalPayroll)}
            </div>
            {employeeTotal > pageSize && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Page {page} of {employeeTotalPages}</span>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= employeeTotalPages}
                  className="p-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
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