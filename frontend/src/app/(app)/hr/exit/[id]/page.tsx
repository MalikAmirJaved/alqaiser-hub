// @ts-nocheck
"use client";

import { useParams, useRouter } from "next/navigation";
import { useExitRecord, useUpdateExitRecord } from "@/hooks/useExitManagement";
import { useActiveEmployees } from "@/hooks/useEmployees";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { toast } from "sonner";
import { useState } from "react";
import {
  ArrowLeft,
  LogOut,
  User,
  Building2,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  DollarSign,
  Clock,
  Info,
  Loader2
} from "lucide-react";

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

const fmtDate = (val?: string | null) => {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return val;
  }
};

export default function ExitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const formatCurrency = useFormatCurrency();
  const permissions = useFeaturePermissions("HR", "exit");
  const { data: employees = [] } = useActiveEmployees();
  const updateMutation = useUpdateExitRecord();

  const { data: record, isLoading, error } = useExitRecord(id);

  const [editingStatus, setEditingStatus] = useState(false);
  const [statusForm, setStatusForm] = useState({
    final_settlement_status: "",
    notes: "",
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Info className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Exit record not found.</p>
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const handleStatusUpdate = async () => {
    try {
      await updateMutation.mutateAsync({
        id: record.id,
        final_settlement_status: statusForm.final_settlement_status,
        notes: statusForm.notes || record.notes,
      });
      toast.success("Status updated successfully");
      setEditingStatus(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED": return "bg-success/15 text-success";
      case "REJECTED": return "bg-destructive/15 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Exit Record Detail</h1>
            <p className="text-sm text-muted-foreground">{record.employee_name} &middot; {record.department}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
            record.status_value === 'ACTIVE' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
          }`}>
            {record.status}
          </span>
          <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${statusColor(record.final_settlement_status)}`}>
            {record.final_settlement_status}
          </span>
        </div>
      </div>

      {/* Exit Information */}
      <SectionCard title="Exit Information" icon={LogOut}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Employee" value={record.employee_name} />
          <InfoRow label="Department" value={record.department} />
          <InfoRow label="Designation" value={record.designation} />
          <InfoRow label="Exit Reason" value={record.reason} />
          <InfoRow label="Exit Date" value={fmtDate(record.exit_date)} />
          <InfoRow label="Last Working Day" value={fmtDate(record.last_working_day)} />
          <InfoRow label="Notice Served" value={
            record.notice_served ? (
              <span className="inline-flex items-center gap-1 text-success">
                <CheckCircle2 className="w-3.5 h-3.5" /> Yes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-destructive">
                <XCircle className="w-3.5 h-3.5" /> No
              </span>
            )
          } />
          <InfoRow label="Record Status" value={
            <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${
              record.status_value === 'ACTIVE' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
            }`}>
              {record.status}
            </span>
          } />
        </div>
      </SectionCard>

      {/* Final Settlement */}
      <SectionCard title="Final Settlement" icon={DollarSign}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Settlement Amount" value={
            <span className="text-lg font-bold text-primary">
              {record.final_settlement ? formatCurrency(record.final_settlement) : "—"}
            </span>
          } />
          <InfoRow label="Settlement Status" value={
            <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${statusColor(record.final_settlement_status)}`}>
              {record.final_settlement_status}
            </span>
          } />
        </div>
        {record.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <InfoRow label="Notes" value={record.notes} />
          </div>
        )}
      </SectionCard>

      {/* Department Clearances */}
      <SectionCard title="Department Clearances" icon={CheckCircle2}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: "HR", cleared: record.clearance_hr },
            { label: "IT", cleared: record.clearance_it },
            { label: "Finance", cleared: record.clearance_finance },
            { label: "Admin", cleared: record.clearance_admin },
          ].map(({ label, cleared }) => (
            <div
              key={label}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border ${
                cleared
                  ? "bg-success/10 border-success/20"
                  : "bg-muted/40 border-border"
              }`}
            >
              {cleared ? (
                <CheckCircle2 className="w-6 h-6 text-success" />
              ) : (
                <XCircle className="w-6 h-6 text-muted-foreground" />
              )}
              <span className="text-xs font-medium">{label}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Overall clearance</span>
            <span>{record.clearance_progress ?? 0}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all"
              style={{ width: `${record.clearance_progress ?? 0}%` }}
            />
          </div>
        </div>
      </SectionCard>

      {/* Update Settlement Status (inline) */}
      {permissions.update_status && (
        <SectionCard title="Update Settlement Status" icon={Clock}>
          <div className="space-y-4">
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Status</span>
              <select
                value={editingStatus ? statusForm.final_settlement_status : record.final_settlement_status}
                onChange={e => {
                  if (!editingStatus) {
                    setEditingStatus(true);
                    setStatusForm({
                      final_settlement_status: e.target.value,
                      notes: record.notes || "",
                    });
                  } else {
                    setStatusForm(prev => ({ ...prev, final_settlement_status: e.target.value }));
                  }
                }}
                className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none"
              >
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirm</option>
                <option value="REJECTED">Reject</option>
              </select>
            </label>

            {editingStatus && (
              <>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Notes (optional)</span>
                  <textarea
                    rows={2}
                    value={statusForm.notes}
                    onChange={e => setStatusForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="bg-muted/40 border border-border rounded-md p-3 outline-none"
                    placeholder="Add notes about this decision..."
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingStatus(false)}
                    className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStatusUpdate}
                    disabled={updateMutation.isPending}
                    className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 inline-flex items-center gap-2"
                  >
                    {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Status
                  </button>
                </div>
              </>
            )}
          </div>
        </SectionCard>
      )}

      {/* Timestamps */}
      <SectionCard title="Record Information" icon={FileText}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Created" value={fmtDate(record.created_at)} />
          <InfoRow label="Last Updated" value={fmtDate(record.updated_at)} />
        </div>
      </SectionCard>
    </div>
  );
}
