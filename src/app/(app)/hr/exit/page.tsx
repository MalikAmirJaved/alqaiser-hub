"use client";

import { useState, useEffect, useMemo } from "react";
import { ls, uid } from "@/services/localStorageService";
import { companyContext } from "@/services/companyContextService";
import { permissionService } from "@/services/permissionService";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/cards/StatCard";
import SearchableSelect, { SearchableSelectOption } from "@/components/reuseable/SearchableSelect";
import { DatePicker } from "@/components/reuseable/DatePicker";
import {
  Search, Plus, Filter, Eye, Trash2, Pencil, LogOut, ShieldCheck, 
  Briefcase, Wallet, Clock, ArrowRight, CheckCircle2, AlertTriangle, X
} from "lucide-react";

// ==========================================
// TYPES & INTERFACES
// ==========================================
interface ExitRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  exit_date: string;
  last_working_day: string;
  reason: "Resignation" | "Termination" | "Contract End" | "Retirement" | "Other";
  notice_served: boolean;
  clearance_hr: boolean;
  clearance_it: boolean;
  clearance_finance: boolean;
  clearance_admin: boolean;
  clearance_status: "Pending" | "In Progress" | "Approved" | "Completed";
  final_settlement: number;
  notes: string;
  status: "Active" | "Closed";
  created_at?: string;
  // Context fields (hidden)
  company_id?: string;
  branch_id?: string;
}

