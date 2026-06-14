// src/app/(app)/hr/exit/page.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SearchableSelect, { SearchableSelectOption } from "@/components/reuseable/SearchableSelect";
import { DatePicker } from "@/components/reuseable/DatePicker";
import { Checkbox } from "@/components/reuseable/Checkbox";
import ConfirmationModal, { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import {
  Search, Plus, RefreshCw, Trash2, Pencil, LogOut, Briefcase,
  AlertTriangle, Clock, CheckCircle2, X, FileText, ShieldCheck,
  Eye, Loader2, RotateCcw
} from "lucide-react";
import {
  useExitRecords,
  useExitStats,
  useCreateExitRecord,
  useUpdateExitRecord,
  useDeleteExitRecord,
  useBulkAction,
  useFinalSettlementPreview,
  useExitEmployeeAssets,
  useReturnExitAsset,
  ExitRecord,
  ExitEmployeeAsset
} from "@/hooks/useExitManagement";
import { useActiveEmployees } from "@/hooks/useEmployees";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

const EXIT_REASONS: SearchableSelectOption[] = [
  { value: "RESIGNATION", label: "Resignation" },
  { value: "TERMINATION", label: "Termination" },
  { value: "CONTRACT_END", label: "Contract End" },
  { value: "RETIREMENT", label: "Retirement" },
  { value: "OTHER", label: "Other" },
];

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  CONFIRMED: "bg-success/15 text-success",
  REJECTED: "bg-destructive/15 text-destructive",
};

const CONDITION_OPTIONS: SearchableSelectOption[] = [
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
  { value: "DAMAGED", label: "Damaged" },
];

