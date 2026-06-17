// src/app/(app)/hr/salary/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEmployees } from "@/hooks/useEmployees";
import { usePayroll, useEmployeeLoans, useCompensations, computeTotalMonths } from "@/hooks/usePayroll";
import { useLeaves } from "@/hooks/useLeaves";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  DollarSign,
  TrendingDown,
  Wallet,
  CreditCard,
  Calendar,
  Clock,
  FileText,
  Info,
  AlertCircle,
  BadgeCheck,
  Percent,
  Hash,
  User,
  Sparkles,
  BarChart3,
  Activity,
  Award,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtCurrency = (val?: string | number | null, currency = "USD") => {
  const n = parseFloat(String(val ?? 0));
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(n);
};

const fmtDate = (val?: string | null) => {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
};

const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

const statusColors: Record<string, string> = {
  PAID: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  RETURNED: "bg-green-500/15 text-green-600 border-green-500/30",
  ACTIVE: "bg-success/15 text-success border-success/20",
  PENDING: "bg-warning/15 text-warning border-warning/20",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  APPROVED: "bg-success/15 text-success border-success/20",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/20",
  ADVANCE: "bg-amber/15 text-amber border-amber/30",
  SALARY: "bg-info/15 text-info border-info/30",
};

const badge = (label: string, cls?: string) => (
  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap", cls)}>
    {label}
  </span>
);

const statCard = (icon: any, label: string, value: string, color = "text-primary") => (
  <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color === "text-success" ? "bg-success/15" : color === "text-destructive" ? "bg-destructive/15" : color === "text-amber" ? "bg-amber/15" : "bg-primary/15")}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold truncate", color)}>{value}</p>
    </div>
  </div>
);