const EXIT_REASONS = [
  { value: "Resignation", label: "👋 Resignation" },
  { value: "Termination", label: "❌ Termination" },
  { value: "Contract End", label: "📄 Contract End" },
  { value: "Retirement", label: "👴 Retirement" },
  { value: "Other", label: "📝 Other" },
];

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function ExitManagementPage() {
  const [records, setRecords] = useState<ExitRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExitRecord | null>(null);

  // Initialize
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allRecords = ls.get("exits", []) as ExitRecord[];
    const filtered = companyContext.filterByContext(allRecords);
    setRecords(filtered);

    const allEmployees = ls.get("employees", []);
    const activeEmps = companyContext.filterByContext(allEmployees).filter(
      (e: any) => e.employment_status === "ACTIVE"
    );
    setEmployees(activeEmps);
    setLoading(false);
  };

  // ==========================================
  // STATS COMPUTATION
  // ==========================================
  const stats = useMemo(() => ({
    total: records.length,
    pending: records.filter(r => r.clearance_status === "Pending").length,
    inProgress: records.filter(r => r.clearance_status === "In Progress").length,
    completed: records.filter(r => r.clearance_status === "Completed").length,
    avgSettlement: records.length > 0 
      ? records.reduce((sum, r) => sum + (Number(r.final_settlement) || 0), 0) / records.length 
      : 0,
  }), [records]);

  // ==========================================
  // FILTERING
  // ==========================================
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = query === "" ||
        r.employee_name.toLowerCase().includes(query.toLowerCase()) ||
        r.department.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = filterStatus === "" || r.clearance_status === filterStatus;
      const matchesReason = filterReason === "" || r.reason === filterReason;
      return matchesSearch && matchesStatus && matchesReason;
    });
  }, [records, query, filterStatus, filterReason]);

  // ==========================================
  // ACTIONS
  // ==========================================
  const handleSave = (data: ExitRecord) => {
    let updated: ExitRecord[];
    if (editingRecord) {
      updated = records.map(r => r.id === editingRecord.id ? { ...r, ...data } : r);
    } else {
      const newRecord = companyContext.addContextToRecord({
        id: uid("ex"),
        ...data,
        created_at: new Date().toISOString(),
      });
      updated = [newRecord, ...records];
    }
    ls.set("exits", updated);
    setRecords(updated);
    setModalOpen(false);
    setEditingRecord(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this exit record? This action cannot be undone.")) {
      const updated = records.filter(r => r.id !== id);
      ls.set("exits", updated);
      setRecords(updated);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================
  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"/></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Exit Management"
        subtitle="Track employee offboarding, clearances, and final settlements"
        actions={
          <button onClick={() => { setEditingRecord(null); setModalOpen(true); }} className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> Initiate Exit
          </button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Exits" value={stats.total} icon={LogOut} accent="info" />
        <StatCard label="Pending Clearance" value={stats.pending} icon={AlertTriangle} accent="warning" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Clock} accent="destructive" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} accent="success" />
      </div>

      {/* Filters & Search */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by employee name or department..." className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex gap-2">
            <SearchableSelect value={filterStatus} onChange={v => setFilterStatus(v)} options={[
              { value: "Pending", label: "Pending" },
              { value: "In Progress", label: "In Progress" },
              { value: "Approved", label: "Approved" },
              { value: "Completed", label: "Completed" },
            ]} placeholder="Clearance Status" className="w-40" />
            <SearchableSelect value={filterReason} onChange={v => setFilterReason(v)} options={EXIT_REASONS} placeholder="Exit Reason" className="w-36" />
            <button onClick={loadData} className="px-3 h-9 rounded-md border border-border text-sm hover:bg-muted" title="Refresh">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Employee</th>
                <th className="text-left px-4 py-2.5">Department</th>
                <th className="text-left px-4 py-2.5">Exit / LWD</th>
                <th className="text-left px-4 py-2.5">Reason</th>
                <th className="text-left px-4 py-2.5">Clearance Status</th>
                <th className="text-left px-4 py-2.5">Settlement</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No exit records found.</td></tr>
              ) : filteredRecords.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.employee_name}</div>
                    <div className="text-xs text-muted-foreground">{r.designation || "—"}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{r.department}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-xs">{r.exit_date || "—"}</div>
                    <div className="text-[10px] text-muted-foreground">LWD: {r.last_working_day || "—"}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{r.reason}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                      r.clearance_status === "Completed" ? "bg-success/15 text-success border-success/30" :
                      r.clearance_status === "Approved" ? "bg-info/15 text-info border-info/30" :
                      r.clearance_status === "In Progress" ? "bg-warning/15 text-warning border-warning/30" :
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
                  <td className="px-4 py-2.5 text-xs font-medium">{r.final_settlement ? `${r.final_settlement.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => { setEditingRecord(r); setModalOpen(true); }} className="p-1.5 rounded-md hover:bg-muted"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
          Showing {filteredRecords.length} of {records.length} records
        </div>
      </div>

      {/* Modal Form */}
      {modalOpen && <ExitFormModal employeeOptions={employees} initialData={editingRecord} onSubmit={handleSave} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

// ==========================================
// REUSABLE MODAL FORM COMPONENT
// ==========================================
function ExitFormModal({ initialData, employeeOptions, onSubmit, onClose }: { initialData: ExitRecord | null, employeeOptions: any[], onSubmit: (d: ExitRecord) => void, onClose: () => void }) {
  const [formData, setFormData] = useState<Omit<ExitRecord, "id">>({
    employee_id: "", employee_name: "", department: "", designation: "",
    exit_date: "", last_working_day: "", reason: "Resignation", notice_served: true,
    clearance_hr: false, clearance_it: false, clearance_finance: false, clearance_admin: false,
    clearance_status: "Pending", final_settlement: 0, notes: "", status: "Active",
    ...initialData
  });

  const employeeOpts: SearchableSelectOption[] = employeeOptions.map(e => ({
    value: e.id, label: `${e.first_name} ${e.last_name || ""} (${e.department})`
  }));

  // Auto-update clearance status based on checkboxes
  const updateClearanceStatus = (field: string, value: boolean) => {
    const newData = { ...formData, [field]: value };
    const completed = newData.clearance_hr && newData.clearance_it && newData.clearance_finance && newData.clearance_admin;
    const anyCleared = newData.clearance_hr || newData.clearance_it || newData.clearance_finance || newData.clearance_admin;
    newData.clearance_status = completed ? "Completed" : anyCleared ? "In Progress" : "Pending";
    setFormData(newData);
  };

  const handleEmployeeSelect = (empId: string) => {
    const emp = employeeOptions.find(e => e.id === empId);
    if (emp) {
      setFormData(prev => ({
        ...prev,
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name || ""}`,
        department: emp.department || "",
        designation: emp.designation || ""
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_name || !formData.exit_date) {
      alert("Employee and Exit Date are required.");
      return;
    }
    onSubmit(formData as ExitRecord);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">{initialData ? "Edit Exit Record" : "Initiate Exit Process"}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 grid sm:grid-cols-2 gap-4">
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Employee *</span>
            <SearchableSelect value={formData.employee_id} onChange={handleEmployeeSelect} options={employeeOpts} placeholder="Select Employee" required />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Department</span>
            <input value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" readOnly />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Designation</span>
            <input value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" readOnly />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Exit Reason *</span>
            <SearchableSelect value={formData.reason} onChange={v => setFormData({ ...formData, reason: v as any })} options={EXIT_REASONS} placeholder="Select Reason" required />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Exit Date *</span>
            <DatePicker value={formData.exit_date} onChange={v => setFormData({ ...formData, exit_date: v || "" })} required />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Last Working Day</span>
            <DatePicker value={formData.last_working_day} onChange={v => setFormData({ ...formData, last_working_day: v || "" })} />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Notice Period Served?</span>
            <select value={formData.notice_served.toString()} onChange={e => setFormData({ ...formData, notice_served: e.target.value === "true" })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          
          <div className="sm:col-span-2 bg-muted/20 p-3 rounded-lg border border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department Clearances</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
              {['clearance_hr', 'clearance_it', 'clearance_finance', 'clearance_admin'].map(key => (
                <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={formData[key as keyof ExitRecord] as boolean} onChange={e => updateClearanceStatus(key, e.target.checked)} className="rounded border-border text-primary focus:ring-primary" />
                  <span className="capitalize">{key.replace('clearance_', '')}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">Status auto-updates based on checked clearances.</div>
          </div>

          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Final Settlement Amount</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">PKR</span>
              <input type="number" value={formData.final_settlement} onChange={e => setFormData({ ...formData, final_settlement: Number(e.target.value) })} className="bg-muted/40 border border-border rounded-md h-9 pl-10 pr-3 outline-none focus:ring-2 focus:ring-ring w-full" placeholder="0.00" />
            </div>
          </label>
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Notes / Handover Details</span>
            <textarea rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring" placeholder="Asset return details, final handover notes, etc." />
          </label>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">Cancel</button>
          <button type="submit" className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">Save Record</button>
        </div>
      </form>
    </div>
  );
}