// @ts-nocheck
"use client";

// ============================================
// FILE: src/app/(dashboard)/hr/employees/[id]/page.tsx
// ============================================

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useEmployees } from "@/hooks/useEmployees";
import { useLeaves } from "@/hooks/useLeaves";
import { usePayroll, useEmployeeLoans, useCompensations } from "@/hooks/usePayroll";
import { useEmployeeAssignments } from "@/hooks/useEmployeeAssets";
import { useShiftTemplates } from "@/hooks/useShiftTemplates";
import { useExitRecords } from "@/hooks/useExitManagement";
import { useRecruitment } from "@/hooks/useRecruitment";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Shield,
  CreditCard,
  Package,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Building2,
  Award,
  Users,
  Wallet,
  BarChart3,
  Activity,
  Edit,
  LogOut,
  IdCard,
  Heart,
  Home,
  Globe,
  Landmark,
  DollarSign,
  Hash,
  Info,
  UserCheck,
  Timer,
  Layers,
  Tag,
  Percent,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  ACTIVE: "bg-success/15 text-success border-success/20",
  ON_LEAVE: "bg-warning/15 text-warning border-warning/20",
  SUSPENDED: "bg-destructive/15 text-destructive border-destructive/20",
  TERMINATED: "bg-destructive/15 text-destructive border-destructive/20",
  RESIGNED: "bg-muted text-muted-foreground border-border",
  PENDING: "bg-warning/15 text-warning border-warning/20",
  APPROVED: "bg-success/15 text-success border-success/20",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/20",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  PAID: "bg-success/15 text-success border-success/20",
  UNPAID: "bg-warning/15 text-warning border-warning/20",
  ACTIVE_LOAN: "bg-info/15 text-info border-info/20",
};

const badge = (label: string, cls?: string) => (
  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border", cls)}>
    {label}
  </span>
);

const fmt = (val?: string | number | null, fallback = "—") =>
  val !== undefined && val !== null && val !== "" ? String(val) : fallback;

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const fmtCurrency = (val?: string | number, currency = "USD") => {
  const n = parseFloat(String(val || 0));
  return isNaN(n) ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
};

const initials = (first?: string, last?: string) =>
  `${(first || "?")[0]}${(last || "")[0] || ""}`.toUpperCase();

