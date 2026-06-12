// src/app/(dashboard)/hr/exit-management/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useApi } from "@/hooks/useApi";
import { useEmployees } from "@/hooks/useEmployees";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/cards/StatCard";
import SearchableSelect, { SearchableSelectOption } from "@/components/reuseable/SearchableSelect";
import { DatePicker } from "@/components/reuseable/DatePicker";
import { Checkbox } from "@/components/reuseable/Checkbox";
import ConfirmationModal, { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import {
  Search, Plus, Filter, Eye, Trash2, Pencil, LogOut, ShieldCheck, 
  Briefcase, Wallet, Clock, ArrowRight, CheckCircle2, AlertTriangle, 
  X, RefreshCw, Download, ChevronDown, ChevronUp, FileText
} from "lucide-react";

// ==========================================
// TYPES & INTERFACES
// ==========================================
interface ExitRecord {
  id: number;
  _id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  exit_date: string;
  last_working_day: string;
  reason: string;
  reason_value: string;
  notice_served: boolean;
  clearance_hr: boolean;
  clearance_it: boolean;
  clearance_finance: boolean;
  clearance_admin: boolean;
  clearance_status: string;
  clearance_status_value: string;
  clearance_progress: number;
  final_settlement: number;
  notes: string;
  status: string;
  status_value: string;
  company_id?: string;
  branch_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface ExitStats {
  total_exits: number;
  active_exits: number;
  closed_exits: number;
  pending_clearance: number;
  in_progress_clearance: number;
  completed_clearance: number;
  avg_settlement: number;
  total_settlement: number;
  by_reason: Array<{ reason: string; count: number }>;
  by_department: Array<{ department: string; count: number }>;
  monthly_trend: Array<{ month: number; count: number }>;
  clearance_completion_rate: number;
  notice_compliance_rate: number;
}

interface ExitChecklistItem {
  id: number;
  _id: string;
  exit_record_id: number;
  item_type: string;
  item_name: string;
  description: string;
  status: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  completed_at: string | null;
  notes: string;
}

interface ExitInterview {
  id: number;
  exit_record_id: number;
  interview_date: string | null;
  interviewed_by: number | null;
  interviewed_by_name: string | null;
  reason_for_leaving: string;
  feedback_management: string;
  feedback_work_environment: string;
  feedback_compensation: string;
  feedback_growth: string;
  overall_experience: number | null;
  management_rating: number | null;
  work_environment_rating: number | null;
  new_employer: string;
  new_position: string;
  new_salary_range: string;
  willing_to_rejoin: boolean;
  any_concerns: string;
  general_feedback: string;
}

const EXIT_REASONS: SearchableSelectOption[] = [
  { value: "RESIGNATION", label: "👋 Resignation" },
  { value: "TERMINATION", label: "❌ Termination" },
  { value: "CONTRACT_END", label: "📄 Contract End" },
  { value: "RETIREMENT", label: "👴 Retirement" },
  { value: "OTHER", label: "📝 Other" },
];

const CLEARANCE_STATUSES: SearchableSelectOption[] = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "APPROVED", label: "Approved" },
  { value: "COMPLETED", label: "Completed" },
];

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function ExitManagementPage() {
  const api = useApi();
  const { data: employees = [] } = useEmployees();
  const confirmationModal = useConfirmationModal();
  
  const [records, setRecords] = useState<ExitRecord[]>([]);
  const [stats, setStats] = useState<ExitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const [filterClearance, setFilterClearance] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExitRecord | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [checklistModal, setChecklistModal] = useState(false);
  const [interviewModal, setInterviewModal] = useState(false);
  const [activeRecord, setActiveRecord] = useState<ExitRecord | null>(null);
  const [checklistItems, setChecklistItems] = useState<ExitChecklistItem[]>([]);
  const [interview, setInterview] = useState<ExitInterview | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [exitData, statsData] = await Promise.all([
        api<{ data: ExitRecord[] }>("/api/hr/exits/"),
        api<ExitStats>("/api/hr/exits/stats/"),
      ]);
      setRecords(exitData.data);
      setStats(statsData);
    } catch (error) {
      console.error("Failed to load exit records:", error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load checklist items
  const loadChecklist = useCallback(async (recordId: number) => {
    try {
      const items = await api<ExitChecklistItem[]>(`/api/hr/exits/checklist/?exit_record_id=${recordId}`);
      setChecklistItems(items);
    } catch (error) {
      console.error("Failed to load checklist:", error);
    }
  }, [api]);

  // Load interview
  const loadInterview = useCallback(async (recordId: number) => {
    try {
      const data = await api<ExitInterview | null>(`/api/hr/exits/interview/?exit_record_id=${recordId}`);
      setInterview(data);
    } catch (error) {
      console.error("Failed to load interview:", error);
    }
  }, [api]);

  // ==========================================
  // FILTERING
  // ==========================================
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = query === "" ||
        r.employee_name.toLowerCase().includes(query.toLowerCase()) ||
        r.department.toLowerCase().includes(query.toLowerCase()) ||
        r.designation?.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = filterStatus === "" || r.status_value === filterStatus;
      const matchesReason = filterReason === "" || r.reason_value === filterReason;
      const matchesClearance = filterClearance === "" || r.clearance_status_value === filterClearance;
      return matchesSearch && matchesStatus && matchesReason && matchesClearance;
    });
  }, [records, query, filterStatus, filterReason, filterClearance]);

  // ==========================================
  // ACTIONS
  // ==========================================
  const handleSave = async (data: Partial<ExitRecord>) => {
    try {
      if (editingRecord) {
        await api(`/api/hr/exits/`, {
          method: "PATCH",
          body: JSON.stringify({ id: editingRecord.id, ...data }),
        });
      } else {
        await api("/api/hr/exits/", {
          method: "POST",
          body: JSON.stringify(data),
        });
      }
      await loadData();
      setModalOpen(false);
      setEditingRecord(null);
    } catch (error: any) {
      alert(error.message || "Failed to save exit record");
    }
  };

  const handleDelete = (id: number) => {
    confirmationModal.confirm({
      title: "Delete Exit Record",
      message: "Are you sure you want to delete this exit record? This action cannot be undone.",
      type: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          await api("/api/hr/exits/", {
            method: "DELETE",
            body: JSON.stringify({ id }),
          });
          await loadData();
        } catch (error: any) {
          alert(error.message || "Failed to delete exit record");
        }
      },
    });
  };

  const handleBulkAction = (action: string) => {
    if (selectedRecords.size === 0) {
      alert("Please select records first");
      return;
    }

    const actionLabels: Record<string, string> = {
      CLOSE: "Close",
      REOPEN: "Reopen",
      DELETE: "Delete",
    };

    confirmationModal.confirm({
      title: `${actionLabels[action]} Records`,
      message: `Are you sure you want to ${action.toLowerCase()} ${selectedRecords.size} selected record(s)?`,
      type: action === "DELETE" ? "danger" : "warning",
      confirmText: actionLabels[action],
      onConfirm: async () => {
        try {
          await api("/api/hr/exits/bulk-action/", {
            method: "POST",
            body: JSON.stringify({
              action,
              ids: Array.from(selectedRecords),
            }),
          });
          setSelectedRecords(new Set());
          await loadData();
        } catch (error: any) {
          alert(error.message || "Failed to perform bulk action");
        }
      },
    });
  };

  const handleUpdateChecklistItem = async (itemId: number, status: string) => {
    try {
      await api("/api/hr/exits/checklist/", {
        method: "PATCH",
        body: JSON.stringify({ id: itemId, status }),
      });
      if (activeRecord) {
        await loadChecklist(activeRecord.id);
        await loadData(); // Refresh main data to update clearance status
      }
    } catch (error: any) {
      alert(error.message || "Failed to update checklist item");
    }
  };

  const handleSaveInterview = async (data: Partial<ExitInterview>) => {
    try {
      await api("/api/hr/exits/interview/", {
        method: "POST",
        body: JSON.stringify(data),
      });
      alert("Interview saved successfully!");
      setInterviewModal(false);
      if (activeRecord) {
        await loadInterview(activeRecord.id);
      }
    } catch (error: any) {
      alert(error.message || "Failed to save interview");
    }
  };

  // ==========================================
  // RENDER
  // ==========================================
  if (loading) {
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
              onClick={() => loadData()}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-muted"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={() => { setEditingRecord(null); setModalOpen(true); }}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Initiate Exit
            </button>
          </div>
        }
      />

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Total Exits" value={stats.total_exits} icon={LogOut} accent="info" />
          <StatCard label="Active Exits" value={stats.active_exits} icon={Briefcase} accent="info" />
          <StatCard label="Pending Clearance" value={stats.pending_clearance} icon={AlertTriangle} accent="warning" />
          <StatCard label="In Progress" value={stats.in_progress_clearance} icon={Clock} accent="destructive" />
          <StatCard label="Completed" value={stats.completed_clearance} icon={CheckCircle2} accent="success" />
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by employee name, department, or designation..."
              className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <SearchableSelect
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "CLOSED", label: "Closed" },
              ]}
              placeholder="Status"
              className="w-32"
            />
            <SearchableSelect
              value={filterClearance}
              onChange={setFilterClearance}
              options={CLEARANCE_STATUSES}
              placeholder="Clearance Status"
              className="w-40"
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
                title="Toggle View"
              >
                {viewMode === "table" ? "Kanban" : "Table"}
              </button>
              {selectedRecords.size > 0 && (
                <>
                  <button
                    onClick={() => handleBulkAction("CLOSE")}
                    className="px-3 h-9 rounded-md border border-border text-sm hover:bg-muted text-success"
                    title="Close Selected"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleBulkAction("DELETE")}
                    className="px-3 h-9 rounded-md border border-border text-sm hover:bg-muted text-destructive"
                    title="Delete Selected"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Table View */}
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
                        if (checked) {
                          setSelectedRecords(new Set(filteredRecords.map(r => r.id)));
                        } else {
                          setSelectedRecords(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="text-left px-4 py-2.5">Employee</th>
                  <th className="text-left px-4 py-2.5">Department</th>
                  <th className="text-left px-4 py-2.5">Exit / LWD</th>
                  <th className="text-left px-4 py-2.5">Reason</th>
                  <th className="text-left px-4 py-2.5">Clearance Status</th>
                  <th className="text-left px-4 py-2.5">Progress</th>
                  <th className="text-left px-4 py-2.5">Settlement</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-muted-foreground">
                      No exit records found.
                    </td>
                  </tr>
                ) : filteredRecords.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <Checkbox
                        checked={selectedRecords.has(r.id)}
                        onChange={(checked) => {
                          const newSet = new Set(selectedRecords);
                          if (checked) {
                            newSet.add(r.id);
                          } else {
                            newSet.delete(r.id);
                          }
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
                      <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                        r.reason_value === "RESIGNATION" ? "bg-info/15 text-info border-info/30" :
                        r.reason_value === "TERMINATION" ? "bg-destructive/15 text-destructive border-destructive/30" :
                        "bg-muted text-muted-foreground border-border"
                      }`}>
                        {r.reason}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                        r.clearance_status_value === "COMPLETED" ? "bg-success/15 text-success border-success/30" :
                        r.clearance_status_value === "APPROVED" ? "bg-info/15 text-info border-info/30" :
                        r.clearance_status_value === "IN_PROGRESS" ? "bg-warning/15 text-warning border-warning/30" :
                        "bg-muted text-muted-foreground border-border"
                      }`}>
                        {r.clearance_status}
                      </span>
                      <div className="flex gap-1 mt-1">
                        <ShieldCheck className={`w-3 h-3 ${r.clearance_hr ? "text-success" : "text-muted-foreground/40"}`} title="HR" />
                        <ShieldCheck className={`w-3 h-3 ${r.clearance_it ? "text-success" : "text-muted-foreground/40"}`} title="IT" />
                        <ShieldCheck className={`w-3 h-3 ${r.clearance_finance ? "text-success" : "text-muted-foreground/40"}`} title="Finance" />
                        <ShieldCheck className={`w-3 h-3 ${r.clearance_admin ? "text-success" : "text-muted-foreground/40"}`} title="Admin" />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="w-20 bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full"
                          style={{ width: `${r.clearance_progress}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{r.clearance_progress}%</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium">
                      {r.final_settlement ? `PKR ${r.final_settlement.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setActiveRecord(r);
                            setChecklistModal(true);
                            loadChecklist(r.id);
                          }}
                          className="p-1.5 rounded-md hover:bg-muted"
                          title="Checklist"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setActiveRecord(r);
                            setInterviewModal(true);
                            loadInterview(r.id);
                          }}
                          className="p-1.5 rounded-md hover:bg-muted"
                          title="Exit Interview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditingRecord(r); setModalOpen(true); }}
                          className="p-1.5 rounded-md hover:bg-muted"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Kanban View */}
        {viewMode === "kanban" && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {["PENDING", "IN_PROGRESS", "APPROVED", "COMPLETED"].map(status => {
              const statusRecords = filteredRecords.filter(r => r.clearance_status_value === status);
              return (
                <div key={status} className="bg-muted/20 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">{status.replace("_", " ")}</h3>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{statusRecords.length}</span>
                  </div>
                  <div className="space-y-2">
                    {statusRecords.map(r => (
                      <div key={r.id} className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setEditingRecord(r); setModalOpen(true); }}>
                        <div className="font-medium text-sm">{r.employee_name}</div>
                        <div className="text-xs text-muted-foreground">{r.department}</div>
                        <div className="text-xs mt-1">{r.reason}</div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[10px]">{r.exit_date}</span>
                          <span className="text-xs font-medium">PKR {r.final_settlement.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                    {statusRecords.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4">No records</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
          Showing {filteredRecords.length} of {records.length} records
          {selectedRecords.size > 0 && ` • ${selectedRecords.size} selected`}
        </div>
      </div>

      {/* Exit Form Modal */}
      {modalOpen && (
        <ExitFormModal
          employees={employees}
          initialData={editingRecord}
          onSubmit={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Checklist Modal */}
      {checklistModal && activeRecord && (
        <ChecklistModal
          record={activeRecord}
          items={checklistItems}
          onUpdateItem={handleUpdateChecklistItem}
          onClose={() => setChecklistModal(false)}
        />
      )}

      {/* Exit Interview Modal */}
      {interviewModal && activeRecord && (
        <ExitInterviewModal
          record={activeRecord}
          interview={interview}
          employees={employees}
          onSubmit={handleSaveInterview}
          onClose={() => setInterviewModal(false)}
        />
      )}

      {/* Confirmation Modal */}
      <confirmationModal.Modal />
    </div>
  );
}

// ==========================================
// EXIT FORM MODAL
// ==========================================
function ExitFormModal({ 
  initialData, 
  employees, 
  onSubmit, 
  onClose 
}: { 
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
    clearance_hr: initialData?.clearance_hr || false,
    clearance_it: initialData?.clearance_it || false,
    clearance_finance: initialData?.clearance_finance || false,
    clearance_admin: initialData?.clearance_admin || false,
    final_settlement: initialData?.final_settlement || 0,
    notes: initialData?.notes || "",
    update_employee_status: true,
  });

  const employeeOpts: SearchableSelectOption[] = employees
    .filter(e => e.employment_status === "ACTIVE")
    .map(e => ({
      value: String(e.id),
      label: `${e.first_name} ${e.last_name || ""} (${e.department || "N/A"})`
    }));

  const handleEmployeeSelect = (empId: string) => {
    const emp = employees.find(e => String(e.id) === empId);
    if (emp) {
      setFormData(prev => ({
        ...prev,
        employee_id: empId,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id || !formData.exit_date) {
      alert("Employee and Exit Date are required.");
      return;
    }
    onSubmit(formData);
  };

  const selectedEmployee = employees.find(e => String(e.id) === formData.employee_id);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">{initialData ? "Edit Exit Record" : "Initiate Exit Process"}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5 grid sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Employee *</span>
            <SearchableSelect
              value={formData.employee_id}
              onChange={handleEmployeeSelect}
              options={employeeOpts}
              placeholder="Select Employee"
              required
            />
          </label>
          
          {selectedEmployee && (
            <>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Department</span>
                <input
                  value={selectedEmployee.department || ""}
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none"
                  readOnly
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Designation</span>
                <input
                  value={selectedEmployee.designation || ""}
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
              required
            />
          </label>
          
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Exit Date *</span>
            <DatePicker
              value={formData.exit_date}
              onChange={v => setFormData({ ...formData, exit_date: v || "" })}
              required
            />
          </label>
          
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Last Working Day</span>
            <DatePicker
              value={formData.last_working_day}
              onChange={v => setFormData({ ...formData, last_working_day: v || "" })}
            />
          </label>
          
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Notice Period Served?</span>
            <select
              value={formData.notice_served.toString()}
              onChange={e => setFormData({ ...formData, notice_served: e.target.value === "true" })}
              className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <div className="sm:col-span-2 bg-muted/20 p-3 rounded-lg border border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department Clearances</span>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {[
                { key: 'clearance_hr', label: 'HR' },
                { key: 'clearance_it', label: 'IT' },
                { key: 'clearance_finance', label: 'Finance' },
                { key: 'clearance_admin', label: 'Admin' },
              ].map(({ key, label }) => (
                <Checkbox
                  key={key}
                  checked={formData[key as keyof typeof formData] as boolean}
                  onChange={v => setFormData({ ...formData, [key]: v })}
                  label={label}
                />
              ))}
            </div>
          </div>

          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Final Settlement Amount</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">PKR</span>
              <input
                type="number"
                value={formData.final_settlement}
                onChange={e => setFormData({ ...formData, final_settlement: Number(e.target.value) })}
                className="bg-muted/40 border border-border rounded-md h-9 pl-10 pr-3 outline-none focus:ring-2 focus:ring-ring w-full"
                placeholder="0.00"
              />
            </div>
          </label>
          
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Notes / Handover Details</span>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring"
              placeholder="Asset return details, final handover notes, etc."
            />
          </label>

          {!initialData && (
            <label className="sm:col-span-2">
              <Checkbox
                checked={formData.update_employee_status}
                onChange={v => setFormData({ ...formData, update_employee_status: v })}
                label="Update employee status"
                description="Automatically update employee status to Resigned/Terminated"
              />
            </label>
          )}
        </div>
        
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
            Cancel
          </button>
          <button type="submit" className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
            {initialData ? "Update Record" : "Save Record"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ==========================================
// CHECKLIST MODAL
// ==========================================
function ChecklistModal({
  record,
  items,
  onUpdateItem,
  onClose,
}: {
  record: ExitRecord;
  items: ExitChecklistItem[];
  onUpdateItem: (itemId: number, status: string) => void;
  onClose: () => void;
}) {
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.item_type]) acc[item.item_type] = [];
    acc[item.item_type].push(item);
    return acc;
  }, {} as Record<string, ExitChecklistItem[]>);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-3xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="font-semibold">Exit Checklist</h2>
            <p className="text-sm text-muted-foreground">{record.employee_name} - {record.department}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          {Object.entries(groupedItems).map(([type, typeItems]) => (
            <div key={type}>
              <h3 className="text-sm font-semibold mb-2 text-primary">{type}</h3>
              <div className="space-y-2">
                {typeItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{item.item_name}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      )}
                      {item.assigned_to_name && (
                        <div className="text-xs mt-1">Assigned to: {item.assigned_to_name}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={item.status}
                        onChange={e => onUpdateItem(item.id, e.target.value)}
                        className="text-xs bg-muted/40 border border-border rounded px-2 py-1"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="WAIVED">Waived</option>
                        <option value="NOT_APPLICABLE">N/A</option>
                      </select>
                      {item.status === "COMPLETED" && (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(groupedItems).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No checklist items yet</div>
          )}
        </div>
        
        <div className="p-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// EXIT INTERVIEW MODAL
// ==========================================
function ExitInterviewModal({
  record,
  interview: existingInterview,
  employees,
  onSubmit,
  onClose,
}: {
  record: ExitRecord;
  interview: ExitInterview | null;
  employees: any[];
  onSubmit: (data: any) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    exit_record_id: record.id,
    interview_date: existingInterview?.interview_date || "",
    interviewed_by: existingInterview?.interviewed_by || "",
    reason_for_leaving: existingInterview?.reason_for_leaving || "",
    feedback_management: existingInterview?.feedback_management || "",
    feedback_work_environment: existingInterview?.feedback_work_environment || "",
    feedback_compensation: existingInterview?.feedback_compensation || "",
    feedback_growth: existingInterview?.feedback_growth || "",
    overall_experience: existingInterview?.overall_experience || 0,
    management_rating: existingInterview?.management_rating || 0,
    work_environment_rating: existingInterview?.work_environment_rating || 0,
    new_employer: existingInterview?.new_employer || "",
    new_position: existingInterview?.new_position || "",
    new_salary_range: existingInterview?.new_salary_range || "",
    willing_to_rejoin: existingInterview?.willing_to_rejoin || false,
    any_concerns: existingInterview?.any_concerns || "",
    general_feedback: existingInterview?.general_feedback || "",
  });

  const interviewerOpts: SearchableSelectOption[] = employees.map(e => ({
    value: String(e.id),
    label: `${e.first_name} ${e.last_name || ""}`
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const RatingInput = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`w-8 h-8 rounded text-sm ${value >= star ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground"}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-3xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="font-semibold">Exit Interview</h2>
            <p className="text-sm text-muted-foreground">{record.employee_name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5 grid sm:grid-cols-2 gap-4">
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Interview Date</span>
            <DatePicker
              value={formData.interview_date}
              onChange={v => setFormData({ ...formData, interview_date: v || "" })}
            />
          </label>
          
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Interviewed By</span>
            <SearchableSelect
              value={String(formData.interviewed_by)}
              onChange={v => setFormData({ ...formData, interviewed_by: v })}
              options={interviewerOpts}
              placeholder="Select interviewer"
            />
          </label>

          <div className="sm:col-span-2 grid grid-cols-3 gap-4">
            <RatingInput
              label="Overall Experience"
              value={formData.overall_experience}
              onChange={v => setFormData({ ...formData, overall_experience: v })}
            />
            <RatingInput
              label="Management Rating"
              value={formData.management_rating}
              onChange={v => setFormData({ ...formData, management_rating: v })}
            />
            <RatingInput
              label="Work Environment"
              value={formData.work_environment_rating}
              onChange={v => setFormData({ ...formData, work_environment_rating: v })}
            />
          </div>

          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Reason for Leaving</span>
            <textarea
              rows={2}
              value={formData.reason_for_leaving}
              onChange={e => setFormData({ ...formData, reason_for_leaving: e.target.value })}
              className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Feedback on Management</span>
            <textarea
              rows={2}
              value={formData.feedback_management}
              onChange={e => setFormData({ ...formData, feedback_management: e.target.value })}
              className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Work Environment Feedback</span>
            <textarea
              rows={2}
              value={formData.feedback_work_environment}
              onChange={e => setFormData({ ...formData, feedback_work_environment: e.target.value })}
              className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Compensation Feedback</span>
            <textarea
              rows={2}
              value={formData.feedback_compensation}
              onChange={e => setFormData({ ...formData, feedback_compensation: e.target.value })}
              className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Growth Opportunities Feedback</span>
            <textarea
              rows={2}
              value={formData.feedback_growth}
              onChange={e => setFormData({ ...formData, feedback_growth: e.target.value })}
              className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">New Employer</span>
            <input
              value={formData.new_employer}
              onChange={e => setFormData({ ...formData, new_employer: e.target.value })}
              className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">New Position</span>
            <input
              value={formData.new_position}
              onChange={e => setFormData({ ...formData, new_position: e.target.value })}
              className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">New Salary Range</span>
            <input
              value={formData.new_salary_range}
              onChange={e => setFormData({ ...formData, new_salary_range: e.target.value })}
              className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g., 100,000 - 150,000"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <Checkbox
              checked={formData.willing_to_rejoin}
              onChange={v => setFormData({ ...formData, willing_to_rejoin: v })}
              label="Willing to Rejoin"
            />
          </label>

          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Any Concerns</span>
            <textarea
              rows={2}
              value={formData.any_concerns}
              onChange={e => setFormData({ ...formData, any_concerns: e.target.value })}
              className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">General Feedback</span>
            <textarea
              rows={3}
              value={formData.general_feedback}
              onChange={e => setFormData({ ...formData, general_feedback: e.target.value })}
              className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring"
              placeholder="Any additional feedback or suggestions..."
            />
          </label>
        </div>
        
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
            Cancel
          </button>
          <button type="submit" className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
            Save Interview
          </button>
        </div>
      </form>
    </div>
  );
}