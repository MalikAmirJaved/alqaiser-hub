// @ts-nocheck
"use client";

import { useParams, useRouter } from "next/navigation";
import { useExitRecord, useUpdateExitRecord, useClearExitDues, useExitEmployeeAssets, useReturnExitAsset } from "@/hooks/useExitManagement";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useState } from "react";
import {
  ArrowLeft,
  LogOut,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  Loader2,
  RotateCcw,
  X,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

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

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  CONFIRMED: "bg-success/15 text-success",
  REJECTED: "bg-destructive/15 text-destructive",
};

const CONDITION_OPTIONS = [
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
  { value: "DAMAGED", label: "Damaged" },
];

import { useFormatCurrency } from "@/hooks/useFormatCurrency";

export default function ExitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const permissions = useFeaturePermissions("HR", "exit");
  const updateMutation = useUpdateExitRecord();
  const clearDuesMutation = useClearExitDues();
  const formatCurrency = useFormatCurrency();

  const { data: record, isLoading, error } = useExitRecord(id);
  const { data: assets = [], isLoading: assetsLoading } = useExitEmployeeAssets(id);
  console.log("record:: ", record)
  const returnAssetMutation = useReturnExitAsset();

  const [editingStatus, setEditingStatus] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: "", notes: "" });

  const [returningId, setReturningId] = useState<string | null>(null);
  const [conditionMap, setConditionMap] = useState<Record<string, string>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

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
        status: statusForm.status,
        settlement_notes: statusForm.notes || record.settlement_notes,
      });
      setEditingStatus(false);
    } catch (err: any) {
    }
  };

  const handleReturnAsset = async (asset: any) => {
    setReturningId(asset.id);
    try {
      await returnAssetMutation.mutateAsync({
        exitId: id,
        assignment_id: asset.id,
        condition_on_return: conditionMap[asset.id] || "GOOD",
        return_notes: notesMap[asset.id] || "",
      });
      toast.success(`"${asset.asset_name}" returned successfully`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to return asset");
    } finally {
      setReturningId(null);
    }
  };

  const canEdit = record.status_value === "PENDING";

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
            <p className="text-sm text-muted-foreground">{record.employee_name}</p>
          </div>
        </div>
        <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${STATUS_STYLES[record.status_value] || 'bg-muted text-muted-foreground'}`}>
          {record.status}
        </span>
      </div>

      {/* Exit Information */}
      <SectionCard title="Exit Information" icon={LogOut}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Employee" value={record.employee_name} />
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
          <InfoRow label="Final Settlement" value={formatCurrency(record.final_settlement)} />
        </div>
        {record.settlement_notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <InfoRow label="Settlement Notes" value={record.settlement_notes} />
          </div>
        )}
        {record.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <InfoRow label="Notes" value={record.notes} />
          </div>
        )}
      </SectionCard>

      {/* Clear Dues (when settlement negative) */}
      {record.status_value === "CONFIRMED" && record.final_settlement < 0 && (
        <SectionCard title="Clear Employee Dues" icon={AlertTriangle}>
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-destructive">
                  Employee Owes {formatCurrency(Math.abs(record.final_settlement))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  The employee must return this amount to the company. Click below to record
                  the payment and clear the dues — a finance receipt will be created.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm(
                  `Record that the employee has returned ${formatCurrency(Math.abs(record.final_settlement))}? This will create a finance receipt.`
                )) {
                  clearDuesMutation.mutateAsync(record.id);
                }
              }}
              disabled={clearDuesMutation.isPending}
              className="w-full h-9 rounded-md bg-destructive text-destructive-foreground text-sm hover:opacity-90 inline-flex items-center justify-center gap-2"
            >
              {clearDuesMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                <><DollarSign className="w-4 h-4" /> Clear Dues — Record Payment Received</>
              )}
            </button>
          </div>
        </SectionCard>
      )}

      {/* Update Status */}
      {permissions.update_status && canEdit && (
        <SectionCard title="Update Status" icon={Clock}>
          <div className="space-y-4">
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Status</span>
              <select
                value={editingStatus ? statusForm.status : record.status_value}
                onChange={e => {
                  if (!editingStatus) {
                    setEditingStatus(true);
                    setStatusForm({
                      status: e.target.value,
                      notes: record.settlement_notes || "",
                    });
                  } else {
                    setStatusForm(prev => ({ ...prev, status: e.target.value }));
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

      {/* Asset Return Section (only for CONFIRMED exits) */}
      {record.status_value === "CONFIRMED" && (
        <SectionCard title="Asset Return" icon={RotateCcw}>
          {assetsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No assets allocated to this employee.</p>
          ) : (
            <div className="space-y-4">
              {assets.map((asset: any) => (
                <div key={asset.id} className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm">{asset.asset_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[asset.asset_brand, asset.asset_serial].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Qty: {asset.quantity}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs flex flex-col gap-1">
                      <span className="text-muted-foreground">Condition</span>
                      <select
                        value={conditionMap[asset.id] || "GOOD"}
                        onChange={e => setConditionMap((p: any) => ({ ...p, [asset.id]: e.target.value }))}
                        className="bg-muted/40 border border-border rounded-md h-8 px-2 text-xs outline-none"
                      >
                        {CONDITION_OPTIONS.map((o: any) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs flex flex-col gap-1">
                      <span className="text-muted-foreground">Notes</span>
                      <input
                        value={notesMap[asset.id] || ""}
                        onChange={e => setNotesMap((p: any) => ({ ...p, [asset.id]: e.target.value }))}
                        className="bg-muted/40 border border-border rounded-md h-8 px-2 text-xs outline-none"
                        placeholder="Optional notes"
                      />
                    </label>
                  </div>

                  <button
                    onClick={() => handleReturnAsset(asset)}
                    disabled={returningId === asset.id}
                    className="w-full h-8 rounded-md bg-primary text-primary-foreground text-xs hover:opacity-90 inline-flex items-center justify-center gap-1"
                  >
                    {returningId === asset.id ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Returning...</>
                    ) : (
                      <><RotateCcw className="w-3 h-3" /> Return Asset</>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
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
