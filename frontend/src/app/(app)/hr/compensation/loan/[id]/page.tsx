"use client";

import { useParams, useRouter } from "next/navigation";
import { useEmployeeLoan } from "@/hooks/usePayroll";
import type { EmployeeLoan } from "@/hooks/usePayroll";
import {
  ArrowLeft,
  Clock,
  FileText,
  Calendar,
  Building2,
  DollarSign,
  Percent,
  Target,
  Info,
  CreditCard,
  Hash,
  User,
} from "lucide-react";
import { getFrequencyLabel, getMonthLabel, getFrequencyBadgeColor } from "@/components/payroll/types";

const SectionCard = ({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
  <div className="bg-card border border-border rounded-xl overflow-hidden">
    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground tracking-wide">{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const InfoRow = ({ label, value, mono = false }: { label: string; value?: React.ReactNode; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground shrink-0 pt-0.5 min-w-[130px]">{label}</span>
    <span className={`text-sm text-right break-all ${mono ? "font-mono text-xs" : "font-medium"}`}>
      {value ?? "—"}
    </span>
  </div>
);

const fmtCurrency = (val?: string | number | null, currency = "USD") => {
  const n = parseFloat(String(val ?? 0));
  return isNaN(n) ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
};

const fmtDate = (val?: string | null) => {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
};

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    ACTIVE: "bg-success/15 text-success border-success/20",
    PENDING: "bg-warning/15 text-warning border-warning/20",
    PAID: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    CANCELLED: "bg-destructive/15 text-destructive border-destructive/20",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${colors[status] || "bg-muted text-muted-foreground border-border"}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
};

export default function LoanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { data: loan, isLoading, error } = useEmployeeLoan(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Info className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Loan not found.</p>
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const progress = parseFloat(loan.total_payable) > 0
    ? ((parseFloat(loan.total_payable) - parseFloat(loan.remaining_amount)) / parseFloat(loan.total_payable)) * 100
    : 0;

  const totalDeductions = loan.selected_months?.reduce((sum, sm) => sum + parseFloat(String(sm.deduction ?? "0")), 0) ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-muted transition-colors mt-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Loan Detail</h1>
            <p className="text-sm text-muted-foreground">
              {loan.employee_name} &middot; {loan.employee_code}
            </p>
          </div>
          <StatusBadge status={loan.status} />
        </div>
      </div>

      {/* Employee Information */}
      <SectionCard title="Employee Information" icon={Building2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Employee Name" value={loan.employee_name} />
          <InfoRow label="Employee Code" value={loan.employee_code} />
          <InfoRow label="Department" value={loan.department} />
          <InfoRow label="Monthly Salary" value={fmtCurrency(loan.monthly_salary)} />
          <InfoRow label="Transaction No." value={loan.transaction_number} />
        </div>
      </SectionCard>

      {/* Loan Details */}
      <SectionCard title="Loan Details" icon={CreditCard}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Loan Type" value={loan.loan_type_display || loan.loan_type} />
          <InfoRow label="Principal Amount" value={fmtCurrency(loan.principal_amount)} />
          <InfoRow label="Interest Rate" value={loan.interest_rate ? `${loan.interest_rate}%` : "—"} />
          <InfoRow label="Total Payable" value={fmtCurrency(loan.total_payable)} />
          <InfoRow label="Paid Amount" value={fmtCurrency(loan.paid_amount)} />
          <InfoRow label="Remaining Amount" value={fmtCurrency(loan.remaining_amount)} />
          <InfoRow label="Paid Months" value={loan.paid_months ?? 0} />
        </div>

        {/* Repayment Progress */}
        {parseFloat(loan.total_payable) > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Repayment Progress</span>
              <span className="text-xs font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>{fmtCurrency(loan.paid_amount)} paid</span>
              <span>{fmtCurrency(loan.remaining_amount)} remaining</span>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Frequency & Schedule */}
      <SectionCard title="Frequency & Schedule" icon={Clock}>
        <div className="space-y-3">
          <InfoRow
            label="Frequency Type"
            value={
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${getFrequencyBadgeColor(loan)}`}>
                <Clock className="w-3 h-3" />
                {getFrequencyLabel(loan)}
              </span>
            }
          />

          {/* MONTH_RANGE: show start/end and all months */}
          {loan.frequency_type === "MONTH_RANGE" && loan.month_range && (
            <div className="bg-muted/30 rounded-lg p-4 mt-2">
              <div className="grid grid-cols-2 gap-4 mb-3 pb-3 border-b border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground">Start</p>
                  <p className="text-sm font-medium">
                    {getMonthLabel(loan.month_range.start_month)} {loan.month_range.start_year}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">End</p>
                  <p className="text-sm font-medium">
                    {getMonthLabel(loan.month_range.end_month)} {loan.month_range.end_year}
                  </p>
                </div>
              </div>
              {loan.selected_months && loan.selected_months.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground font-medium mb-2">Monthly Deductions</p>
                  <div className="space-y-1.5">
                    {loan.selected_months.map((sm, i) => (
                      <div key={sm.id || i} className="flex items-center justify-between px-3 py-2 bg-background rounded-lg border border-border">
                        <span className="text-sm font-medium">{getMonthLabel(sm.month)} {sm.year}</span>
                        <span className="text-sm font-semibold text-primary">{fmtCurrency(sm.deduction)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50 text-sm">
                    <span className="text-muted-foreground">Per Month Deduction</span>
                    <span className="font-bold">{fmtCurrency(loan.month_range.deduction)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SELECTED_MONTH / ONE_TIME: list selected months */}
          {(loan.frequency_type === "SELECTED_MONTH" || loan.frequency_type === "ONE_TIME") &&
            loan.selected_months && loan.selected_months.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-4 mt-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">
                  {loan.frequency_type === "ONE_TIME" ? "One Time Month" : "Selected Months"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total: <span className="text-primary font-semibold">{fmtCurrency(totalDeductions)}</span>
                </p>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1.5">
                {loan.selected_months.map((sm, i) => (
                  <div key={sm.id || i} className="flex items-center justify-between px-3 py-2 bg-background rounded-lg border border-border">
                    <span className="text-sm font-medium">{getMonthLabel(sm.month)} {sm.year}</span>
                    <span className="text-sm font-semibold text-primary">{fmtCurrency(sm.deduction)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Purpose */}
      {loan.purpose && (
        <SectionCard title="Purpose" icon={Target}>
          <p className="text-sm whitespace-pre-wrap">{loan.purpose}</p>
        </SectionCard>
      )}

      {/* Notes & Metadata */}
      <SectionCard title="Notes & Metadata" icon={FileText}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Created At" value={fmtDate(loan.created_at)} />
          <InfoRow label="Approved At" value={fmtDate(loan.approved_at)} />
        </div>
        {loan.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Notes</p>
            <p className="text-sm bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{loan.notes}</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
