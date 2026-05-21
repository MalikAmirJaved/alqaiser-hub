// src/app/(app)/hr/payroll/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import { usePayroll, usePayrollStats } from "@/hooks/usePayroll";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { permissionService } from "@/services/permissionService";
import PageHeader from "@/components/PageHeader";
import PaymentModal from "@/components/payroll/PaymentModal";
import PayslipModal from "@/components/payroll/PayslipModal";
import MonthSelectorModal from "@/components/payroll/MonthSelectorModal";
import { DollarSign, Users, Clock, TrendingUp, Search, Filter, Eye, CreditCard, Calendar, RefreshCw } from "lucide-react";

export default function PayrollPage() {
  const { formatCurrency } = useCompanySettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthSelectorOpen, setMonthSelectorOpen] = useState(false);

  // Fetch data from backend
  const { data: employees = [], isLoading: employeesLoading } = useEmployees();
  const { data: payrollRecords = [], isLoading: payrollLoading } = usePayroll({
    month: String(selectedMonth),
    year: String(selectedYear),
  });
  const { data: stats, isLoading: statsLoading } = usePayrollStats({
    month: String(selectedMonth),
    year: String(selectedYear),
  });
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canView: true,
    loading: true,
  });

  useEffect(() => {
    permissionService.init();
    setPermissions({
      canCreate: permissionService.hasPermission("HR", "Payroll", "create"),
      canUpdate: permissionService.hasPermission("HR", "Payroll", "update"),
      canView: permissionService.hasPermission("HR", "Payroll", "view"),
      loading: false,
    });
  }, []);

  // Get payment status for employee in selected month
  const getPaymentStatus = (employeeId: string) => {
    const record = payrollRecords.find(
      r => r.employee_id === employeeId && r.month === selectedMonth && r.year === selectedYear
    );
    return record?.status || "PENDING";
  };

  // Get payroll record for employee
  const getPayrollRecord = (employeeId: string) => {
    return payrollRecords.find(
      r => r.employee_id === employeeId && r.month === selectedMonth && r.year === selectedYear
    );
  };

  // Filter active employees
  const activeEmployees = employees.filter(e => e.employment_status === "ACTIVE");

  // Filter employees by search and status
  const filteredEmployees = activeEmployees.filter(emp => {
    const searchTerm = searchQuery.toLowerCase();
    const matchesSearch =
      emp.first_name?.toLowerCase().includes(searchTerm) ||
      emp.last_name?.toLowerCase().includes(searchTerm) ||
      emp.department?.toLowerCase().includes(searchTerm) ||
      emp.designation?.toLowerCase().includes(searchTerm) ||
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
});

const statsQuery = usePayrollStats({
  month: String(selectedMonth),
  year: String(selectedYear),
});

const handleRefresh = () => {
  payrollQuery.refetch();
  statsQuery.refetch();
};

  if (permissions.loading || employeesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const paidCount = stats?.paidCount || activeEmployees.filter(e => getPaymentStatus(e.id) === "PAID").length;
  const pendingCount = activeEmployees.length - paidCount;
  const totalPayroll = stats?.totalPayroll ? parseFloat(stats.totalPayroll) : activeEmployees.reduce((sum, e) => sum + (parseFloat(e.salary) || 0), 0);
  const avgSalary = stats?.avgSalary ? parseFloat(stats.avgSalary) : (activeEmployees.length > 0 ? totalPayroll / activeEmployees.length : 0);

  return (
    <div>
      <PageHeader
        title="Payroll Management"
        subtitle="Process salaries and manage payslips"
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
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold">{paidCount}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {activeEmployees.length > 0 ? Math.round((paidCount / activeEmployees.length) * 100) : 0}% of all staff
          </div>
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
                      <div className="font-medium">{employee.first_name} {employee.last_name || ""}</div>
                      <div className="text-xs text-muted-foreground">{employee.designation || employee.department || ""}</div>
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
                        {!isPaid && permissions.canCreate && (
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
            Showing {filteredEmployees.length} of {activeEmployees.length} employees
          </div>
          <div className="text-xs text-muted-foreground">
            Total Payroll: {formatCurrency(totalPayroll)}
          </div>
        </div>
      </div>

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
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
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