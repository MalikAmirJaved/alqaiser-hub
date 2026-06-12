// src/app/recruitment/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/cards/StatCard";
import SearchableSelect, { SearchableSelectOption } from "@/components/reuseable/SearchableSelect";
import { DatePicker } from "@/components/reuseable/DatePicker";
import {
  Search, Plus, Filter, Eye, Trash2, Pencil, UserCheck, CalendarDays,
  Users, ArrowRight, ShieldCheck, X, Loader2, Briefcase, FileText, Award
} from "lucide-react";
import { useRecruitment, useRecruitmentStats, useCreateRecruitmentCandidate, useUpdateRecruitmentCandidate, useDeleteRecruitmentCandidate } from "@/hooks/useRecruitment";
import { useEmployees } from "@/hooks/useEmployees";
import { toast } from "sonner";

// ==========================================
// TYPES & INTERFACES
// ==========================================
interface RecruitmentRecord {
  id: number;
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  position: string;
  department: string;
  apply_date: string;
  interview_date?: string;
  assigned_to_id?: number;
  assigned_to_name?: string;
  assigned_name?: string;
  stage: "Applied" | "Screening" | "Interview" | "Offer" | "Hired" | "Rejected";
  status: "Active" | "Closed";
  resume_url?: string;
  notes?: string;
  source?: string;
  expected_salary?: number;
  current_company?: string;
  current_position?: string;
  years_of_experience?: number;
  notice_period_days?: number;
  interview_round: number;
  interview_notes?: string;
  interviewers?: string;
  offer_sent_date?: string;
  offer_accepted_date?: string;
  offer_amount?: number;
  joining_date?: string;
  rejection_reason?: string;
  rejection_date?: string;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  updated_by_name?: string;
}

const DEPARTMENTS = [
  { value: "HR", label: "Human Resources" },
  { value: "INVENTORY", label: "Inventory & Operations" },
  { value: "FINANCE", label: "Finance & Accounting" },
  { value: "MONITORING", label: "Monitoring" },
];

const STAGES = [
  { value: "Applied", label: "📥 Applied" },
  { value: "Screening", label: "🔍 Screening" },
  { value: "Interview", label: "📅 Interview" },
  { value: "Offer", label: "📜 Offer Sent" },
  { value: "Hired", label: "🤝 Hired" },
  { value: "Rejected", label: "❌ Rejected" },
];

