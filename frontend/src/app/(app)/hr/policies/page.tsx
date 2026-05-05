"use client";

import { useState, useEffect, useMemo } from "react";
import { ls, uid } from "@/services/localStorageService";
import { companyContext } from "@/services/companyContextService";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/cards/StatCard";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { DatePicker } from "@/components/reuseable/DatePicker";
import {
  Search, Plus, Filter, Pencil, Trash2, FileText, CheckCircle, 
  AlertCircle, Archive, Clock, Eye, X, BookOpen, Users
} from "lucide-react";

// ==========================================
// TYPES & INTERFACES
// ==========================================
interface PolicyRecord {
  id: string;
  code: string;
  title: string;
  category: string;
  department: string;
  employee_type: string;
  version: string;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED" | "REVOKED";
  effective_date: string;
  review_date?: string;
  expiry_date?: string;
  requires_acknowledgment: string;
  acknowledgment_deadline?: string;
  document_url?: string;
  content: string;
  approved_by?: string;
  approval_date?: string;
  change_summary?: string;
  created_at?: string;
  company_id?: string;
  branch_id?: string;
}

const CATEGORIES = [
  "Employment", "Code of Conduct", "Leave & Attendance", "Compensation & Benefits",
  "Health & Safety", "IT & Data Security", "Remote Work", "Performance", "Disciplinary", "Other"
];

