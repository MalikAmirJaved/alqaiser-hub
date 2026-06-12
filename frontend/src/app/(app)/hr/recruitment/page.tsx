// src/app/recruitment/page.tsx
"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/cards/StatCard";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import {
  Search, Plus, Filter, Trash2, Pencil, UserCheck, CalendarDays,
  Users, FileText, Award, X, Loader2, Briefcase, Eye, ChevronRight
} from "lucide-react";
import { useRecruitment, useRecruitmentStats, useCreateRecruitmentCandidate, useUpdateRecruitmentCandidate, useDeleteRecruitmentCandidate } from "@/hooks/useRecruitment";
import { useEmployees } from "@/hooks/useEmployees";
import { toast } from "sonner";
import { RoundBuilder } from "@/components/recruitment/RoundBuilder";
import { RoundStatusModal } from "@/components/recruitment/RoundStatusModal";
import { useInterviewRounds, useBulkCreateRounds, useBulkUpdateRoundStatus } from "@/hooks/useInterviewRounds";

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

interface InterviewRound {
  id: number;
  round_number: number;
  round_title: string;
  interview_type: string;
  status: "PENDING" | "PASSED" | "FAILED" | "SCHEDULED" | "CANCELLED";
  interview_date?: string;
  feedback?: string;
  rating?: number;
  interviewer_name?: string;
  duration_minutes?: number;
  meeting_link?: string;
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
  const [roundsModalOpen, setRoundsModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<RecruitmentRecord | null>(null);
  const [existingRounds, setExistingRounds] = useState<InterviewRound[]>([]);
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
  
  // Only enable the rounds query when modal is open and candidate is selected
  const { data: roundsData, refetch: refetchRounds, isFetching: roundsLoading } = useInterviewRounds(
    roundsModalOpen && selectedCandidate?.id ? selectedCandidate.id : undefined
  );
  
  const createRoundsMutation = useBulkCreateRounds();
  const updateRoundsMutation = useBulkUpdateRoundStatus();

  const createMutation = useCreateRecruitmentCandidate();
  const updateMutation = useUpdateRecruitmentCandidate();
  const deleteMutation = useDeleteRecruitmentCandidate();

  const records = recruitmentData?.data || [];
  const totalRecords = recruitmentData?.pagination?.total || 0;
  const employees = employeesData || [];

  // Update existing rounds when data loads
  useState(() => {
    if (roundsData && roundsModalOpen) {
      setExistingRounds(roundsData);
    }
  });

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
  const handleSave = async (data: Partial<RecruitmentRecord>, rounds?: any[]) => {
    try {
      let savedCandidate;
      if (editingRecord) {
        await updateMutation.mutateAsync({ id: editingRecord.id, ...data });
        savedCandidate = editingRecord;
        toast.success("Candidate updated successfully");
      } else {
        const result = await createMutation.mutateAsync(data as any);
        savedCandidate = result;
        toast.success("Candidate added successfully");
      }

      // If rounds are provided, create them
      if (rounds && rounds.length > 0 && savedCandidate?.id) {
        await createRoundsMutation.mutateAsync({
          candidateId: savedCandidate.id,
          rounds: rounds.map(r => ({
            round_title: r.round_title,
            interview_type: r.interview_type,
            interviewer_id: r.interviewer_id,
            duration_minutes: r.duration_minutes,
            notes: r.notes
          }))
        });
        toast.success(`${rounds.length} interview rounds created`);
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

  const handleViewRounds = async (candidate: RecruitmentRecord) => {
    setSelectedCandidate(candidate);
    setRoundsModalOpen(true);
    // The query will automatically fetch when selectedCandidate is set
    // because the enabled condition will become true
    setTimeout(() => {
      if (roundsData) {
        setExistingRounds(roundsData);
      }
    }, 100);
  };

  const handleCloseRoundsModal = () => {
    setRoundsModalOpen(false);
    setSelectedCandidate(null);
    setExistingRounds([]);
  };

  const handleUpdateRounds = async (updates: Array<{ round_id: number; status: string; feedback?: string; rating?: number; interview_date?: string }>) => {
    if (!selectedCandidate) return;
    
    try {
      await updateRoundsMutation.mutateAsync({
        candidateId: selectedCandidate.id,
        updates
      });
      toast.success("Round statuses updated successfully");
      await refetchRounds();
      refetch(); // Refresh main list
    } catch (error: any) {
      toast.error(error.message || "Failed to update rounds");
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
        subtitle="Track applicants, interviews, and hiring pipeline with round-based interviews"
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
        <StatCard label="Total Applicants" value={stats.total} icon={Users} accent="info" loading={statsLoading} />
        <StatCard label="Screening" value={stats.screening} icon={FileText} accent="info" loading={statsLoading} />
        <StatCard label="Interviewing" value={stats.interviewing} icon={CalendarDays} accent="warning" loading={statsLoading} />
        <StatCard label="Hired" value={stats.hired} icon={UserCheck} accent="success" loading={statsLoading} />
        <StatCard label="Rejected" value={stats.rejected} icon={X} accent="destructive" loading={statsLoading} />
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
                <th className="text-left px-4 py-3">Rounds</th>
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
                      <button onClick={() => setModalOpen(true)} className="text-primary text-sm hover:underline">
                        Add your first candidate
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30 transition-colors group">
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
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.apply_date ? new Date(r.apply_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewRounds(r)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        View Rounds
                      </button>
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

      {/* Rounds Status Modal */}
      {roundsModalOpen && selectedCandidate && (
        <RoundStatusModal
          rounds={existingRounds.length > 0 ? existingRounds : (roundsData || [])}
          candidateName={selectedCandidate.name}
          onClose={handleCloseRoundsModal}
          onUpdate={handleUpdateRounds}
        />
      )}
    </div>
  );
}

// ==========================================
// CANDIDATE FORM MODAL WITH ROUND BUILDER
// ==========================================
function CandidateFormModal({ 
  initialData, 
  employeeOptions, 
  onSubmit, 
  onClose 
}: { 
  initialData: RecruitmentRecord | null; 
  employeeOptions: any[]; 
  onSubmit: (d: Partial<RecruitmentRecord>, rounds?: any[]) => void; 
  onClose: () => void;
}) {
  const [step, setStep] = useState<"basic" | "rounds">("basic");
  const [formData, setFormData] = useState<Partial<RecruitmentRecord>>({
    name: "", 
    position: "", 
    department: "", 
    stage: "Applied", 
    status: "Active", 
    apply_date: new Date().toISOString().split("T")[0],
    ...initialData
  });
  const [rounds, setRounds] = useState<any[]>([]);
  const [assignedId, setAssignedId] = useState(initialData?.assigned_to_id?.toString() || "");
  const [loading, setLoading] = useState(false);

  const employeeOpts = employeeOptions.map(e => ({
    value: e.id.toString(), 
    label: `${e.first_name} ${e.last_name || ""} (${e.department})`
  }));

  const handleNext = () => {
    // Validate basic info
    if (!formData.name || !formData.position || !formData.department) {
      toast.error("Please fill in all required fields");
      return;
    }
    setStep("rounds");
  };

  const handleBack = () => {
    setStep("basic");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const assigned = employeeOptions.find(emp => emp.id.toString() === assignedId);
    const submitData = {
      ...formData,
      assigned_to_id: assignedId ? parseInt(assignedId) : undefined,
      assigned_name: assigned ? `${assigned.first_name} ${assigned.last_name}` : undefined,
    };
    
    // Only include rounds if we're creating a new candidate
    const roundsToSubmit = !initialData && rounds.length > 0 ? rounds : undefined;
    
    await onSubmit(submitData, roundsToSubmit);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border flex items-center justify-between p-4 z-10">
          <div>
            <h2 className="font-semibold text-lg">
              {initialData ? "Edit Candidate" : "Add New Candidate"}
            </h2>
            {!initialData && (
              <div className="flex items-center gap-2 mt-1">
                <div className={`text-xs px-2 py-0.5 rounded-full ${step === "basic" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  Step 1: Basic Info
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <div className={`text-xs px-2 py-0.5 rounded-full ${step === "rounds" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  Step 2: Interview Rounds
                </div>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5">
          {step === "basic" ? (
            // Basic Information Form
            <div className="space-y-6">
              {/* Basic Information Section */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Basic Information
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground">Candidate Name *</span>
                    <input required value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
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
                    <span className="text-muted-foreground">Source</span>
                    <SearchableSelect value={formData.source || ""} onChange={v => setFormData({ ...formData, source: v })} options={SOURCES} placeholder="Select Source" />
                  </label>
                </div>
              </div>

              {/* Position & Experience Section */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Position & Experience
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground">Position *</span>
                    <input required value={formData.position || ""} onChange={e => setFormData({ ...formData, position: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
                  </label>
                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground">Department *</span>
                    <SearchableSelect value={formData.department || ""} onChange={v => setFormData({ ...formData, department: v })} options={DEPARTMENTS} placeholder="Select Department" />
                  </label>
                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground">Current Company</span>
                    <input value={formData.current_company || ""} onChange={e => setFormData({ ...formData, current_company: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
                  </label>
                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground">Current Position</span>
                    <input value={formData.current_position || ""} onChange={e => setFormData({ ...formData, current_position: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
                  </label>
                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground">Years of Experience</span>
                    <input type="number" step="0.5" value={formData.years_of_experience || ""} onChange={e => setFormData({ ...formData, years_of_experience: e.target.value ? parseFloat(e.target.value) : undefined })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
                  </label>
                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground">Notice Period (days)</span>
                    <input type="number" value={formData.notice_period_days || ""} onChange={e => setFormData({ ...formData, notice_period_days: e.target.value ? parseInt(e.target.value) : undefined })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
                  </label>
                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground">Expected Salary</span>
                    <input type="number" step="1000" value={formData.expected_salary || ""} onChange={e => setFormData({ ...formData, expected_salary: e.target.value ? parseFloat(e.target.value) : undefined })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" />
                  </label>
                </div>
              </div>

              {/* Assignment Section */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <UserCheck className="w-4 h-4" /> Assignment
                </h3>
                <div className="grid gap-4">
                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground">Assigned Employee</span>
                    <SearchableSelect value={assignedId} onChange={setAssignedId} options={employeeOpts} placeholder="Assign to..." />
                  </label>
                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground">Resume / Portfolio URL</span>
                    <input value={formData.resume_url || ""} onChange={e => setFormData({ ...formData, resume_url: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" placeholder="https://..." />
                  </label>
                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground">Notes</span>
                    <textarea rows={3} value={formData.notes || ""} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring" placeholder="Additional notes about the candidate..." />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            // Interview Rounds Builder
            <div>
              <RoundBuilder
                value={rounds}
                onChange={setRounds}
                employees={employeeOptions}
              />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border p-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted transition-all" disabled={loading}>
            Cancel
          </button>
          {step === "basic" && !initialData && (
            <button type="button" onClick={handleNext} className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-all flex items-center gap-2">
              Next: Setup Rounds <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {step === "rounds" && !initialData && (
            <>
              <button type="button" onClick={handleBack} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted transition-all">
                Back
              </button>
              <button type="submit" className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Creating..." : "Create Candidate with Rounds"}
              </button>
            </>
          )}
          {initialData && (
            <button type="submit" className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Saving..." : "Update Candidate"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}