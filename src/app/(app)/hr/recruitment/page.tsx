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
  Search, Plus, Filter, Eye, Trash2, Pencil, UserCheck, CalendarDays,
  Briefcase, Users, ArrowRight, ShieldCheck, X
} from "lucide-react";

// ==========================================
// TYPES & INTERFACES
// ==========================================
interface RecruitmentRecord {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  position: string;
  department: string;
  apply_date: string;
  interview_date?: string;
  assigned_to?: string;
  assigned_name?: string;
  stage: "Applied" | "Screening" | "Interview" | "Offer" | "Hired" | "Rejected";
  status: "Active" | "Closed";
  resume_url?: string;
  notes?: string;
  created_at?: string;
  // Context fields (hidden)
  company_id?: string;
  branch_id?: string;
}

const DEPARTMENTS = [
  { value: "HR", label: "Human Resources" },
  { value: "INVENTORY", label: "Inventory & Operations" },
  { value: "FINANCE", label: "Finance & Accounting" },
];

const STAGES = [
  { value: "Applied", label: "📥 Applied" },
  { value: "Screening", label: "🔍 Screening" },
  { value: "Interview", label: "📅 Interview" },
  { value: "Offer", label: "📜 Offer Sent" },
  { value: "Hired", label: "🤝 Hired" },
  { value: "Rejected", label: "❌ Rejected" },
];

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function RecruitmentPage() {
  const [records, setRecords] = useState<RecruitmentRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecruitmentRecord | null>(null);

  // Initialize
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allRecords = ls.get("recruitment", []) as RecruitmentRecord[];
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
    total: records.filter(r => r.status === "Active").length,
    interviewing: records.filter(r => r.stage === "Interview").length,
    hired: records.filter(r => r.stage === "Hired").length,
    rejected: records.filter(r => r.stage === "Rejected").length,
  }), [records]);

  // ==========================================
  // FILTERING
  // ==========================================
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = query === "" ||
        r.name.toLowerCase().includes(query.toLowerCase()) ||
        r.position.toLowerCase().includes(query.toLowerCase()) ||
        r.email?.toLowerCase().includes(query.toLowerCase());
      const matchesDept = filterDept === "" || r.department === filterDept;
      const matchesStage = filterStage === "" || r.stage === filterStage;
      return matchesSearch && matchesDept && matchesStage;
    });
  }, [records, query, filterDept, filterStage]);

  // ==========================================
  // ACTIONS
  // ==========================================
  const handleSave = (data: RecruitmentRecord) => {
    let updated: RecruitmentRecord[];
    if (editingRecord) {
      updated = records.map(r => r.id === editingRecord.id ? { ...r, ...data } : r);
    } else {
      const newRecord = companyContext.addContextToRecord({
        id: uid("rc"),
        ...data,
        created_at: new Date().toISOString(),
      });
      updated = [newRecord, ...records];
    }
    ls.set("recruitment", updated);
    setRecords(updated);
    setModalOpen(false);
    setEditingRecord(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this candidate record?")) {
      const updated = records.filter(r => r.id !== id);
      ls.set("recruitment", updated);
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
        title="Recruitment Management"
        subtitle="Track applicants, interviews, and hiring pipeline"
        actions={
          <button onClick={() => { setEditingRecord(null); setModalOpen(true); }} className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Candidate
          </button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Applicants" value={stats.total} icon={Users} accent="info" />
        <StatCard label="Interviewing" value={stats.interviewing} icon={CalendarDays} accent="warning" />
        <StatCard label="Hired" value={stats.hired} icon={UserCheck} accent="success" />
        <StatCard label="Rejected" value={stats.rejected} icon={X} accent="destructive" />
      </div>

      {/* Filters & Search */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search candidates, positions, emails..." className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex gap-2">
            <SearchableSelect value={filterDept} onChange={v => setFilterDept(v)} options={DEPARTMENTS} placeholder="Department" className="w-44" />
            <SearchableSelect value={filterStage} onChange={v => setFilterStage(v)} options={STAGES} placeholder="Stage" className="w-36" />
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
                <th className="text-left px-4 py-2.5">Candidate</th>
                <th className="text-left px-4 py-2.5">Position / Dept</th>
                <th className="text-left px-4 py-2.5">Applied</th>
                <th className="text-left px-4 py-2.5">Interview</th>
                <th className="text-left px-4 py-2.5">Assigned To</th>
                <th className="text-left px-4 py-2.5">Stage</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No candidates found.</td></tr>
              ) : filteredRecords.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.email || "—"} · {r.phone || "—"}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.position}</div>
                    <div className="text-xs text-muted-foreground">{r.department}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{r.apply_date || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{r.interview_date || "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center font-bold">{(r.assigned_name || "?")[0]}</div>
                      <span className="truncate max-w-[100px]">{r.assigned_name || "Unassigned"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                      r.stage === "Hired" ? "bg-success/15 text-success border-success/30" :
                      r.stage === "Rejected" ? "bg-destructive/15 text-destructive border-destructive/30" :
                      r.stage === "Interview" ? "bg-warning/15 text-warning border-warning/30" :
                      "bg-muted text-muted-foreground border-border"
                    }`}>
                      {r.stage}
                    </span>
                  </td>
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
      {modalOpen && <CandidateFormModal employeeOptions={employees} initialData={editingRecord} onSubmit={handleSave} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

// ==========================================
// REUSABLE MODAL FORM COMPONENT
// ==========================================
function CandidateFormModal({ initialData, employeeOptions, onSubmit, onClose }: { initialData: RecruitmentRecord | null, employeeOptions: any[], onSubmit: (d: RecruitmentRecord) => void, onClose: () => void }) {
  const [formData, setFormData] = useState<Omit<RecruitmentRecord, "id">>({
    name: "", position: "", department: "", stage: "Applied", status: "Active", apply_date: new Date().toISOString().split("T")[0],
    ...initialData
  });
  const [assignedId, setAssignedId] = useState(initialData?.assigned_to || "");

  const employeeOpts: SearchableSelectOption[] = employeeOptions.map(e => ({
    value: e.id, label: `${e.first_name} ${e.last_name || ""} (${e.department})`
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assigned = employeeOptions.find(emp => emp.id === assignedId);
    onSubmit({ ...formData, assigned_to: assignedId, assigned_name: assigned ? `${assigned.first_name} ${assigned.last_name}` : undefined } as RecruitmentRecord);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">{initialData ? "Edit Candidate" : "Add New Candidate"}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 grid sm:grid-cols-2 gap-4">
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Candidate Name *</span>
            <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Email</span>
            <input type="email" value={formData.email || ""} onChange={e => setFormData({ ...formData, email: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Phone</span>
            <input type="tel" value={formData.phone || ""} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Position *</span>
            <input required value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Department</span>
            <SearchableSelect value={formData.department} onChange={v => setFormData({ ...formData, department: v })} options={DEPARTMENTS} placeholder="Select Department" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Stage</span>
            <SearchableSelect value={formData.stage} onChange={v => setFormData({ ...formData, stage: v as any })} options={STAGES} placeholder="Stage" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Applied Date</span>
            <DatePicker value={formData.apply_date} onChange={v => setFormData({ ...formData, apply_date: v || "" })} />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Interview Date</span>
            <DatePicker value={formData.interview_date} onChange={v => setFormData({ ...formData, interview_date: v || "" })} />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Assigned Employee</span>
            <SearchableSelect value={assignedId} onChange={setAssignedId} options={employeeOpts} placeholder="Assign to..." />
          </label>
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Resume / Portfolio URL</span>
            <input value={formData.resume_url || ""} onChange={e => setFormData({ ...formData, resume_url: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground">Notes</span>
            <textarea rows={3} value={formData.notes || ""} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring" />
          </label>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">Cancel</button>
          <button type="submit" className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">Save Candidate</button>
        </div>
      </form>
    </div>
  );
}