export default function ExitManagementPage() {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const permissions = useFeaturePermissions("HR", "exit");
  const api = useApi();
  const { data: employees = [] } = useActiveEmployees();
  const confirmationModal = useConfirmationModal();
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExitRecord | null>(null);
  const [settlementDialog, setSettlementDialog] = useState<{ recordId: string; status: string } | null>(null);
  const [settlementReason, setSettlementReason] = useState("");

  // Asset return modal state
  const [assetReturnExitId, setAssetReturnExitId] = useState<string | null>(null);
  const { data: assets = [], isLoading: assetsLoading } = useExitEmployeeAssets(assetReturnExitId);
  const returnAssetMutation = useReturnExitAsset();

  const { data: recordsData, isLoading, refetch } = useExitRecords();
  const { data: stats } = useExitStats();
  const createMutation = useCreateExitRecord();
  const updateMutation = useUpdateExitRecord();
  const deleteMutation = useDeleteExitRecord();
  const bulkActionMutation = useBulkAction();

  const records = recordsData?.data || [];

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = query === "" ||
        r.employee_name.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = filterStatus === "" || r.status_value === filterStatus;
      const matchesReason = filterReason === "" || r.reason_value === filterReason;
      return matchesSearch && matchesStatus && matchesReason;
    });
  }, [records, query, filterStatus, filterReason]);

  const handleSave = async (data: Partial<ExitRecord>) => {
    try {
      if (editingRecord) {
        await updateMutation.mutateAsync({ id: editingRecord.id, ...data });
      } else {
        await createMutation.mutateAsync(data);
      }
      await refetch();
      setModalOpen(false);
      setEditingRecord(null);
    } catch (error: any) {
    }
  };

  const handleDelete = (id: string) => {
    confirmationModal.confirm({
      title: "Delete Exit Record",
      message: "Are you sure you want to delete this exit record?",
      type: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        await deleteMutation.mutateAsync(id);
        await refetch();
      },
    });
  };

  const handleBulkAction = (action: string) => {
    if (selectedRecords.size === 0) {
      toast.error("Select records first");
      return;
    }
    confirmationModal.confirm({
      title: `${action} Records`,
      message: `Are you sure you want to ${action.toLowerCase()} ${selectedRecords.size} record(s)?`,
      type: action === "DELETE" ? "danger" : "warning",
      confirmText: action,
      onConfirm: async () => {
        await bulkActionMutation.mutateAsync({ action, ids: Array.from(selectedRecords) });
        setSelectedRecords(new Set());
        await refetch();
      },
    });
  };

  const handleUpdateStatus = async (recordId: string, status: string, reason: string) => {
    try {
      const payload: any = { id: recordId, status };
      if (reason) payload.settlement_notes = reason;
      await updateMutation.mutateAsync(payload);
      await refetch();
    } catch (error: any) {
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Exit Management"
        subtitle="Track employee offboarding and clearances"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-muted"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            {permissions.create && (
              <button
                onClick={() => { setEditingRecord(null); setModalOpen(true); }}
                className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
              >
                <Plus className="w-4 h-4" /> Initiate Exit
              </button>
            )}
          </div>
        }
      />

      {stats && (
        <StatsCards
          stats={[
            { id: "total-exits", label: "Total Exits", value: stats.total_exits },
            { id: "pending-exits", label: "Pending", value: stats.pending_exits, valueClassName: "text-warning" },
            { id: "confirmed-exits", label: "Confirmed", value: stats.confirmed_exits, valueClassName: "text-success" },
            { id: "rejected-exits", label: "Rejected", value: stats.rejected_exits, valueClassName: "text-destructive" },
          ]}
        />
      )}

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by employee name..."
              className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <SearchableSelect
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: "PENDING", label: "Pending" },
                { value: "CONFIRMED", label: "Confirmed" },
                { value: "REJECTED", label: "Rejected" },
              ]}
              placeholder="Status"
              className="w-32"
            />
            <SearchableSelect
              value={filterReason}
              onChange={setFilterReason}
              options={EXIT_REASONS}
              placeholder="Exit Reason"
              className="w-36"
            />
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode(viewMode === "table" ? "kanban" : "table")}
                className="px-3 h-9 rounded-md border border-border text-sm hover:bg-muted"
              >
                {viewMode === "table" ? "Kanban" : "Table"}
              </button>
              {selectedRecords.size > 0 && (
                <>
                  {permissions.update && (
                    <button onClick={() => handleBulkAction("CONFIRM")} className="px-3 h-9 rounded-md border border-border text-sm text-success">
                      Confirm
                    </button>
                  )}
                  {permissions.update && (
                    <button onClick={() => handleBulkAction("REJECT")} className="px-3 h-9 rounded-md border border-border text-sm text-destructive">
                      Reject
                    </button>
                  )}
                  {permissions.delete && (
                    <button onClick={() => handleBulkAction("DELETE")} className="px-3 h-9 rounded-md border border-border text-sm text-destructive">
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {viewMode === "table" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <Checkbox
                      checked={selectedRecords.size === filteredRecords.length && filteredRecords.length > 0}
                      indeterminate={selectedRecords.size > 0 && selectedRecords.size < filteredRecords.length}
                      onChange={(checked) => {
                        if (checked) setSelectedRecords(new Set(filteredRecords.map(r => r.id)));
                        else setSelectedRecords(new Set());
                      }}
                    />
                  </th>
                  <th className="text-left px-4 py-2.5">Employee</th>
                  <th className="text-left px-4 py-2.5">Exit / LWD</th>
                  <th className="text-left px-4 py-2.5">Reason</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                  <th className="text-left px-4 py-2.5">Settlement</th>
                  <th className="text-left px-4 py-2.5">Notes</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <Checkbox
                        checked={selectedRecords.has(r.id)}
                        onChange={(checked) => {
                          const newSet = new Set(selectedRecords);
                          if (checked) newSet.add(r.id);
                          else newSet.delete(r.id);
                          setSelectedRecords(newSet);
                        }}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{r.employee_name}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-xs">{r.exit_date || "—"}</div>
                      <div className="text-[10px] text-muted-foreground">LWD: {r.last_working_day || "—"}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="inline-flex px-2 py-0.5 text-[11px] rounded-full border bg-muted">
                        {r.reason}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {permissions.update && r.status_value === "PENDING" ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setSettlementDialog({ recordId: r.id, status: "CONFIRMED" }); setSettlementReason(""); }}
                            className="text-[11px] font-medium rounded-full px-2 py-1 bg-success/15 text-success hover:bg-success/25"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => { setSettlementDialog({ recordId: r.id, status: "REJECTED" }); setSettlementReason(""); }}
                            className="text-[11px] font-medium rounded-full px-2 py-1 bg-destructive/15 text-destructive hover:bg-destructive/25"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full font-medium ${STATUS_STYLES[r.status_value] || 'bg-muted text-muted-foreground'}`}>
                          {r.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono">
                      {formatCurrency(r.final_settlement)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                      {r.settlement_notes || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => router.push(`/hr/exit/${r.id}`)}
                          className="p-1.5 rounded-md hover:bg-muted"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {r.status_value === "CONFIRMED" && (
                          <button
                            onClick={() => setAssetReturnExitId(r.id)}
                            className="p-1.5 rounded-md hover:bg-muted text-primary"
                            title="Return Assets"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        {permissions.update && (
                          <button onClick={() => { setEditingRecord(r); setModalOpen(true); }} className="p-1.5 rounded-md hover:bg-muted">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {permissions.delete && (
                          <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground">No exit records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === "kanban" && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {["PENDING", "CONFIRMED", "REJECTED"].map(status => {
              const statusRecords = filteredRecords.filter(r => r.status_value === status);
              return (
                <div key={status} className="bg-muted/20 rounded-lg p-3">
                  <div className="flex justify-between mb-3">
                    <h3 className="text-sm font-semibold">{status}</h3>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{statusRecords.length}</span>
                  </div>
                  <div className="space-y-2">
                    {statusRecords.map(r => (
                      <div
                        key={r.id}
                        className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-md"
                        onClick={() => router.push(`/hr/exit/${r.id}`)}
                      >
                        <div className="font-medium text-sm">{r.employee_name}</div>
                        <div className="text-xs mt-1">{r.reason}</div>
                        <div className="flex justify-between mt-2 text-xs">
                          <span>{r.exit_date}</span>
                          {r.settlement_notes && <span className="text-muted-foreground truncate ml-2">{r.settlement_notes}</span>}
                        </div>
                      </div>
                    ))}
                    {statusRecords.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No records</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
          Showing {filteredRecords.length} of {records.length} records
        </div>
      </div>

      {(modalOpen && (editingRecord ? permissions.update : permissions.create)) && (
        <ExitFormModal
          formatCurrency={formatCurrency}
          employees={employees}
          exitRecords={records}
          initialData={editingRecord}
          onSubmit={handleSave}
          onClose={() => { setModalOpen(false); setEditingRecord(null); }}
        />
      )}

      {settlementDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4" onClick={() => setSettlementDialog(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-semibold">{settlementDialog.status === "CONFIRMED" ? "Confirm" : "Reject"} Exit</h2>
              <button type="button" onClick={() => setSettlementDialog(null)} className="p-1.5 rounded-md hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                {settlementDialog.status === "CONFIRMED"
                  ? "Confirming this exit will update the employee's employment status and lock the record."
                  : "Rejecting this exit will keep the employee's status unchanged and lock the record."}
              </p>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Reason (optional)</span>
                <textarea
                  value={settlementReason}
                  onChange={e => setSettlementReason(e.target.value)}
                  className="bg-muted/40 border border-border rounded-md p-3 outline-none resize-none"
                  rows={3}
                  placeholder={`Enter reason for ${settlementDialog.status.toLowerCase()}...`}
                />
              </label>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettlementDialog(null)}
                className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleUpdateStatus(settlementDialog.recordId, settlementDialog.status, settlementReason);
                  setSettlementDialog(null);
                }}
                className={`px-4 h-9 rounded-md text-sm text-white hover:opacity-90 ${
                  settlementDialog.status === "CONFIRMED" ? "bg-success" : "bg-destructive"
                }`}
              >
                {settlementDialog.status === "CONFIRMED" ? "Confirm Exit" : "Reject Exit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Return Modal */}
      {assetReturnExitId && (
        <AssetReturnModal
          exitId={assetReturnExitId}
          assets={assets}
          loading={assetsLoading}
          returnMutation={returnAssetMutation}
          onClose={() => { setAssetReturnExitId(null); refetch(); }}
        />
      )}

      <confirmationModal.Modal />
    </div>
  );
}

// ==========================================
// EXIT FORM MODAL
// ==========================================
function ExitFormModal({
  formatCurrency,
  initialData,
  employees,
  exitRecords,
  onSubmit,
  onClose
}: {
  formatCurrency: (amount?: number, decimals?: number) => string;
  initialData: ExitRecord | null;
  employees: any[];
  exitRecords: ExitRecord[];
  onSubmit: (d: any) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    employee_id: initialData?.employee_id || "",
    exit_date: initialData?.exit_date || "",
    last_working_day: initialData?.last_working_day || "",
    reason: initialData?.reason_value || "RESIGNATION",
    notice_served: initialData?.notice_served ?? true,
    notes: initialData?.notes || "",
  });

  const [settlementPreview, setSettlementPreview] = useState<number | null>(initialData?.final_settlement ?? null);
  const [calculating, setCalculating] = useState(false);
  const finalSettlementMutation = useFinalSettlementPreview();

  const isLocked = initialData?.status_value === "CONFIRMED" || initialData?.status_value === "REJECTED";

  const blockedEmployeeIds = new Set(
    exitRecords
      .filter(r => r.status_value !== 'REJECTED')
      .map(r => r.employee_id)
  );
  const availableEmployees = initialData
    ? employees.filter(e => String(e.id) === initialData.employee_id || !blockedEmployeeIds.has(String(e.id)))
    : employees.filter(e => !blockedEmployeeIds.has(String(e.id)));
  const employeeOpts: SearchableSelectOption[] = availableEmployees
    .map((e: any) => ({
      value: String(e.id),
      label: `${e.first_name} ${e.last_name || ""} (${e.department_name || "N/A"})`
    }));

  const selectedEmployee = employees.find((e: any) => String(e.id) === formData.employee_id);

  const handleCalculateSettlement = async () => {
    if (!formData.employee_id || !formData.last_working_day) {
      toast.error("Select an employee and set a last working day first.");
      return;
    }
    setCalculating(true);
    try {
      const result = await finalSettlementMutation.mutateAsync({
        employee_id: formData.employee_id,
        last_working_day: formData.last_working_day,
      });
      const net = parseFloat(result.net_settlement || result.net_salary || "0");
      setSettlementPreview(net);
      toast.success("Settlement calculated");
    } catch {
      toast.error("Failed to calculate settlement");
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id || !formData.exit_date || !formData.last_working_day || !formData.reason) {
      toast.error("Employee, Exit Date, Last Working Day and reason are required.");
      return;
    }
    onSubmit({ ...formData, final_settlement: settlementPreview ?? 0 });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">{initialData ? "Edit Exit Record" : "Initiate Exit Process"}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLocked && (
          <div className="mx-5 mt-4 px-4 py-2.5 rounded-lg bg-warning/10 border border-warning/30 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-warning shrink-0" />
            <span>This record is <strong>{initialData?.status === "Confirmed" ? "Confirmed" : "Rejected"}</strong> and cannot be edited.</span>
          </div>
        )}

        <div className="p-5 grid sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Employee *</span>
            <SearchableSelect
              value={formData.employee_id}
              onChange={v => setFormData({ ...formData, employee_id: v })}
              options={employeeOpts}
              placeholder="Select Employee"
              disabled={isLocked}
            />
          </label>

          {selectedEmployee && (
            <>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Department</span>
                <input
                  value={selectedEmployee.department_name || ""}
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none"
                  readOnly
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Designation</span>
                <input
                  value={selectedEmployee.designation_name || ""}
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none"
                  readOnly
                />
              </label>
            </>
          )}

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Exit Reason *</span>
            <SearchableSelect
              value={formData.reason}
              onChange={v => setFormData({ ...formData, reason: v })}
              options={EXIT_REASONS}
              placeholder="Select Reason"
              disabled={isLocked}
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Exit Date *</span>
            <DatePicker
              value={formData.exit_date}
              onChange={v => setFormData({ ...formData, exit_date: v || "" })}
              disabled={isLocked}
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Last Working Day</span>
            <DatePicker
              value={formData.last_working_day}
              onChange={v => setFormData({ ...formData, last_working_day: v || "" })}
              disabled={isLocked}
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Notice Period Served?</span>
            <select
              value={formData.notice_served.toString()}
              onChange={e => setFormData({ ...formData, notice_served: e.target.value === "true" })}
              className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none"
              disabled={isLocked}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Notes / Handover Details</span>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="bg-muted/40 border border-border rounded-md p-3 outline-none"
              placeholder="Asset return details, final handover notes, etc."
              disabled={isLocked}
            />
          </label>

          {/* Settlement Calculation */}
          {!isLocked && (
            <div className="sm:col-span-2 border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Final Settlement</h4>
                <button
                  type="button"
                  onClick={handleCalculateSettlement}
                  disabled={calculating || !formData.employee_id || !formData.last_working_day}
                  className="px-3 h-8 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1"
                >
                  {calculating && <Loader2 className="w-3 h-3 animate-spin" />}
                  {calculating ? "Calculating..." : "Calculate"}
                </button>
              </div>
              {settlementPreview !== null ? (
                <div className="text-lg font-semibold text-primary">
                  {formatCurrency(settlementPreview)}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Select an employee and set a last working day, then click Calculate.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
            {isLocked ? "Close" : "Cancel"}
          </button>
          {!isLocked && (
            <button type="submit" className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
              {initialData ? "Update Record" : "Save Record"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ==========================================
// ASSET RETURN MODAL
// ==========================================
function AssetReturnModal({
  exitId,
  assets,
  loading,
  returnMutation,
  onClose,
}: {
  exitId: string;
  assets: ExitEmployeeAsset[];
  loading: boolean;
  returnMutation: any;
  onClose: () => void;
}) {
  const [returningId, setReturningId] = useState<string | null>(null);
  const [conditionMap, setConditionMap] = useState<Record<string, string>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  const handleReturn = async (asset: ExitEmployeeAsset) => {
    setReturningId(asset.id);
    try {
      await returnMutation.mutateAsync({
        exitId,
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

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="font-semibold">Return Assets</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No assets allocated to this employee.</p>
          ) : (
            assets.map(asset => (
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
                    <span className="text-muted-foreground">Condition on Return</span>
                    <select
                      value={conditionMap[asset.id] || "GOOD"}
                      onChange={e => setConditionMap(p => ({ ...p, [asset.id]: e.target.value }))}
                      className="bg-muted/40 border border-border rounded-md h-8 px-2 text-xs outline-none"
                    >
                      {CONDITION_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs flex flex-col gap-1">
                    <span className="text-muted-foreground">Return Notes</span>
                    <input
                      value={notesMap[asset.id] || ""}
                      onChange={e => setNotesMap(p => ({ ...p, [asset.id]: e.target.value }))}
                      className="bg-muted/40 border border-border rounded-md h-8 px-2 text-xs outline-none"
                      placeholder="Optional notes"
                    />
                  </label>
                </div>

                <button
                  onClick={() => handleReturn(asset)}
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
            ))
          )}
        </div>

        <div className="p-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-9 rounded-md border border-border text-sm hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
