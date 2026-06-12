// @ts-nocheck
"use client";

import { useParams, useRouter } from "next/navigation";
import { useCompensation } from "@/hooks/usePayroll";
import { formatCurrency } from "@/lib/currency";
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  Home,
  Plus,
  Car,
  Phone,
  FileText,
  Calendar,
  BadgeCheck,
  Building2,
  DollarSign,
  BarChart3,
  Info,
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

const fmt = (val?: string | number | null, fallback = "—") =>
  val !== undefined && val !== null && val !== "" ? String(val) : fallback;

const fmtCurrency = (val?: string | number, currency = "USD") => {
  const n = parseFloat(String(val || 0));
  return isNaN(n) ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
};

export default function CompensationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { data: comp, isLoading, error } = useCompensation(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !comp) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Info className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Compensation not found.</p>
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

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
        <div>
          <h1 className="text-xl font-bold text-foreground">Compensation Detail</h1>
          <p className="text-sm text-muted-foreground">{comp.employee_name} &middot; {comp.employee_code}</p>
        </div>
      </div>

      {/* Employee Info */}
      <SectionCard title="Employee Information" icon={Building2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Employee Name" value={comp.employee_name} />
          <InfoRow label="Employee ID" value={comp.employee_code} />
          <InfoRow label="Department" value={comp.department} />
          <InfoRow label="Designation" value={comp.designation} />
          <InfoRow label="Base Salary" value={fmtCurrency(comp.basic_salary)} />
          <InfoRow label="Status">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${
              comp.status === "ACTIVE"
                ? "bg-success/15 text-success border-success/20"
                : "bg-muted text-muted-foreground border-border"
            }`}>
              {comp.status}
            </span>
          </InfoRow>
        </div>
      </SectionCard>

      {/* Frequency Info */}
      <SectionCard title="Frequency & Schedule" icon={Clock}>
        <div className="space-y-3">
          <InfoRow label="Frequency Type">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium bg-blue-500/15 text-blue-600 border-blue-500/30">
              <Clock className="w-3 h-3" />
              {getFrequencyLabel(comp)}
            </span>
          </InfoRow>

          {comp.frequency_type === "MONTH_RANGE" && comp.month_range && (
            <div className="bg-muted/30 rounded-lg p-4 mt-2">
              <p className="text-xs text-muted-foreground mb-2">Month Range</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Start</p>
                  <p className="text-sm font-medium">{getMonthLabel(comp.month_range.start_month)} {comp.month_range.start_year}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">End</p>
                  <p className="text-sm font-medium">{getMonthLabel(comp.month_range.end_month)} {comp.month_range.end_year}</p>
                </div>
              </div>
            </div>
          )}

          {(comp.frequency_type === "SELECTED_MONTH" || comp.frequency_type === "ONE_TIME") && comp.selected_months && comp.selected_months.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-4 mt-2">
              <p className="text-xs text-muted-foreground mb-2">
                {comp.frequency_type === "ONE_TIME" ? "One Time Month" : "Selected Months"}
              </p>
              <div className="flex flex-wrap gap-2">
                {comp.selected_months.map((sm: any, i: number) => {
                  const isPaid = comp.paid_months_set?.some(([m, y]) => m === sm.month && y === sm.year);
                  return (
                    <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                      isPaid ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                    }`}>
                      {getMonthLabel(sm.month)} {sm.year}
                      {isPaid ? <BadgeCheck className="w-3 h-3" /> : null}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Allowances */}
      <SectionCard title="Allowances Breakdown" icon={DollarSign}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="House Rent Allowance" value={fmtCurrency(comp.house_rent_allowance)} />
          <InfoRow label="Medical Allowance" value={fmtCurrency(comp.medical_allowance)} />
          <InfoRow label="Transport Allowance" value={fmtCurrency(comp.transport_allowance)} />
          <InfoRow label="Phone Allowance" value={fmtCurrency(comp.phone_allowance)} />
          <InfoRow label="Utilities Allowance" value={fmtCurrency(comp.utilities_allowance)} />
          <InfoRow label="Education Allowance" value={fmtCurrency(comp.education_allowance)} />
          <InfoRow label="Other Allowances" value={fmtCurrency(comp.other_allowances)} />
          <div className="col-span-1 md:col-span-2 pt-2 mt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total Allowances</span>
              <span className="text-lg font-bold text-primary">{fmtCurrency(comp.total_allowances)}</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Employer Contributions */}
      <SectionCard title="Employer Contributions" icon={Building2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Employer PF" value={fmtCurrency(comp.employer_pf)} />
          <InfoRow label="Employer EOBI" value={fmtCurrency(comp.employer_eobi)} />
          <div className="col-span-1 md:col-span-2 pt-2 mt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total CTC</span>
              <span className="text-lg font-bold text-primary">{fmtCurrency(comp.total_ctc)}</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Summary */}
      <SectionCard title="Summary" icon={BarChart3}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-muted/40 rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Allowances</p>
            <p className="text-lg font-bold">{fmtCurrency(comp.total_allowances)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total CTC</p>
            <p className="text-lg font-bold">{fmtCurrency(comp.total_ctc)}</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Monthly Total</p>
            <p className="text-lg font-bold text-primary">{fmtCurrency(comp.total_monthly)}</p>
          </div>
        </div>
      </SectionCard>

      {/* Notes & Metadata */}
      <SectionCard title="Notes & Metadata" icon={FileText}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Overtime Rate (per hour)" value={fmtCurrency(comp.overtime_rate)} />
          <InfoRow label="Bonus Percentage" value={comp.bonus_percentage ? `${comp.bonus_percentage}%` : "—"} />
          {comp.review_date && <InfoRow label="Review Date" value={new Date(comp.review_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} />}
          <InfoRow label="Created At" value={comp.created_at ? new Date(comp.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"} />
        </div>
        {comp.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Notes</p>
            <p className="text-sm bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{comp.notes}</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
