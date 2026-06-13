// src/app/(app)/hr/exit/page.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/cards/StatCard";
import SearchableSelect, { SearchableSelectOption } from "@/components/reuseable/SearchableSelect";
import { DatePicker } from "@/components/reuseable/DatePicker";
import { Checkbox } from "@/components/reuseable/Checkbox";
import ConfirmationModal, { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import {
  Search, Plus, RefreshCw, Trash2, Pencil, LogOut, Briefcase,
  AlertTriangle, Clock, CheckCircle2, X, FileText, ShieldCheck,
  Eye, Loader2
} from "lucide-react";
import {
  useExitRecords,
  useExitStats,
  useCreateExitRecord,
  useUpdateExitRecord,
  useDeleteExitRecord,
  useBulkAction,
  useFinalSettlementPreview,
  ExitRecord,
  ExitChecklistItem
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

const SETTLEMENT_STATUSES: SearchableSelectOption[] = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "REJECTED", label: "Rejected" },
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
  const [filterSettlement, setFilterSettlement] = useState("");
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExitRecord | null>(null);

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
        r.employee_name.toLowerCase().includes(query.toLowerCase()) ||
        r.department.toLowerCase().includes(query.toLowerCase()) ||
        (r.designation?.toLowerCase() || "").includes(query.toLowerCase());
      const matchesStatus = filterStatus === "" || r.status_value === filterStatus;
      const matchesReason = filterReason === "" || r.reason_value === filterReason;
      const matchesSettlement = filterSettlement === "" || r.final_settlement_status === filterSettlement;
      return matchesSearch && matchesStatus && matchesReason && matchesSettlement;
    });
  }, [records, query, filterStatus, filterReason, filterSettlement]);

  const handleSave = async (data: Partial<ExitRecord>) => {
    try {
      if (editingRecord) {
        await updateMutation.mutateAsync({ id: editingRecord.id, ...data });
        toast.success("Exit record updated");
      } else {
        await createMutation.mutateAsync(data);
        toast.success("Exit record created");
      }
      await refetch();
      setModalOpen(false);
      setEditingRecord(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
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
        toast.success("Deleted");
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
        toast.success(`${action} completed`);
        await refetch();
      },
    });
  };

  const handleUpdateSettlementStatus = async (recordId: string, status: string) => {
    try {
      await updateMutation.mutateAsync({ id: recordId, final_settlement_status: status });
      toast.success(`Settlement ${status.toLowerCase()}`);
      await refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
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
        subtitle="Track employee offboarding, clearances, and final settlements"
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
      {
        id: "total-exits",
        label: "Total Exits",
        value: stats.total_exits,
      },
      {
        id: "active-exits",
        label: "Active Exits",
        value: stats.active_exits,
      },
      {
        id: "pending-clearance",
        label: "Pending Clearance",
        value: stats.pending_clearance,
        valueClassName: "text-warning",
      },
      {
        id: "in-progress",
        label: "In Progress",
        value: stats.in_progress_clearance,
        valueClassName: "text-destructive",
      },
      {
        id: "completed",
        label: "Completed",
        value: stats.completed_clearance,
        valueClassName: "text-success",
      },
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
              placeholder="Search by employee name, department..."
              className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <SearchableSelect
              value={filterStatus}
              onChange={setFilterStatus}
              options={[{ value: "ACTIVE", label: "Active" }, { value: "CLOSED", label: "Closed" }]}
              placeholder="Status"
              className="w-32"
            />
            <SearchableSelect
              value={filterSettlement}
              onChange={setFilterSettlement}
              options={SETTLEMENT_STATUSES}
              placeholder="Settlement"
              className="w-36"
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
                    <button onClick={() => handleBulkAction("CLOSE")} className="px-3 h-9 rounded-md border border-border text-sm text-success">
                      Close
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
                  <th className="text-left px-4 py-2.5">Department</th>
                  <th className="text-left px-4 py-2.5">Exit / LWD</th>
                  <th className="text-left px-4 py-2.5">Reason</th>
                  <th className="text-left px-4 py-2.5">Settlement Status</th>
                  <th className="text-left px-4 py-2.5">Settlement</th>
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
                      <div className="text-xs text-muted-foreground">{r.designation || "—"}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{r.department}</td>
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
                      {permissions.update_status && r.final_settlement_status !== "CONFIRMED" && r.final_settlement_status !== "REJECTED" ? (
                        <select
                          value={r.final_settlement_status}
                          onChange={e => handleUpdateSettlementStatus(r.id, e.target.value)}
                          className={`text-[11px] font-medium rounded-full px-2 py-1 border-0 outline-none cursor-pointer ${
                            r.final_settlement_status === 'CONFIRMED' ? 'bg-success/15 text-success' :
                            r.final_settlement_status === 'REJECTED' ? 'bg-destructive/15 text-destructive' :
                            'bg-muted text-muted-foreground'
                          }`}
                        >
                          {SETTLEMENT_STATUSES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full font-medium ${
                          r.final_settlement_status === 'CONFIRMED' ? 'bg-success/15 text-success' :
                          r.final_settlement_status === 'REJECTED' ? 'bg-destructive/15 text-destructive' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {r.final_settlement_status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium">
                      {r.final_settlement ? `${formatCurrency(r.final_settlement)}` : "—"}
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
                    <td colSpan={8} className="text-center py-10 text-muted-foreground">No exit records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === "kanban" && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {["PENDING", "CONFIRMED", "REJECTED"].map(status => {
              const statusRecords = filteredRecords.filter(r => r.final_settlement_status === status);
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
                        <div className="text-xs text-muted-foreground">{r.department}</div>
                        <div className="text-xs mt-1">{r.reason}</div>
                        <div className="flex justify-between mt-2 text-xs">
                          <span>{r.exit_date}</span>
                          <span>{formatCurrency(r.final_settlement)}</span>
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
          initialData={editingRecord}
          onSubmit={handleSave}
          onClose={() => { setModalOpen(false); setEditingRecord(null); }}
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
  onSubmit,
  onClose
}: {
  formatCurrency: (amount?: number, decimals?: number) => string;
  initialData: ExitRecord | null;
  employees: any[];
  onSubmit: (d: any) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    employee_id: initialData?.employee_id || "",
    exit_date: initialData?.exit_date || "",
    last_working_day: initialData?.last_working_day || "",
    reason: initialData?.reason_value || "RESIGNATION",
    notice_served: initialData?.notice_served ?? true,
    final_settlement: initialData?.final_settlement || 0,
    final_settlement_status: initialData?.final_settlement_status || "PENDING",
    notes: initialData?.notes || "",
    update_employee_status: true,
  });

  const [calculating, setCalculating] = useState(false);
  const finalSettlementMutation = useFinalSettlementPreview();

  const isLocked = initialData?.final_settlement_status === "CONFIRMED" || initialData?.final_settlement_status === "REJECTED";

  const employeeOpts: SearchableSelectOption[] = employees
    .map((e: any) => ({
      value: String(e.id),
      label: `${e.first_name} ${e.last_name || ""} (${e.department_name || "N/A"})`
    }));

  const selectedEmployee = employees.find((e: any) => String(e.id) === formData.employee_id);

  const calculateSettlement = useCallback(async (empId: string, lwd: string) => {
    if (!empId) return;
    setCalculating(true);
    try {
      const payload: { employee_id: string; last_working_day?: string } = { employee_id: empId };
      if (lwd) payload.last_working_day = lwd;
      const result = await finalSettlementMutation.mutateAsync(payload);
      setFormData(prev => ({
        ...prev,
        final_settlement: parseFloat(result.net_salary) || 0,
      }));
    } catch (err: any) {
      toast.error(err.message || "Failed to calculate settlement");
    } finally {
      setCalculating(false);
    }
  }, [finalSettlementMutation]);

  const tryCalculateSettlement = (empId: string, lwd: string) => {
    if (empId && lwd) {
      calculateSettlement(empId, lwd);
    }
  };

  const handleEmployeeSelect = (empId: string) => {
    const emp = employees.find((e: any) => String(e.id) === empId);
    if (emp) {
      setFormData(prev => ({
        ...prev,
        employee_id: empId,
      }));
      tryCalculateSettlement(empId, formData.last_working_day);
    }
  };

  const handleLastWorkingDayChange = (lwd: string) => {
    setFormData(prev => ({
      ...prev,
      last_working_day: lwd,
    }));
    tryCalculateSettlement(formData.employee_id, lwd);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id || !formData.exit_date) {
      toast.error("Employee and Exit Date are required.");
      return;
    }
    onSubmit(formData);
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
            <span>This record is <strong>{initialData?.final_settlement_status === "CONFIRMED" ? "Confirmed" : "Rejected"}</strong> and cannot be edited.</span>
          </div>
        )}

        <div className="p-5 grid sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Employee *</span>
            <SearchableSelect
              value={formData.employee_id}
              onChange={handleEmployeeSelect}
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
              onChange={v => handleLastWorkingDayChange(v || "")}
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
            <span className="text-muted-foreground">Final Settlement Amount</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{formatCurrency()}</span>
              <input
                type="number"
                value={formData.final_settlement}
                onChange={e => setFormData({ ...formData, final_settlement: Number(e.target.value) })}
                className="bg-muted/40 border border-border rounded-md h-9 pl-10 pr-3 outline-none w-full"
                placeholder="0.00"
                disabled={isLocked}
              />
              {calculating && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Settlement Status</span>
            <select
              value={formData.final_settlement_status}
              onChange={e => setFormData({ ...formData, final_settlement_status: e.target.value })}
              className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none"
              disabled={isLocked}
            >
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REJECTED">Rejected</option>
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