// ─── Sub-components ─────────────────────────────────────────────────────────

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
          {fmt(value)}
        </span>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
        <Info className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: User },
  { id: "employment", label: "Employment", icon: Briefcase },
  { id: "payroll", label: "Payroll", icon: Wallet },
  { id: "loans", label: "Loans", icon: CreditCard },
  { id: "leaves", label: "Leaves", icon: Calendar },
  { id: "assets", label: "Assets", icon: Package },
  { id: "exit", label: "Exit", icon: LogOut },
];

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  // ── Data fetching ──────────────────────────────────────────────
  const { data: employees = [], isLoading: empLoading } = useEmployees();
  const employee = employees.find((e) => e.id === id);

  const { data: leaves = [] } = useLeaves(id ? { employee_id: id } : undefined);
  const { data: payrollRecords = [] } = usePayroll(id ? { employee_id: id } : undefined);
  const { data: loans = [] } = useEmployeeLoans(id ? { employee_id: id } : undefined);
  const { data: compensations = [] } = useCompensations(id ? { employee_id: id } : undefined);
  const { data: assignmentsData } = useEmployeeAssignments(id);
  const { data: shiftTemplates = [] } = useShiftTemplates();
  const { data: exitData } = useExitRecords(id ? { employee_id: id } : undefined);

  const shiftTemplate = shiftTemplates.find((t) => t.id === employee?.default_shift_id);
  const latestCompensation = compensations[0];
  const exitRecord = exitData?.data?.[0];

  // ── Loading / Not found ────────────────────────────────────────
  if (empLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading employee...</p>
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

  // ── Tab panels ─────────────────────────────────────────────────

  const panels: Record<string, JSX.Element> = {
    // ── OVERVIEW ──
    overview: (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Personal Info */}
        <SectionCard title="Personal Information" icon={User}>
          <InfoRow label="Full Name" value={fullName} />
          <InfoRow label="Employee ID" value={employee.employee_id} mono />
          <InfoRow label="Date of Birth" value={fmtDate(employee.date_of_birth)} />
          <InfoRow label="Gender" value={employee.gender?.replace("_", " ")} />
          <InfoRow label="Marital Status" value={employee.marital_status} />
          <InfoRow label="CNIC / ID" value={employee.cnic} mono />
          <InfoRow label="Father's Name" value={employee.father_name} />
        </SectionCard>

        {/* Contact */}
        <SectionCard title="Contact Details" icon={Phone}>
          <InfoRow label="Phone" value={employee.phone} />
          <InfoRow label="Work Email" value={employee.email} />
          <InfoRow label="Personal Email" value={employee.personal_email} />
          <InfoRow label="Address" value={employee.address_line} />
          <InfoRow label="City" value={employee.city} />
          <InfoRow label="State" value={employee.state} />
          <InfoRow label="Country" value={employee.country} />
          <InfoRow label="Postal Code" value={employee.postal_code} />
        </SectionCard>

        {/* Emergency Contact */}
        <SectionCard title="Emergency Contact" icon={Heart}>
          <InfoRow label="Name" value={employee.emergency_contact_name} />
          <InfoRow label="Phone" value={employee.emergency_contact_phone} />
          <InfoRow label="Relation" value={employee.emergency_contact_relation} />
        </SectionCard>

        {/* Bank Details */}
        <SectionCard title="Bank Information" icon={Landmark}>
          <InfoRow label="Bank Name" value={employee.bank_name} />
          <InfoRow label="Account Number" value={employee.bank_account_number} mono />
          <InfoRow label="IBAN" value={employee.bank_iban} mono />
        </SectionCard>
      </div>
    ),

    // ── EMPLOYMENT ──
    employment: (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Job Details" icon={Briefcase}>
          <InfoRow label="Department" value={employee.department} />
          <InfoRow label="Designation" value={employee.designation} />
          <InfoRow
            label="Status"
          >
            {badge(
              employee.employment_status?.replace("_", " "),
              statusColors[employee.employment_status]
            )}
          </InfoRow>
          <InfoRow label="Employment Type" value={employee.employment_type?.replace("_", " ")} />
          <InfoRow label="Work Location" value={employee.work_location?.replace("_", " ")} />
          <InfoRow label="Role" value={employee.role?.replace("_", " ")} />
        </SectionCard>

        <SectionCard title="Timeline" icon={Calendar}>
          <InfoRow label="Joining Date" value={fmtDate(employee.joining_date)} />
          <InfoRow label="Confirmation Date" value={fmtDate(employee.confirmation_date)} />
          <InfoRow label="Probation Days" value={employee.probation_days} />
          <InfoRow label="Record Created" value={fmtDate(employee.createdAt)} />
          <InfoRow label="Last Updated" value={fmtDate(employee.updatedAt)} />
        </SectionCard>

        <SectionCard title="Reporting & Shift" icon={Users}>
          <InfoRow label="Reporting Manager" value={employee.reporting_manager_name || employee.reporting_manager_id} />
          <InfoRow
            label="Default Shift"
            value={employee.default_shift_name || shiftTemplate?.name}
          />
          {shiftTemplate && (
            <>
              <InfoRow label="Shift Start" value={shiftTemplate.startTime} />
              <InfoRow label="Shift End" value={shiftTemplate.endTime} />
              <InfoRow label="Break" value={`${shiftTemplate.breakMinutes} min`} />
            </>
          )}
        </SectionCard>

        <SectionCard title="Compensation Summary" icon={DollarSign}>
          <InfoRow label="Base Salary" value={fmtCurrency(employee.salary)} />
          {latestCompensation && (
            <>
              <InfoRow label="Basic" value={fmtCurrency(latestCompensation.basic_salary)} />
              <InfoRow label="HRA" value={fmtCurrency(latestCompensation.house_rent_allowance)} />
              <InfoRow label="Medical" value={fmtCurrency(latestCompensation.medical_allowance)} />
              <InfoRow label="Transport" value={fmtCurrency(latestCompensation.transport_allowance)} />
              <InfoRow label="Total CTC" value={fmtCurrency(latestCompensation.total_ctc)} />
            </>
          )}
        </SectionCard>
      </div>
    ),

    // ── PAYROLL ──
    payroll: (
      <div className="space-y-5">
        {/* Compensation detail */}
        {latestCompensation && (
          <SectionCard title="Current Compensation Structure" icon={BarChart3}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Basic Salary", val: latestCompensation.basic_salary },
                { label: "HRA", val: latestCompensation.house_rent_allowance },
                { label: "Medical", val: latestCompensation.medical_allowance },
                { label: "Transport", val: latestCompensation.transport_allowance },
                { label: "Phone", val: latestCompensation.phone_allowance },
                { label: "Utilities", val: latestCompensation.utilities_allowance },
                { label: "Education", val: latestCompensation.education_allowance },
                { label: "Others", val: latestCompensation.other_allowances },
                { label: "Employer PF", val: latestCompensation.employer_pf },
                { label: "Employer EOBI", val: latestCompensation.employer_eobi },
                { label: "Total Allowances", val: latestCompensation.total_allowances },
              ].map(({ label, val }) => (
                <div key={label} className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-sm font-semibold">{fmtCurrency(val)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <span className="text-sm font-semibold">Total Monthly CTC</span>
              <span className="text-lg font-bold text-primary">{fmtCurrency(latestCompensation.total_monthly)}</span>
            </div>
          </SectionCard>
        )}

        {/* Payroll history */}
        <SectionCard title="Payroll History" icon={FileText}>
          {payrollRecords.length === 0 ? (
            <EmptyState message="No payroll records found for this employee." />
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Period", "Base", "Bonus", "Deductions", "Net", "Status", "Method"].map((h) => (
                      <th key={h} className="pb-2 pr-4 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payrollRecords.map((p) => (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-4 whitespace-nowrap font-mono text-xs">
                        {p.year}-{String(p.month).padStart(2, "0")}
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">{fmtCurrency(p.base_salary)}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap text-success">{fmtCurrency(p.bonus)}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap text-destructive">{fmtCurrency(p.deductions)}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap font-semibold">{fmtCurrency(p.net_salary)}</td>
                      <td className="py-2.5 pr-4">{badge(p.status, statusColors[p.status])}</td>
                      <td className="py-2.5 text-muted-foreground text-xs">{p.payment_method?.replace("_", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    ),

    // ── LOANS ──
    loans: (
      <SectionCard title="Loan Records" icon={CreditCard}>
        {loans.length === 0 ? (
          <EmptyState message="No loans found for this employee." />
        ) : (
          <div className="space-y-4">
            {loans.map((loan) => {
              const paidPct = loan.total_months
                ? Math.round((loan.paid_months / loan.total_months) * 100)
                : 0;
              return (
                <div key={loan.id} className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-sm">{loan.loan_type_display || loan.loan_type}</p>
                      <p className="text-xs text-muted-foreground">Since {fmtDate(loan.start_date)}</p>
                    </div>
                    {badge(loan.status, statusColors[loan.status] || statusColors.ACTIVE_LOAN)}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    {[
                      { label: "Principal", val: fmtCurrency(loan.principal_amount) },
                      { label: "Remaining", val: fmtCurrency(loan.remaining_amount) },
                      { label: "Monthly", val: fmtCurrency(loan.monthly_deduction) },
                      { label: "Interest", val: `${loan.interest_rate}%` },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-muted/40 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-semibold">{val}</p>
                      </div>
                    ))}
                  </div>
                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{loan.paid_months} / {loan.total_months} months paid</span>
                      <span>{paidPct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                  </div>
                  {loan.purpose && (
                    <p className="text-xs text-muted-foreground">Purpose: {loan.purpose}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    ),

    // ── LEAVES ──
    leaves: (
      <SectionCard title="Leave History" icon={Calendar}>
        {leaves.length === 0 ? (
          <EmptyState message="No leave records found for this employee." />
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Type", "From", "To", "Days", "Half Day", "Status", "Applied"].map((h) => (
                    <th key={h} className="pb-2 pr-4 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 pr-4 whitespace-nowrap font-medium">
                      {l.leave_type_display || l.leave_type}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-xs">{fmtDate(l.start_date)}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-xs">{fmtDate(l.end_date)}</td>
                    <td className="py-2.5 pr-4 text-center">{l.total_days}</td>
                    <td className="py-2.5 pr-4 text-center">
                      {l.is_half_day ? (
                        <CheckCircle2 className="w-4 h-4 text-success inline" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground inline" />
                      )}
                    </td>
                    <td className="py-2.5 pr-4">{badge(l.status, statusColors[l.status])}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{fmtDate(l.applied_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    ),

    // ── ASSETS ──
    assets: (
      <div className="space-y-5">
        {/* Active assignments */}
        <SectionCard title="Active Asset Assignments" icon={Package}>
          {!assignmentsData?.active_assignments?.length ? (
            <EmptyState message="No assets currently assigned." />
          ) : (
            <div className="space-y-3">
              {assignmentsData.active_assignments.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 border border-border rounded-xl hover:bg-muted/30 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{a.asset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[a.asset.brand, a.asset.model].filter(Boolean).join(" · ") || "No brand/model"}
                      {a.asset.serial_number && ` · S/N: ${a.asset.serial_number}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Assigned {fmtDate(a.assigned_date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {badge(a.source_type, "bg-info/15 text-info border-info/20")}
                    {a.source_kit && (
                      <p className="text-xs text-muted-foreground mt-1">{a.source_kit.name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Assigned kits */}
        {assignmentsData?.kits?.length > 0 && (
          <SectionCard title="Assigned Kits" icon={Layers}>
            <div className="space-y-3">
              {assignmentsData.kits.map((kit) => (
                <div key={kit.id} className="p-3 border border-border rounded-xl">
                  <p className="font-semibold text-sm mb-1">{kit.name}</p>
                  {kit.description && <p className="text-xs text-muted-foreground mb-2">{kit.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {kit.assets.map((a) => (
                      <span key={a.id} className="text-xs bg-muted px-2 py-0.5 rounded-md border border-border">
                        {a.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* History */}
        {assignmentsData?.history?.length > 0 && (
          <SectionCard title="Assignment History" icon={Activity}>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Asset", "Assigned", "Returned", "Status"].map((h) => (
                      <th key={h} className="pb-2 pr-4 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignmentsData.history.map((h) => (
                    <tr key={h.id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2.5 pr-4 font-medium">{h.asset_name}</td>
                      <td className="py-2.5 pr-4 text-xs">{fmtDate(h.assigned_date)}</td>
                      <td className="py-2.5 pr-4 text-xs">{fmtDate(h.returned_date)}</td>
                      <td className="py-2.5">{badge(h.status, statusColors[h.status])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>
    ),

    // ── EXIT ──
    exit: (
      <div className="space-y-5">
        {!exitRecord ? (
          <SectionCard title="Exit Management" icon={LogOut}>
            <EmptyState message="No exit record found for this employee." />
          </SectionCard>
        ) : (
          <>
            <SectionCard title="Exit Details" icon={LogOut}>
              <InfoRow label="Exit Date" value={fmtDate(exitRecord.exit_date)} />
              <InfoRow label="Last Working Day" value={fmtDate(exitRecord.last_working_day)} />
              <InfoRow label="Reason" value={exitRecord.reason_value || exitRecord.reason} />
              <InfoRow label="Status">
                {badge(exitRecord.status_value || exitRecord.status, statusColors[exitRecord.status])}
              </InfoRow>
              <InfoRow label="Notice Served">
                {exitRecord.notice_served ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
              </InfoRow>
              <InfoRow label="Final Settlement" value={fmtCurrency(exitRecord.final_settlement)} />
              {exitRecord.notes && <InfoRow label="Notes" value={exitRecord.notes} />}
            </SectionCard>

            <SectionCard title="Clearance Status" icon={CheckCircle2}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "HR", cleared: exitRecord.clearance_hr },
                  { label: "IT", cleared: exitRecord.clearance_it },
                  { label: "Finance", cleared: exitRecord.clearance_finance },
                  { label: "Admin", cleared: exitRecord.clearance_admin },
                ].map(({ label, cleared }) => (
                  <div key={label} className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border",
                    cleared ? "bg-success/10 border-success/20" : "bg-muted/40 border-border"
                  )}>
                    {cleared
                      ? <CheckCircle2 className="w-6 h-6 text-success" />
                      : <XCircle className="w-6 h-6 text-muted-foreground" />
                    }
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Overall clearance</span>
                  <span>{exitRecord.clearance_progress ?? 0}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all"
                    style={{ width: `${exitRecord.clearance_progress ?? 0}%` }}
                  />
                </div>
              </div>
            </SectionCard>
          </>
        )}
      </div>
    ),
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Employees
      </button>

      {/* ── Hero / Profile Card ───────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">

        <div className="px-6 pb-6 z-10">
          {/* Avatar row */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mt-4">
            {/* Avatar */}
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 rounded-2xl border-4 border-card bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center text-2xl font-bold text-primary shadow-lg shrink-0">
                {initials(employee.first_name, employee.last_name)}
              </div>
              <div className="mb-1">
                <h1 className="text-xl font-bold leading-tight">{fullName}</h1>
                <p className="text-sm text-muted-foreground">{employee.designation || employee.department}</p>
                <p className="text-xs font-mono text-muted-foreground">{employee.employee_id}</p>
              </div>
            </div>

            {/* Quick meta badges */}
            <div className="flex flex-wrap gap-2 sm:mb-1">
              {badge(
                employee.employment_status?.replace("_", " "),
                statusColors[employee.employment_status]
              )}
              {badge(
                employee.employment_type?.replace("_", " "),
                "bg-info/15 text-info border-info/20"
              )}
              {badge(
                employee.work_location?.replace("_", " "),
                "bg-accent text-accent-foreground border-border"
              )}
            </div>
          </div>

          {/* Quick stat row */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                icon: Building2,
                label: "Department",
                value: employee.department,
              },
              {
                icon: Calendar,
                label: "Joined",
                value: fmtDate(employee.joining_date),
              },
              {
                icon: Clock,
                label: "Shift",
                value: employee.default_shift_name || shiftTemplate?.name || "Unassigned",
              },
              {
                icon: DollarSign,
                label: "Salary",
                value: fmtCurrency(employee.salary),
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-muted/40 rounded-xl p-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border -mx-4 px-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors border-b-2",
                activeTab === id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Active Panel ────────────────────────────────────── */}
      <div className="min-h-[300px]">
        {panels[activeTab]}
      </div>
    </div>
  );
}