const STATUSES = [
  { value: "DRAFT", label: "📝 Draft" },
  { value: "PENDING_REVIEW", label: "👀 Pending Review" },
  { value: "APPROVED", label: "✅ Approved" },
  { value: "PUBLISHED", label: "📢 Published" },
  { value: "ARCHIVED", label: "📦 Archived" },
  { value: "REVOKED", label: "🚫 Revoked" },
];

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function HRPolicyPage() {
  const [records, setRecords] = useState<PolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PolicyRecord | null>(null);

  // Initialize
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allPolicies = ls.get<PolicyRecord[]>("policies", []) || [];
    const filtered = companyContext.filterByContext(allPolicies);
    setRecords(filtered);
    setLoading(false);
  };

  // ==========================================
  // STATS COMPUTATION
  // ==========================================
  const stats = useMemo(() => ({
    total: records.length,
    published: records.filter(r => r.status === "PUBLISHED").length,
    pending: records.filter(r => r.status === "PENDING_REVIEW" || r.status === "APPROVED").length,
    awaitingAck: records.filter(r => r.requires_acknowledgment === "true" && r.status === "PUBLISHED").length,
  }), [records]);

  // ==========================================
  // FILTERING
  // ==========================================
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = query === "" ||
        r.title.toLowerCase().includes(query.toLowerCase()) ||
        r.code.toLowerCase().includes(query.toLowerCase()) ||
        r.content.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = filterCategory === "" || r.category === filterCategory;
      const matchesStatus = filterStatus === "" || r.status === filterStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [records, query, filterCategory, filterStatus]);

  // ==========================================
  // ACTIONS
  // ==========================================
  const handleSave = (data: PolicyRecord) => {
    let updated: PolicyRecord[];
    if (editingRecord) {
      updated = records.map(r => r.id === editingRecord.id ? { ...r, ...data, updated_at: new Date().toISOString() } : r);
    } else {
      const newRecord = companyContext.addContextToRecord({
        ...data,
        id: uid("pol"),
        created_at: new Date().toISOString(),
      });
      updated = [newRecord, ...records];
    }
    ls.set("policies", updated);
    setRecords(updated);
    setModalOpen(false);
    setEditingRecord(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this policy? This cannot be undone.")) {
      const updated = records.filter(r => r.id !== id);
      ls.set("policies", updated);
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
        title="HR Policy Management"
        subtitle="Create, publish, and track policy acknowledgments"
        actions={
          <button onClick={() => { setEditingRecord(null); setModalOpen(true); }} className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> Create Policy
          </button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Policies" value={stats.total} icon={FileText} accent="primary" />
        <StatCard label="Published" value={stats.published} icon={BookOpen} accent="success" />
        <StatCard label="Pending/Approved" value={stats.pending} icon={Clock} accent="warning" />
        <StatCard label="Awaiting Ack" value={stats.awaitingAck} icon={Users} accent="info" />
      </div>

      {/* Filters & Search */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search policies by title, code, or content..." className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex gap-2">
            <SearchableSelect value={filterCategory} onChange={v => setFilterCategory(v)} options={CATEGORIES.map(c => ({ value: c, label: c }))} placeholder="Category" className="w-40" />
            <SearchableSelect value={filterStatus} onChange={v => setFilterStatus(v)} options={STATUSES} placeholder="Status" className="w-44" />
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
                <th className="text-left px-4 py-2.5">Policy</th>
                <th className="text-left px-4 py-2.5">Category / Audience</th>
                <th className="text-left px-4 py-2.5">Version / Dates</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Ack Required</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No policies found.</td></tr>
              ) : filteredRecords.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.code}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-xs">{r.category}</div>
                    <div className="text-[11px] text-muted-foreground">{r.department} · {r.employee_type}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-xs">v{r.version}</div>
                    <div className="text-[10px] text-muted-foreground">Eff: {r.effective_date || "—"}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                      r.status === "PUBLISHED" ? "bg-success/15 text-success border-success/30" :
                      r.status === "APPROVED" ? "bg-info/15 text-info border-info/30" :
                      r.status === "PENDING_REVIEW" ? "bg-warning/15 text-warning border-warning/30" :
                      r.status === "ARCHIVED" || r.status === "REVOKED" ? "bg-destructive/15 text-destructive border-destructive/30" :
                      "bg-muted text-muted-foreground border-border"
                    }`}>
                      {r.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.requires_acknowledgment === "true" ? (
                      <div className="flex items-center gap-1 text-xs text-warning">
                        <AlertCircle className="w-3 h-3" /> Required
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No</div>
                    )}
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
          Showing {filteredRecords.length} of {records.length} policies
        </div>
      </div>

      {/* Modal Form */}
      {modalOpen && <PolicyFormModal initialData={editingRecord} onSubmit={handleSave} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

// ==========================================
// REUSABLE MODAL FORM COMPONENT
// ==========================================
function PolicyFormModal({ initialData, onSubmit, onClose }: { initialData: PolicyRecord | null, onSubmit: (d: PolicyRecord) => void, onClose: () => void }) {
  const [formData, setFormData] = useState<PolicyRecord>({
    id: "",
    code: `POL-${String(Math.floor(Math.random() * 900) + 100)}`,
    title: "", category: "", department: "ALL", employee_type: "ALL",
    version: "1.0", status: "DRAFT", effective_date: "", review_date: "", expiry_date: "",
    requires_acknowledgment: "false", acknowledgment_deadline: "", document_url: "",
    content: "", approved_by: "", approval_date: "", change_summary: "",
    ...(initialData || {})
  });


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content || !formData.effective_date) {
      alert("Title, Content, and Effective Date are required.");
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold">{initialData ? "Edit Policy" : "Create New Policy"}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        
        <div className="p-5 space-y-6">
          {/* Section 1: Policy Details */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2"><FileText className="w-4 h-4"/> Policy Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Policy Code *</span>
                <input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring font-mono text-xs" />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Version *</span>
                <input value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="text-sm flex flex-col gap-1 sm:col-span-2">
                <span className="text-muted-foreground">Policy Title *</span>
                <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
              </label>
            </div>
          </div>

          {/* Section 2: Audience & Compliance */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2"><Users className="w-4 h-4"/> Audience & Compliance</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Category</span>
                <SearchableSelect value={formData.category} onChange={v => setFormData({...formData, category: v})} options={CATEGORIES.map(c => ({value:c, label:c}))} />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Applicable Department</span>
                <SearchableSelect value={formData.department} onChange={v => setFormData({...formData, department: v})} options={["ALL", "HR", "FINANCE", "INVENTORY", "ENGINEERING", "SALES"].map(d => ({value:d, label:d}))} />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Employee Type</span>
                <SearchableSelect value={formData.employee_type} onChange={v => setFormData({...formData, employee_type: v})} options={["ALL", "FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"].map(e => ({value:e, label:e}))} />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Require Acknowledgment?</span>
                <select value={formData.requires_acknowledgment} onChange={e => setFormData({...formData, requires_acknowledgment: e.target.value})} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
              {formData.requires_acknowledgment === "true" && (
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Ack Deadline (Days)</span>
                  <input type="number" value={formData.acknowledgment_deadline} onChange={e => setFormData({...formData, acknowledgment_deadline: e.target.value})} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" placeholder="e.g., 7" />
                </label>
              )}
            </div>
          </div>

          {/* Section 3: Lifecycle Dates & Status */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2"><Clock className="w-4 h-4"/> Lifecycle & Status</h3>
            <div className="grid sm:grid-cols-4 gap-4">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Effective Date *</span>
                <DatePicker value={formData.effective_date} onChange={v => setFormData({...formData, effective_date: v || ""})} />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Next Review Date</span>
                <DatePicker value={formData.review_date} onChange={v => setFormData({...formData, review_date: v || ""})} />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Expiry Date</span>
                <DatePicker value={formData.expiry_date} onChange={v => setFormData({...formData, expiry_date: v || ""})} />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Status</span>
                <SearchableSelect value={formData.status} onChange={v => setFormData({...formData, status: v as any})} options={STATUSES} />
              </label>
            </div>
          </div>

          {/* Section 4: Content & Documentation */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2"><Archive className="w-4 h-4"/> Content & Documentation</h3>
            <label className="text-sm flex flex-col gap-1 mb-4">
              <span className="text-muted-foreground">Policy Content / Summary *</span>
              <textarea rows={6} value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring resize-y" placeholder="Enter policy details, rules, or guidelines..." />
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Document URL (PDF/Drive)</span>
                <input value={formData.document_url} onChange={e => setFormData({...formData, document_url: e.target.value})} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" placeholder="https://..." />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Change Summary</span>
                <input value={formData.change_summary} onChange={e => setFormData({...formData, change_summary: e.target.value})} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" placeholder="Briefly explain changes in this version" />
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <button type="button" onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">Cancel</button>
          <button type="submit" className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">Save Policy</button>
        </div>
      </form>
    </div>
  );
}