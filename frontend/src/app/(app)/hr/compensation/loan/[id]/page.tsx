// @ts-nocheck
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEmployeeLoan } from "@/hooks/usePayroll";
import {
  ArrowLeft,
  Clock,
  HandCoins,
  FileText,
  Calendar,
  BadgeCheck,
  Building2,
  DollarSign,
  BarChart3,
  Percent,
  Target,
  Info,
  CreditCard,
} from "lucide-react";
import { getFrequencyLabel, getMonthLabel } from "@/components/payroll/types";

const SectionCard = ({ title, icon: Icon, children }: any) => (
  <div className="bg-card border border-border rounded-xl overflow-hidden">
    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground tracking-wide">{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const InfoRow = ({ label, value, mono = false }: any) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground shrink-0 pt-0.5 min-w-[130px]">{label}</span>
    <span className={`text-sm text-right break-all ${mono ? "font-mono text-xs" : "font-medium"}`}>
      {value ?? "—"}
    </span>
  </div>
);

const fmtCurrency = (val?: string | number, currency = "USD") => {
  const n = parseFloat(String(val || 0));
  return isNaN(n) ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
};

const badge = (label: string, cls?: string) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${cls || ""}`}>
    {label}
  </span>
);

const statusColors: Record<string, string> = {
  ACTIVE: "bg-success/15 text-success border-success/20",
  PENDING: "bg-warning/15 text-warning border-warning/20",
  PAID: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  CANCELLED: "bg-destructive/15 text-destructive border-destructive/20",
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

  const totalDeductions = loan.selected_months?.reduce((sum: number, sm: any) => sum + parseFloat(sm.deduction || "0"), 0) || 0;
  const progress = parseFloat(loan.total_payable) > 0
    ? ((parseFloat(loan.total_payable) - parseFloat(loan.remaining_amount)) / parseFloat(loan.total_payable)) * 100
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Loan Detail</h1>
          <p className="text-sm text-muted-foreground">{loan.employee_name} &middot; {loan.employee_code}</p>
        </div>
        {badge(loan.status, statusColors[loan.status])}
      </div>

      {/* Employee Info */}
      <SectionCard title="Employee Information" icon={Building2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Employee Name" value={loan.employee_name} />
          <InfoRow label="Employee ID" value={loan.employee_code} />
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
          <InfoRow label="Paid Months" value={loan.paid_months} />
          {loan.end_date && <InfoRow label="End Date" value={new Date(loan.end_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} />}
        </div>
        {parseFloat(loan.total_payable) > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Repayment Progress</span>
              <span className="text-xs font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* Frequency & Schedule */}
      <SectionCard title="Frequency & Schedule" icon={Clock}>
        <div className="space-y-3">
          <InfoRow label="Frequency Type">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium bg-purple-500/15 text-purple-600 border-purple-500/30">
              <Clock className="w-3 h-3" />
              {getFrequencyLabel(loan)}
            </span>
          </InfoRow>

          {loan.selected_months && loan.selected_months.length > 0 && (
            <>
              <div className="bg-muted/30 rounded-lg p-4 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    {loan.frequency_type === "MONTH_RANGE" ? "All Months in Range" : "Selected Months"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total: <span className="text-primary font-semibold">{fmtCurrency(totalDeductions)}</span>
                  </p>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {loan.selected_months.map((sm: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-background rounded-lg border border-border">
                      <span className="text-sm font-medium">{getMonthLabel(sm.month)} {sm.year}</span>
                      <span className="text-sm font-semibold text-primary">{fmtCurrency(sm.deduction)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Principal Amount</span>
                <span className="font-bold">{fmtCurrency(loan.principal_amount)}</span>
              </div>
            </>
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
          <InfoRow label="Created At" value={loan.created_at ? new Date(loan.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"} />
          {loan.approved_at && <InfoRow label="Approved At" value={new Date(loan.approved_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} />}
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