const SOURCES = [
  { value: "WEBSITE", label: "Company Website" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "INDEED", label: "Indeed" },
  { value: "REFERRAL", label: "Employee Referral" },
  { value: "AGENCY", label: "Recruitment Agency" },
  { value: "WALKIN", label: "Walk-in" },
  { value: "OTHER", label: "Other" },
];

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function RecruitmentPage() {
  const [query, setQuery] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecruitmentRecord | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Fetch data from API
  const { data: recruitmentData, isLoading: loading, refetch } = useRecruitment({
    search: query || undefined,
    department: filterDept || undefined,
    stage: filterStage || undefined,
    page,
    page_size: pageSize,
  });

  const { data: statsData, isLoading: statsLoading } = useRecruitmentStats();
  const { data: employeesData } = useEmployees({ status: "ACTIVE" });

  const createMutation = useCreateRecruitmentCandidate();
  const updateMutation = useUpdateRecruitmentCandidate();
  const deleteMutation = useDeleteRecruitmentCandidate();

  const records = recruitmentData?.data || [];
  const totalRecords = recruitmentData?.pagination?.total || 0;
  const employees = employeesData || [];

  // ==========================================
  // STATS COMPUTATION
  // ==========================================
  const stats = useMemo(() => ({
    total: statsData?.total_applicants || 0,
    screening: statsData?.screening || 0,
    interviewing: statsData?.interviewing || 0,
    hired: statsData?.hired || 0,
    rejected: statsData?.rejected || 0,
  }), [statsData]);

  // ==========================================
  // ACTIONS
  // ==========================================
  const handleSave = async (data: Partial<RecruitmentRecord>) => {
    try {
      if (editingRecord) {
        await updateMutation.mutateAsync({ id: editingRecord.id, ...data });
        toast.success("Candidate updated successfully");
      } else {
        await createMutation.mutateAsync(data as any);
        toast.success("Candidate added successfully");
      }
      setModalOpen(false);
      setEditingRecord(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to save candidate");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this candidate record?")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast.success("Candidate deleted successfully");
        refetch();
      } catch (error: any) {
        toast.error(error.message || "Failed to delete candidate");
      }
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "Hired":
        return "bg-green-500/15 text-green-600 border-green-500/30";
      case "Rejected":
        return "bg-red-500/15 text-red-600 border-red-500/30";
      case "Interview":
        return "bg-yellow-500/15 text-yellow-600 border-yellow-500/30";
      case "Offer":
        return "bg-purple-500/15 text-purple-600 border-purple-500/30";
      case "Screening":
        return "bg-blue-500/15 text-blue-600 border-blue-500/30";
      default:
        return "bg-gray-500/15 text-gray-600 border-gray-500/30";
    }
  };

  // ==========================================
  // RENDER
  // ==========================================
  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"/>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recruitment Management"
        subtitle="Track applicants, interviews, and hiring pipeline"
        actions={
          <button 
            onClick={() => { setEditingRecord(null); setModalOpen(true); }} 
            className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Candidate
          </button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard 
          label="Total Applicants" 
          value={stats.total} 
          icon={Users} 
          accent="info" 
          loading={statsLoading}
        />
        <StatCard 
          label="Screening" 
          value={stats.screening} 
          icon={FileText} 
          accent="info" 
          loading={statsLoading}
        />
        <StatCard 
          label="Interviewing" 
          value={stats.interviewing} 
          icon={CalendarDays} 
          accent="warning" 
          loading={statsLoading}
        />
        <StatCard 
          label="Hired" 
          value={stats.hired} 
          icon={UserCheck} 
          accent="success" 
          loading={statsLoading}
        />
        <StatCard 
          label="Rejected" 
          value={stats.rejected} 
          icon={X} 
          accent="destructive" 
          loading={statsLoading}
        />
      </div>

      {/* Filters & Search */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={query} 
              onChange={e => { setQuery(e.target.value); setPage(1); }} 
              placeholder="Search candidates by name, email, position, company..." 
              className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <SearchableSelect 
              value={filterDept} 
              onChange={v => { setFilterDept(v); setPage(1); }} 
              options={DEPARTMENTS} 
              placeholder="Department" 
              className="w-44" 
              clearable
            />
            <SearchableSelect 
              value={filterStage} 
              onChange={v => { setFilterStage(v); setPage(1); }} 
              options={STAGES} 
              placeholder="Stage" 
              className="w-36" 
              clearable
            />
            <button 
              onClick={() => { 
                setQuery("");
                setFilterDept("");
                setFilterStage("");
                setPage(1);
                refetch();
              }} 
              className="px-3 h-9 rounded-md border border-border text-sm hover:bg-muted transition-all"
              title="Reset Filters"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-4 py-3">Candidate</th>
                <th className="text-left px-4 py-3">Position / Dept</th>
                <th className="text-left px-4 py-3">Experience</th>
                <th className="text-left px-4 py-3">Applied</th>
                <th className="text-left px-4 py-3">Interview</th>
                <th className="text-left px-4 py-3">Assigned To</th>
                <th className="text-left px-4 py-3">Stage</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-12 h-12 opacity-20" />
                      <p>No candidates found</p>
                      <button 
                        onClick={() => setModalOpen(true)} 
                        className="text-primary text-sm hover:underline"
                      >
                        Add your first candidate
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {r.email || "—"} · {r.phone || "—"}
                      </div>
                      {r.current_company && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {r.current_company} {r.current_position && `· ${r.current_position}`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.position}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{r.department}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.years_of_experience ? `${r.years_of_experience} years` : "—"}
                      {r.notice_period_days && (
                        <div className="text-xs text-muted-foreground">
                          Notice: {r.notice_period_days} days
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.apply_date ? new Date(r.apply_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.interview_date ? new Date(r.interview_date).toLocaleDateString() : "—"}
                      {r.interview_round > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Round {r.interview_round}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center font-bold text-xs">
                          {(r.assigned_name || r.assigned_to_name || "?")[0].toUpperCase()}
                        </div>
                        <span className="truncate max-w-[120px]">
                          {r.assigned_name || r.assigned_to_name || "Unassigned"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border font-medium ${getStageColor(r.stage)}`}>
                        {r.stage}
                      </span>
                      {r.stage === "Offer" && r.offer_amount && (
                        <div className="text-xs text-muted-foreground mt-1">
                          ${r.offer_amount.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button 
                        onClick={() => { setEditingRecord(r); setModalOpen(true); }} 
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(r.id)} 
                        className="p-1.5 rounded-md hover:bg-red-500/15 text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalRecords > 0 && (
          <div className="p-3 border-t border-border flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              Showing {records.length} of {totalRecords} records
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="px-3 py-1 rounded-md bg-primary/10 text-primary">
                Page {page} of {Math.ceil(totalRecords / pageSize)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(totalRecords / pageSize)}
                className="px-3 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {modalOpen && (
        <CandidateFormModal 
          employeeOptions={employees} 
          initialData={editingRecord} 
          onSubmit={handleSave} 
          onClose={() => {
            setModalOpen(false);
            setEditingRecord(null);
          }} 
        />
      )}
    </div>
  );
}

// ==========================================
// REUSABLE MODAL FORM COMPONENT
// ==========================================
function CandidateFormModal({ 
  initialData, 
  employeeOptions, 
  onSubmit, 
  onClose 
}: { 
  initialData: RecruitmentRecord | null; 
  employeeOptions: any[]; 
  onSubmit: (d: Partial<RecruitmentRecord>) => void; 
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<Partial<RecruitmentRecord>>({
    name: "", 
    position: "", 
    department: "", 
    stage: "Applied", 
    status: "Active", 
    apply_date: new Date().toISOString().split("T")[0],
    interview_round: 0,
    ...initialData
  });
  const [assignedId, setAssignedId] = useState(initialData?.assigned_to_id?.toString() || "");
  const [loading, setLoading] = useState(false);

  const employeeOpts: SearchableSelectOption[] = employeeOptions.map(e => ({
    value: e.id.toString(), 
    label: `${e.first_name} ${e.last_name || ""} (${e.department})`
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const assigned = employeeOptions.find(emp => emp.id.toString() === assignedId);
    const submitData = {
      ...formData,
      assigned_to_id: assignedId ? parseInt(assignedId) : undefined,
      assigned_name: assigned ? `${assigned.first_name} ${assigned.last_name}` : undefined,
    };
    
    await onSubmit(submitData);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto" >
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border flex items-center justify-between p-4 z-10">
          <h2 className="font-semibold text-lg">
            {initialData ? "Edit Candidate" : "Add New Candidate"}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5">
          {/* Basic Information Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Basic Information
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Candidate Name *</span>
                <input 
                  required 
                  value={formData.name || ""} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Email</span>
                <input 
                  type="email" 
                  value={formData.email || ""} 
                  onChange={e => setFormData({ ...formData, email: e.target.value })} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Phone</span>
                <input 
                  type="tel" 
                  value={formData.phone || ""} 
                  onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Source</span>
                <SearchableSelect 
                  value={formData.source || ""} 
                  onChange={v => setFormData({ ...formData, source: v })} 
                  options={SOURCES} 
                  placeholder="Select Source" 
                  clearable
                />
              </label>
            </div>
          </div>

          {/* Position & Experience Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> Position & Experience
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Position *</span>
                <input 
                  required 
                  value={formData.position || ""} 
                  onChange={e => setFormData({ ...formData, position: e.target.value })} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Department *</span>
                <SearchableSelect 
                  value={formData.department || ""} 
                  onChange={v => setFormData({ ...formData, department: v })} 
                  options={DEPARTMENTS} 
                  placeholder="Select Department" 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Current Company</span>
                <input 
                  value={formData.current_company || ""} 
                  onChange={e => setFormData({ ...formData, current_company: e.target.value })} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Current Position</span>
                <input 
                  value={formData.current_position || ""} 
                  onChange={e => setFormData({ ...formData, current_position: e.target.value })} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Years of Experience</span>
                <input 
                  type="number" 
                  step="0.5"
                  value={formData.years_of_experience || ""} 
                  onChange={e => setFormData({ ...formData, years_of_experience: e.target.value ? parseFloat(e.target.value) : undefined })} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Notice Period (days)</span>
                <input 
                  type="number" 
                  value={formData.notice_period_days || ""} 
                  onChange={e => setFormData({ ...formData, notice_period_days: e.target.value ? parseInt(e.target.value) : undefined })} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Expected Salary</span>
                <input 
                  type="number" 
                  step="1000"
                  value={formData.expected_salary || ""} 
                  onChange={e => setFormData({ ...formData, expected_salary: e.target.value ? parseFloat(e.target.value) : undefined })} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                />
              </label>
            </div>
          </div>

          {/* Recruitment Process Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Recruitment Process
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Stage *</span>
                <SearchableSelect 
                  value={formData.stage || "Applied"} 
                  onChange={v => setFormData({ ...formData, stage: v as any })} 
                  options={STAGES} 
                  placeholder="Stage" 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Applied Date *</span>
                <DatePicker 
                  value={formData.apply_date || ""} 
                  onChange={v => setFormData({ ...formData, apply_date: v || "" })} 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Interview Date</span>
                <DatePicker 
                  value={formData.interview_date} 
                  onChange={v => setFormData({ ...formData, interview_date: v || undefined })} 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Interview Round</span>
                <input 
                  type="number" 
                  min="0"
                  value={formData.interview_round || 0} 
                  onChange={e => setFormData({ ...formData, interview_round: parseInt(e.target.value) || 0 })} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                />
              </label>
              <label className="text-sm flex flex-col gap-1 sm:col-span-2">
                <span className="text-muted-foreground">Interview Notes</span>
                <textarea 
                  rows={2} 
                  value={formData.interview_notes || ""} 
                  onChange={e => setFormData({ ...formData, interview_notes: e.target.value })} 
                  className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                />
              </label>
            </div>
          </div>

          {/* Offer Details Section (shown when stage is Offer or Hired) */}
          {(formData.stage === "Offer" || formData.stage === "Hired") && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Award className="w-4 h-4" /> Offer Details
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Offer Amount</span>
                  <input 
                    type="number" 
                    step="1000"
                    value={formData.offer_amount || ""} 
                    onChange={e => setFormData({ ...formData, offer_amount: e.target.value ? parseFloat(e.target.value) : undefined })} 
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Offer Sent Date</span>
                  <DatePicker 
                    value={formData.offer_sent_date} 
                    onChange={v => setFormData({ ...formData, offer_sent_date: v || undefined })} 
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Offer Accepted Date</span>
                  <DatePicker 
                    value={formData.offer_accepted_date} 
                    onChange={v => setFormData({ ...formData, offer_accepted_date: v || undefined })} 
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Joining Date</span>
                  <DatePicker 
                    value={formData.joining_date} 
                    onChange={v => setFormData({ ...formData, joining_date: v || undefined })} 
                  />
                </label>
              </div>
            </div>
          )}

          {/* Rejection Section (shown when stage is Rejected) */}
          {formData.stage === "Rejected" && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <X className="w-4 h-4" /> Rejection Details
              </h3>
              <div className="grid gap-4">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Rejection Reason *</span>
                  <textarea 
                    rows={2} 
                    required
                    value={formData.rejection_reason || ""} 
                    onChange={e => setFormData({ ...formData, rejection_reason: e.target.value })} 
                    className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Rejection Date</span>
                  <DatePicker 
                    value={formData.rejection_date} 
                    onChange={v => setFormData({ ...formData, rejection_date: v || undefined })} 
                  />
                </label>
              </div>
            </div>
          )}

          {/* Assignment & Notes Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <UserCheck className="w-4 h-4" /> Assignment & Notes
            </h3>
            <div className="grid gap-4">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Assigned Employee</span>
                <SearchableSelect 
                  value={assignedId} 
                  onChange={setAssignedId} 
                  options={employeeOpts} 
                  placeholder="Assign to..." 
                  clearable
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Resume / Portfolio URL</span>
                <input 
                  value={formData.resume_url || ""} 
                  onChange={e => setFormData({ ...formData, resume_url: e.target.value })} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                  placeholder="https://..." 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Notes</span>
                <textarea 
                  rows={3} 
                  value={formData.notes || ""} 
                  onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                  className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring transition-all" 
                  placeholder="Additional notes about the candidate..." 
                />
              </label>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border p-4 flex justify-end gap-2">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted transition-all"
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Saving..." : "Save Candidate"}
          </button>
        </div>
      </form>
    </div>
  );
}