function SectionCard({ title, icon: Icon, children, className }: any) {
  return (
    <div className={cn("bg-card border border-border rounded-xl overflow-hidden", className)}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground tracking-wide">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono = false, children }: any) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5 min-w-[130px]">{label}</span>
      {children ?? (
        <span className={cn("text-sm text-right break-all", mono ? "font-mono text-xs" : "font-medium")}>
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

function EmptyState({ message, icon: Icon }: { message: string; icon?: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
        {Icon ? <Icon className="w-5 h-5 text-muted-foreground" /> : <Info className="w-5 h-5 text-muted-foreground" />}
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// Progress bar component
function ProgressBar({ value, max, label, color = "bg-primary" }: { value: number; max: number; label?: string; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      {label && (
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function EmployeeSalaryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // ── Data Fetching ──────────────────────────────────────────────
  const { data: employees = [], isLoading: empLoading } = useEmployees();
  const employee = employees.find((e) => e.id === id);

  const { data: payrollRecords = [], isLoading: payrollLoading } = usePayroll(
    id ? { employee_id: id } : undefined
  );
  const { data: loans = [] } = useEmployeeLoans(id ? { employee_id: id } : undefined);
  const { data: compensations = [] } = useCompensations(id ? { employee_id: id } : undefined);
  const { data: leaves = [] } = useLeaves(id ? { employee_id: id } : undefined);

  const activeCompensation = compensations.find((c) => c.status === "CONFIRM");
  const isLoading = empLoading || payrollLoading;

  // ── Computed Summary Stats ──────────────────────────────────────
  const totalBasePaid = payrollRecords.reduce((s, r) => s + parseFloat(r.base_salary || "0"), 0);
  const totalCompensationPaid = payrollRecords.reduce((s, r) => s + parseFloat(r.total_compensation || "0"), 0);
  const totalBonus = payrollRecords.reduce((s, r) => s + parseFloat(r.bonus || "0"), 0);
  const totalDeductions = payrollRecords.reduce((s, r) => s + parseFloat(r.deductions || "0"), 0);
  const totalNetPaid = payrollRecords.reduce((s, r) => s + parseFloat(r.net_salary || "0"), 0);
  const totalLoanDeduction = payrollRecords.reduce((s, r) => s + parseFloat(r.total_loan_deduction || "0"), 0);
  const totalLeaveDeduction = payrollRecords.reduce((s, r) => s + parseFloat(r.total_leave_deduction || "0"), 0);

  // Loans summary
  const personalLoans = loans.filter((l) => l.loan_type !== "SALARY_ADVANCE" && l.approval === "CONFIRM");
  const advanceLoans = loans.filter((l) => l.loan_type === "SALARY_ADVANCE");
  const totalLoanPrincipal = personalLoans.reduce((s, l) => s + parseFloat(l.principal_amount || "0"), 0);
  const totalLoanRemaining = personalLoans.reduce((s, l) => s + parseFloat(l.remaining_amount || "0"), 0);
  const totalLoanPaid = personalLoans.reduce((s, l) => s + parseFloat(l.paid_amount || "0"), 0);

  // Advances summary
  const activeAdvances = advanceLoans.filter((l) => l.status === "PAID");
  const returnedAdvances = advanceLoans.filter((l) => l.status === "RETURNED");
  const totalAdvanceAmount = advanceLoans.reduce((s, l) => s + parseFloat(l.principal_amount || "0"), 0);
  const totalAdvanceOutstanding = activeAdvances.reduce((s, l) => s + parseFloat(l.remaining_amount || "0"), 0);
  const totalAdvanceDeducted = advanceLoans.reduce((s, l) => s + parseFloat(l.paid_amount || "0"), 0);

  // Leaves summary
  const approvedLeaves = leaves.filter((l) => l.status === "APPROVED");
  const totalLeaveDays = approvedLeaves.reduce((s, l) => s + (l.total_days || 0), 0);

  // Payroll records sorted by year/month descending
  const sortedPayroll = [...payrollRecords].sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.month - a.month
  );

  // ── Loading / Not Found ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading salary details...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-semibold">Employee not found</h2>
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const fullName = `${employee.first_name} ${employee.last_name || ""}`.trim();

  return (
    <div className="space-y-6 pb-10">

      {/* ── Back & Header ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Salary Detail</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <User className="w-3.5 h-3.5" />
              {fullName}
              <span className="text-muted-foreground/50">·</span>
              <span className="font-mono text-xs">{employee.employee_id}</span>
              <span className="text-muted-foreground/50">·</span>
              {employee.department_name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {badge(employee.employment_status?.replace("_", " "), statusColors[employee.employment_status])}
            {badge("Joined " + fmtDate(employee.joining_date), "bg-muted text-muted-foreground border-border")}
          </div>
        </div>
      </div>

      {/* ── Summary Stats Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCard(<DollarSign className="w-5 h-5 text-primary" />, "Total Gross Paid", fmtCurrency(totalBasePaid + totalCompensationPaid + totalBonus), "text-primary")}
        {statCard(<TrendingDown className="w-5 h-5 text-destructive" />, "Total Deductions", fmtCurrency(totalDeductions), "text-destructive")}
        {statCard(<Wallet className="w-5 h-5 text-success" />, "Net Paid Out", fmtCurrency(totalNetPaid), "text-success")}
        {statCard(<CreditCard className="w-5 h-5 text-amber" />, "Loans Outstanding", fmtCurrency(totalLoanRemaining + totalAdvanceOutstanding), "text-amber")}
        {statCard(<Sparkles className="w-5 h-5 text-info" />, "Advances Created", fmtCurrency(totalAdvanceAmount), "text-info")}
        {statCard(<Calendar className="w-5 h-5 text-primary" />, "Payroll Cycles", `${payrollRecords.length} months`, "text-primary")}
      </div>

      {/* ── Salary Overview ──────────────────────────────────── */}
      <SectionCard title="Salary Overview" icon={BarChart3}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Base Salary" value={fmtCurrency(employee.salary)} />
          <InfoRow label="Total Base Paid" value={fmtCurrency(totalBasePaid)} />
          <InfoRow label="Total Compensation Paid" value={fmtCurrency(totalCompensationPaid)} />
          <InfoRow label="Total Bonus Paid" value={fmtCurrency(totalBonus)} />
          <InfoRow label="Total Loan Deductions" value={fmtCurrency(totalLoanDeduction)} />
          <InfoRow label="Total Leave Deductions" value={fmtCurrency(totalLeaveDeduction)} />
          <InfoRow label="Other Deductions" value={fmtCurrency(totalDeductions - totalLoanDeduction - totalLeaveDeduction)} />
          <InfoRow label="Total Net Paid" value={fmtCurrency(totalNetPaid)} />
        </div>
        {/* Cumulative flow visualization */}
        <div className="mt-5 pt-5 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-3">Money Flow</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-28 shrink-0">Gross Earnings</span>
              <div className="flex-1 h-7 bg-success/20 rounded-lg flex items-center px-3">
                <span className="text-xs font-semibold text-success">{fmtCurrency(totalBasePaid + totalCompensationPaid + totalBonus)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-28 shrink-0">Total Deductions</span>
              <div className="flex-1 h-7 bg-destructive/20 rounded-lg flex items-center px-3">
                <span className="text-xs font-semibold text-destructive">−{fmtCurrency(totalDeductions)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-28 shrink-0">Net Paid</span>
              <div className="flex-1 h-7 bg-primary/20 rounded-lg flex items-center px-3">
                <span className="text-xs font-semibold text-primary">={fmtCurrency(totalNetPaid)}</span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Compensation Structure ──────────────────────────── */}
      <SectionCard title="Compensation Structure" icon={Award}>
        {!activeCompensation ? (
          <EmptyState message="No active compensation structure." icon={Info} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow label="Frequency" value={activeCompensation.frequency_type === "ONE_TIME" ? "One Time" : activeCompensation.frequency_type === "SELECTED_MONTH" ? "Selected Months" : "Monthly Range"} />
              <InfoRow label="Total Allowances" value={fmtCurrency(activeCompensation.total_allowances)} />
              <InfoRow label="Total CTC" value={fmtCurrency(activeCompensation.total_ctc)} />
              <InfoRow label="Monthly Total" value={fmtCurrency(activeCompensation.total_monthly)} />
            </div>
            {/* Allowances breakdown */}
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Allowances Breakdown</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {[
                  { label: "HRA", val: activeCompensation.house_rent_allowance },
                  { label: "Medical", val: activeCompensation.medical_allowance },
                  { label: "Transport", val: activeCompensation.transport_allowance },
                  { label: "Phone", val: activeCompensation.phone_allowance },
                  { label: "Utilities", val: activeCompensation.utilities_allowance },
                  { label: "Education", val: activeCompensation.education_allowance },
                  { label: "Others", val: activeCompensation.other_allowances },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-background rounded-lg px-3 py-2 border border-border">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold">{fmtCurrency(val)}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Frequency schedule */}
            {activeCompensation.month_range && (
              <div className="bg-muted/30 rounded-lg p-3 flex items-center gap-4">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Active period:</span>
                <span className="text-sm font-medium">
                  {monthNames[activeCompensation.month_range.start_month - 1]} {activeCompensation.month_range.start_year}
                  {" — "}
                  {monthNames[activeCompensation.month_range.end_month - 1]} {activeCompensation.month_range.end_year}
                </span>
              </div>
            )}
            {activeCompensation.selected_months && activeCompensation.selected_months.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Compensation Payment Status</p>
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-2 pr-4 text-xs text-muted-foreground font-medium">Month</th>
                        <th className="pb-2 pr-4 text-xs text-muted-foreground font-medium">Allocated</th>
                        <th className="pb-2 pr-4 text-xs text-muted-foreground font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCompensation.selected_months.map((sm, i) => {
                        const paid = activeCompensation.paid_months_set?.some(([m, y]) => m === sm.month && y === sm.year);
                        return (
                          <tr key={i} className="border-b border-border/40">
                            <td className="py-2 pr-4">
                              <span className="text-sm font-medium">{monthNames[sm.month - 1]} {sm.year}</span>
                            </td>
                            <td className="py-2 pr-4">
                              <span className="text-sm font-semibold">{fmtCurrency(activeCompensation.total_allowances)}</span>
                            </td>
                            <td className="py-2">
                              {paid
                                ? badge("Paid", statusColors.PAID)
                                : badge("Pending", "bg-warning/15 text-warning border-warning/20")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  <span>Total allocated: <strong className="text-foreground">{fmtCurrency(parseFloat(activeCompensation.total_allowances) * activeCompensation.selected_months.length)}</strong></span>
                  <span>
                    Paid: <strong className="text-success">{activeCompensation.paid_months_set?.length || 0}</strong> / {activeCompensation.selected_months.length} months
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Payroll History ──────────────────────────────────── */}
      <SectionCard title="Payroll History" icon={FileText}>
        {sortedPayroll.length === 0 ? (
          <EmptyState message="No payroll records found." icon={FileText} />
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Period", "Type", "Base", "Comp", "Bonus", "Loan Ded.", "Leave Ded.", "Other Ded.", "Net", "Status"].map((h) => (
                    <th key={h} className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPayroll.map((p) => {
                  const otherDed = parseFloat(p.deductions || "0") - parseFloat(p.total_loan_deduction || "0") - parseFloat(p.total_leave_deduction || "0");
                  return (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <span className="font-mono text-xs">{monthNames[p.month - 1]?.slice(0, 3)} {p.year}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {badge(p.transaction_type || "SALARY", statusColors[p.transaction_type] || statusColors.SALARY)}
                      </td>
                      <td className="py-2.5 pr-3 font-medium">{fmtCurrency(p.base_salary)}</td>
                      <td className="py-2.5 pr-3 text-success">{parseFloat(p.total_compensation || "0") > 0 ? fmtCurrency(p.total_compensation) : "—"}</td>
                      <td className="py-2.5 pr-3 text-success">{parseFloat(p.bonus || "0") > 0 ? fmtCurrency(p.bonus) : "—"}</td>
                      <td className="py-2.5 pr-3 text-destructive">{parseFloat(p.total_loan_deduction || "0") > 0 ? fmtCurrency(p.total_loan_deduction) : "—"}</td>
                      <td className="py-2.5 pr-3 text-destructive">{parseFloat(p.total_leave_deduction || "0") > 0 ? fmtCurrency(p.total_leave_deduction) : "—"}</td>
                      <td className="py-2.5 pr-3 text-destructive">{otherDed > 0 ? fmtCurrency(otherDed) : "—"}</td>
                      <td className="py-2.5 pr-3 font-semibold">{fmtCurrency(p.net_salary)}</td>
                      <td className="py-2.5">{badge(p.status || "PENDING", statusColors[p.status])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Running total row */}
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold">Totals ({sortedPayroll.length} months)</span>
                <span className="font-semibold">{fmtCurrency(totalBasePaid)}</span>
                <span className="text-success">{fmtCurrency(totalCompensationPaid)}</span>
                <span className="text-success">{fmtCurrency(totalBonus)}</span>
                <span className="text-destructive">{fmtCurrency(totalLoanDeduction)}</span>
                <span className="text-destructive">{fmtCurrency(totalLeaveDeduction)}</span>
                <span className="text-destructive">{fmtCurrency(totalDeductions - totalLoanDeduction - totalLeaveDeduction)}</span>
                <span className="font-bold text-primary">{fmtCurrency(totalNetPaid)}</span>
                <span />
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Loans & Advances ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Personal Loans */}
        <SectionCard title="Loans" icon={CreditCard}>
          {personalLoans.length === 0 ? (
            <EmptyState message="No loan records." icon={CreditCard} />
          ) : (
            <div className="space-y-3">
              {personalLoans.map((loan) => {
                const progress = parseFloat(loan.total_payable) > 0
                  ? Math.round(((parseFloat(loan.total_payable) - parseFloat(loan.remaining_amount)) / parseFloat(loan.total_payable)) * 100)
                  : 0;
                return (
                  <div key={loan.id} className="border border-border rounded-xl p-3 space-y-2 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{loan.loan_type_display || loan.loan_type}</span>
                      {badge(loan.status, statusColors[loan.status])}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Principal</p>
                        <p className="text-sm font-semibold">{fmtCurrency(loan.principal_amount)}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Remaining</p>
                        <p className="text-sm font-semibold text-destructive">{fmtCurrency(loan.remaining_amount)}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Paid</p>
                        <p className="text-sm font-semibold text-success">{fmtCurrency(loan.paid_amount)}</p>
                      </div>
                    </div>
                    <ProgressBar value={parseFloat(loan.paid_amount)} max={parseFloat(loan.total_payable)} label={`${loan.paid_months}/${computeTotalMonths(loan)} months`} />
                    {loan.interest_rate && parseFloat(loan.interest_rate) > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Percent className="w-3 h-3" /> Interest: {loan.interest_rate}%
                      </p>
                    )}
                  </div>
                );
              })}
              {/* Loan Totals */}
              {personalLoans.length > 1 && (
                <div className="border-t border-border pt-3 mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total Portfolio</span>
                    <div className="flex gap-4">
                      <span>Principal: <strong>{fmtCurrency(totalLoanPrincipal)}</strong></span>
                      <span>Paid: <strong className="text-success">{fmtCurrency(totalLoanPaid)}</strong></span>
                      <span>Remaining: <strong className="text-destructive">{fmtCurrency(totalLoanRemaining)}</strong></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Salary Advances */}
        <SectionCard title="Salary Advances" icon={Sparkles}>
          {advanceLoans.length === 0 ? (
            <EmptyState message="No salary advances." icon={Sparkles} />
          ) : (
            <div className="space-y-3">
              {advanceLoans.map((adv) => {
                const forMonth = adv.advance_for_month ? monthNames[adv.advance_for_month - 1] : "—";
                const forYear = adv.advance_for_year || "—";
                const isActive = adv.status === "PAID";
                return (
                  <div key={adv.id} className={cn("border rounded-xl p-3 space-y-2 transition-colors", isActive ? "border-amber/30 bg-amber/[0.02]" : "border-border")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className={cn("w-4 h-4", isActive ? "text-amber" : "text-muted-foreground")} />
                        <span className="text-sm font-semibold">Advance for {forMonth} {forYear}</span>
                      </div>
                      {badge(isActive ? "Active" : "Deducted", isActive ? statusColors.ADVANCE : statusColors.RETURNED)}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Amount</p>
                        <p className="text-sm font-semibold">{fmtCurrency(adv.principal_amount)}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Remaining</p>
                        <p className="text-sm font-semibold text-destructive">{fmtCurrency(adv.remaining_amount)}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Deducted</p>
                        <p className="text-sm font-semibold text-success">{fmtCurrency(adv.paid_amount)}</p>
                      </div>
                    </div>
                    {adv.transaction_number && (
                      <p className="text-[10px] font-mono text-muted-foreground">Trx: {adv.transaction_number}</p>
                    )}
                  </div>
                );
              })}
              {/* Advance Totals */}
              {advanceLoans.length > 1 && (
                <div className="border-t border-border pt-3 mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total Advances</span>
                    <div className="flex gap-4">
                      <span>Created: <strong>{fmtCurrency(totalAdvanceAmount)}</strong></span>
                      <span>Deducted: <strong className="text-success">{fmtCurrency(totalAdvanceDeducted)}</strong></span>
                      <span>Outstanding: <strong className="text-amber">{fmtCurrency(totalAdvanceOutstanding)}</strong></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Leave Summary ────────────────────────────────────── */}
      <SectionCard title="Leave Summary" icon={Calendar}>
        {approvedLeaves.length === 0 ? (
          <EmptyState message="No approved leaves." icon={Calendar} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{approvedLeaves.length}</p>
                <p className="text-xs text-muted-foreground">Total Leaves</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{totalLeaveDays.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Total Days</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{fmtCurrency(totalLeaveDeduction)}</p>
                <p className="text-xs text-muted-foreground">Total Deducted</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{(totalLeaveDays > 0 ? (totalLeaveDeduction / totalLeaveDays) : 0).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Avg / Day</p>
              </div>
            </div>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Type", "From", "To", "Days", "Status"].map((h) => (
                      <th key={h} className="pb-2 pr-4 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {approvedLeaves.slice(0, 10).map((l) => (
                    <tr key={l.id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2 pr-4 font-medium text-xs">{l.leave_type_display || l.leave_type}</td>
                      <td className="py-2 pr-4 text-xs">{fmtDate(l.start_date)}</td>
                      <td className="py-2 pr-4 text-xs">{fmtDate(l.end_date)}</td>
                      <td className="py-2 pr-4 text-xs">{l.total_days}</td>
                      <td className="py-2">{badge(l.status, statusColors[l.status])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {approvedLeaves.length > 10 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  +{approvedLeaves.length - 10} more leaves
                </p>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Monthly Timeline ────────────────────────────────── */}
      <SectionCard title="Monthly Timeline" icon={Activity}>
        {sortedPayroll.length === 0 ? (
          <EmptyState message="No payroll history to display." icon={Activity} />
        ) : (
          <div className="space-y-1">
            {sortedPayroll.slice(0, 24).map((p, idx) => {
              const net = parseFloat(p.net_salary || "0");
              const deductions = parseFloat(p.deductions || "0");
              return (
                <div key={p.id} className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  idx === 0 ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/30"
                )}>
                  {/* Timeline dot */}
                  <div className="relative flex flex-col items-center">
                    <div className={cn("w-2.5 h-2.5 rounded-full border-2", net > 0 ? "bg-success border-success/30" : "bg-muted-foreground/30 border-border")} />
                    {idx < sortedPayroll.length - 1 && <div className="w-px h-6 bg-border mt-1" />}
                  </div>
                  {/* Content */}
                  <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium shrink-0 w-24">{monthNames[p.month - 1]} {p.year}</span>
                      {badge(p.transaction_type || "SALARY", (p.transaction_type === "ADVANCE" ? statusColors.ADVANCE : statusColors.SALARY))}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs text-muted-foreground">Gross: {fmtCurrency(parseFloat(p.base_salary || "0") + parseFloat(p.total_compensation || "0") + parseFloat(p.bonus || "0"))}</span>
                      {deductions > 0 && <span className="text-xs text-destructive">−{fmtCurrency(deductions)}</span>}
                      <span className={cn("text-sm font-bold w-24 text-right", net > 0 ? "text-success" : "text-muted-foreground")}>{fmtCurrency(net)}</span>
                      {badge(p.status || "PENDING", statusColors[p.status])}
                    </div>
                  </div>
                </div>
              );
            })}
            {sortedPayroll.length > 24 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{sortedPayroll.length - 24} more months
              </p>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Metadata ─────────────────────────────────────────── */}
      <SectionCard title="Metadata" icon={Hash}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Employee ID" value={employee.employee_id} mono />
          <InfoRow label="Department" value={employee.department_name} />
          <InfoRow label="Designation" value={employee.designation_name} />
          <InfoRow label="Joining Date" value={fmtDate(employee.joining_date)} />
          <InfoRow label="Current Base Salary" value={fmtCurrency(employee.salary)} />
          <InfoRow label="Employment Type" value={employee.employment_type?.replace("_", " ")} />
          <InfoRow label="Bank" value={employee.bank_name} />
          <InfoRow label="Account" value={employee.bank_account_number} mono />
        </div>
      </SectionCard>
    </div>
  );
}
