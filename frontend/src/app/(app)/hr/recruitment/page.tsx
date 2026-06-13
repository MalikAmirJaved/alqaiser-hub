// src/app/recruitment/page.tsx
"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import {
  Search, Plus, Trash2, Pencil, UserCheck,
  Users, FileText, X, Loader2, Briefcase, Eye,
  ChevronRight, ChevronLeft, RotateCcw, Link2,
  Building2, Clock, Banknote, CalendarDays, Phone, Mail
} from "lucide-react";
import {
  useRecruitment,
  useRecruitmentStats,
  useCreateRecruitmentCandidate,
  useUpdateRecruitmentCandidate,
  useDeleteRecruitmentCandidate,
} from "@/hooks/useRecruitment";
import { useActiveEmployees } from "@/hooks/useEmployees";
import { useDepartments } from "@/hooks/useDepartments";
import { toast } from "sonner";
import { RoundBuilder } from "@/components/recruitment/RoundBuilder";
import { RoundStatusModal } from "@/components/recruitment/RoundStatusModal";
import {
  useInterviewRounds,
  useBulkCreateRounds,
  useBulkUpdateRoundStatus,
} from "@/hooks/useInterviewRound";
import { ConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

// ==========================================
// TYPES & CONSTANTS
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
  assigned_to_id?: string;
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
  interview_round?: number;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  updated_by_name?: string;
}

interface InterviewRound {
  id: string;
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

const STAGES = [
  { value: "Applied", label: "Applied" },
  { value: "Screening", label: "Screening" },
  { value: "Interview", label: "Interview" },
  { value: "Offer", label: "Offer Sent" },
  { value: "Hired", label: "Hired" },
  { value: "Rejected", label: "Rejected" },
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

const STAGE_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  Applied:   { bg: "bg-slate-100 dark:bg-slate-800",   text: "text-slate-600 dark:text-slate-300",   dot: "bg-slate-400" },
  Screening: { bg: "bg-blue-50 dark:bg-blue-900/30",   text: "text-blue-700 dark:text-blue-300",    dot: "bg-blue-500" },
  Interview: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300",  dot: "bg-amber-500" },
  Offer:     { bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  Hired:     { bg: "bg-green-50 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300",  dot: "bg-green-500" },
  Rejected:  { bg: "bg-red-50 dark:bg-red-900/30",     text: "text-red-700 dark:text-red-300",      dot: "bg-red-500" },
};

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage] ?? STAGE_CONFIG["Applied"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {stage}
    </span>
  );
}

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["bg-violet-100 text-violet-700", "bg-sky-100 text-sky-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-pink-100 text-pink-700"];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sz = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-semibold shrink-0`}>
      {initials}
    </div>
  );
}

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function RecruitmentPage() {
  const permissions = useFeaturePermissions("HR", "recruitment");
  const [query, setQuery] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecruitmentRecord | null>(null);
  const [roundsModalOpen, setRoundsModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<RecruitmentRecord | null>(null);
  const [existingRounds, setExistingRounds] = useState<InterviewRound[]>([]);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<RecruitmentRecord | null>(null);
  const pageSize = 20;

  const { data: recruitmentData, isLoading: loading, refetch } = useRecruitment({
    search: query || undefined,
    department: filterDept || undefined,
    stage: filterStage || undefined,
    page,
    page_size: pageSize,
  });

  const { data: statsData } = useRecruitmentStats();
  const { data: employeesData } = useActiveEmployees();
  const { data: departments } = useDepartments();
  const departmentOptions = (departments || [])
    .filter(d => d.is_active)
    .map(d => ({ value: d.code, label: d.name }));

  const { data: roundsData, refetch: refetchRounds } = useInterviewRounds(
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
  const totalPages = Math.ceil(totalRecords / pageSize);

  const stats = useMemo(() => [
    { label: "Total Applicants", value: statsData?.total_applicants ?? 0, color: "text-foreground" },
    { label: "Screening",        value: statsData?.screening ?? 0,        color: "text-blue-600" },
    { label: "Interviewing",     value: statsData?.interviewing ?? 0,     color: "text-amber-600" },
    { label: "Hired",            value: statsData?.hired ?? 0,            color: "text-green-600" },
    { label: "Rejected",         value: statsData?.rejected ?? 0,         color: "text-red-600" },
  ], [statsData]);

  const hasActiveFilters = query || filterDept || filterStage;

  // ==========================================
  // ACTIONS
  // ==========================================
  const handleSave = async (data: Partial<RecruitmentRecord>, rounds?: any[]) => {
    try {
      let savedCandidate;
      if (editingRecord) {
        await updateMutation.mutateAsync({ id: editingRecord.id, ...data });
        savedCandidate = editingRecord;
        toast.success("Candidate updated");
      } else {
        const result = await createMutation.mutateAsync(data as any);
        savedCandidate = result;
        toast.success("Candidate added");
      }
      if (rounds && rounds.length > 0 && savedCandidate?.id) {
        await createRoundsMutation.mutateAsync({
          candidateId: savedCandidate.id,
          rounds: rounds.map(r => ({
            round_title: r.round_title,
            interview_type: r.interview_type,
            interviewer_id: r.interviewer_id,
            duration_minutes: r.duration_minutes,
            notes: r.notes,
          })),
        });
        toast.success(`${rounds.length} rounds created`);
      }
      setModalOpen(false);
      setEditingRecord(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Candidate removed");
      setDeleteTarget(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete");
    }
  };

  const handleViewRounds = (candidate: RecruitmentRecord) => {
    setSelectedCandidate(candidate);
    setRoundsModalOpen(true);
  };

  const handleUpdateRounds = async (updates: Array<{ round_id: string; status: string; feedback?: string; rating?: number; interview_date?: string }>) => {
    if (!selectedCandidate) return;
    try {
      await updateRoundsMutation.mutateAsync({ candidateId: selectedCandidate.id, updates });
      toast.success("Rounds updated");
      await refetchRounds();
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to update rounds");
    }
  };

  const clearFilters = () => {
    setQuery("");
    setFilterDept("");
    setFilterStage("");
    setPage(1);
  };

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="space-y-5 p-1">
      <PageHeader
        title="Recruitment"
        subtitle="Manage candidates and hiring pipeline"
        actions={
          permissions.create && (
            <button
              onClick={() => { setEditingRecord(null); setModalOpen(true); }}
              className="inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Add Candidate
            </button>
          )
        }
      />

      {/* Stats Row */}
<StatsCards
  stats={stats.map((s) => ({
    id: s.label,
    label: s.label,
    value: s.value,
    valueClassName: s.color, // keeps your color logic
  }))}
/>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search by name, email, position, company…"
            className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-lg text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <SearchableSelect
            value={filterDept}
            onChange={v => { setFilterDept(v); setPage(1); }}
            options={departmentOptions}
            placeholder="Department"
            className="w-44"
          />
          <SearchableSelect
            value={filterStage}
            onChange={v => { setFilterStage(v); setPage(1); }}
            options={STAGES}
            placeholder="Stage"
            className="w-36"
          />
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Candidate</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Position</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Applied</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Assigned To</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Stage</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Rounds</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 rounded-md bg-muted animate-pulse" style={{ width: `${50 + (j * 13) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                        <Users className="w-6 h-6 opacity-40" />
                      </div>
                      <div>
                        <p className="font-medium">No candidates found</p>
                        <p className="text-sm text-muted-foreground/70 mt-0.5">
                          {hasActiveFilters ? "Try adjusting your filters" : "Add your first candidate to get started"}
                        </p>
                      </div>
                      {!hasActiveFilters && permissions.create && (
                        <button
                          onClick={() => setModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Candidate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                records.map(r => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors group">
                    {/* Candidate */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{r.name}</p>
                          {r.email && (
                            <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                          )}
                          {r.current_company && (
                            <p className="text-xs text-muted-foreground truncate">
                              {r.current_company}{r.current_position ? ` · ${r.current_position}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-sm truncate max-w-[160px]">{r.position}</p>
                      <p className="text-xs text-muted-foreground">{r.department}</p>
                      {r.years_of_experience && (
                        <p className="text-xs text-muted-foreground">{r.years_of_experience}y exp</p>
                      )}
                    </td>

                    {/* Applied */}
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <p className="text-sm text-muted-foreground">
                        {r.apply_date ? new Date(r.apply_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </p>
                      {r.source && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5">{r.source}</p>
                      )}
                    </td>

                    {/* Assigned */}
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      {(r.assigned_name || r.assigned_to_name) ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={r.assigned_name || r.assigned_to_name || "?"} size="sm" />
                          <span className="text-sm truncate max-w-[120px]">
                            {r.assigned_name || r.assigned_to_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">Unassigned</span>
                      )}
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3.5">
                      <StageBadge stage={r.stage} />
                    </td>

                    {/* Rounds */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleViewRounds(r)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted hover:border-primary/40 hover:text-primary transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {r.interview_round != null ? `${r.interview_round} Round${r.interview_round !== 1 ? "s" : ""}` : "Rounds"}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {r.resume_url && (
                          <a
                            href={r.resume_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="View Resume"
                            onClick={e => e.stopPropagation()}
                          >
                            <Link2 className="w-4 h-4" />
                          </a>
                        )}
                        {permissions.update && (
                          <button
                            onClick={() => { setEditingRecord(r); setModalOpen(true); }}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {permissions.delete && (
                          <button
                            onClick={() => setDeleteTarget(r)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalRecords > 0 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm">
            <p className="text-muted-foreground text-xs">
              {records.length} of {totalRecords} candidates
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-xs font-medium">
                {page} / {totalPages || 1}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Candidate Form Modal */}
      {(modalOpen && (editingRecord ? permissions.update : permissions.create)) && (
        <CandidateFormModal
          employeeOptions={employees}
          initialData={editingRecord}
          departmentOptions={departmentOptions}
          onSubmit={handleSave}
          onClose={() => { setModalOpen(false); setEditingRecord(null); }}
        />
      )}

      {/* Rounds Status Modal */}
      {roundsModalOpen && selectedCandidate && (
        <RoundStatusModal
          rounds={existingRounds.length > 0 ? existingRounds : (roundsData || [])}
          candidateName={selectedCandidate.name}
          onClose={() => { setRoundsModalOpen(false); setSelectedCandidate(null); setExistingRounds([]); }}
          onUpdate={permissions.update ? handleUpdateRounds : undefined}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Candidate"
        message={`Are you sure you want to remove ${deleteTarget?.name}? This action cannot be undone.`}
        type="danger"
        confirmText="Remove"
      />
    </div>
  );
}

// ==========================================
// CANDIDATE FORM MODAL
// ==========================================
function CandidateFormModal({
  initialData,
  employeeOptions,
  departmentOptions,
  onSubmit,
  onClose,
}: {
  initialData: RecruitmentRecord | null;
  employeeOptions: any[];
  departmentOptions: { value: string; label: string }[];
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
    ...initialData,
  });
  const [rounds, setRounds] = useState<any[]>([]);
  const [assignedId, setAssignedId] = useState(initialData?.assigned_to_id?.toString() || "");
  const [loading, setLoading] = useState(false);

  const isEditing = !!initialData;

  const employeeOpts = employeeOptions.map(e => ({
    value: e.id.toString(),
    label: `${e.first_name} ${e.last_name || ""} (${e.department_name || "N/A"})`,
  }));

  const update = (field: keyof RecruitmentRecord, value: any) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleNext = () => {
    if (!formData.name || !formData.position || !formData.department) {
      toast.error("Please fill in all required fields");
      return;
    }
    setStep("rounds");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  if (!isEditing && step === "rounds" && rounds.length === 0) {
    toast.error("Please add at least one interview round before creating the candidate.");
    return;
  }

    setLoading(true);
    const assigned = employeeOptions.find(emp => emp.id.toString() === assignedId);
    const submitData = {
      ...formData,
      assigned_to_id: assignedId ? assignedId : undefined,
      assigned_name: assigned ? `${assigned.first_name} ${assigned.last_name}` : undefined,
    };
    const roundsToSubmit = !isEditing && rounds.length > 0 ? rounds : undefined;
    await onSubmit(submitData, roundsToSubmit);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border flex items-center justify-between px-6 py-4 z-10">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="font-semibold text-base">
                {isEditing ? `Edit — ${initialData.name}` : "Add Candidate"}
              </h2>
              {!isEditing && (
                <div className="flex items-center gap-2 mt-1.5">
                  <StepIndicator active={step === "basic"} done={step === "rounds"} label="Basic Info" num={1} />
                  <div className="w-8 h-px bg-border" />
                  <StepIndicator active={step === "rounds"} done={false} label="Interview Rounds" num={2} />
                </div>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {step === "basic" ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <Section icon={<Users className="w-4 h-4" />} title="Personal Info">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Full Name" required>
                    <input required value={formData.name || ""} onChange={e => update("name", e.target.value)} placeholder="John Smith" className={inputCls} />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={formData.email || ""} onChange={e => update("email", e.target.value)} placeholder="john@example.com" className={inputCls} />
                  </Field>
                  <Field label="Phone">
                    <input type="tel" value={formData.phone || ""} onChange={e => update("phone", e.target.value.replace(/[^0-9+]/g, "").slice(0, 15))} maxLength={20} placeholder="+1 234 567 890" className={inputCls} />
                  </Field>
                  <Field label="Source">
                    <SearchableSelect value={formData.source || ""} onChange={v => update("source", v)} options={SOURCES} placeholder="Where did they apply?" />
                  </Field>
                </div>
              </Section>

              {/* Position */}
              <Section icon={<Briefcase className="w-4 h-4" />} title="Position & Experience">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Position" required>
                    <input required value={formData.position || ""} onChange={e => update("position", e.target.value)} placeholder="e.g. Senior Frontend Engineer" className={inputCls} />
                  </Field>
                  <Field label="Department" required>
                    <SearchableSelect value={formData.department || ""} onChange={v => update("department", v)} options={departmentOptions} placeholder="Select department" />
                  </Field>
                  <Field label="Current Company">
                    <input value={formData.current_company || ""} onChange={e => update("current_company", e.target.value)} placeholder="Previous employer" className={inputCls} />
                  </Field>
                  <Field label="Current Position">
                    <input value={formData.current_position || ""} onChange={e => update("current_position", e.target.value)} placeholder="Current role" className={inputCls} />
                  </Field>
                  <Field label="Years of Experience">
                    <input type="number" step="0.5" min="0" value={formData.years_of_experience || ""} onChange={e => update("years_of_experience", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="e.g. 5" className={inputCls} />
                  </Field>
                  <Field label="Notice Period (days)">
                    <input type="number" min="0" value={formData.notice_period_days || ""} onChange={e => update("notice_period_days", e.target.value ? parseInt(e.target.value) : undefined)} placeholder="e.g. 30" className={inputCls} />
                  </Field>
                  <Field label="Expected Salary">
                    <input type="number" step="1000" min="0" value={formData.expected_salary || ""} onChange={e => update("expected_salary", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="e.g. 80000" className={inputCls} />
                  </Field>
                  <Field label="Apply Date">
                    <input type="date" value={formData.apply_date || ""} onChange={e => update("apply_date", e.target.value)} className={inputCls} />
                  </Field>
                </div>
              </Section>

              {/* Stage (for editing) */}
              {isEditing && (
                <Section icon={<FileText className="w-4 h-4" />} title="Pipeline Stage">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Stage">
                      <SearchableSelect value={formData.stage || ""} onChange={v => update("stage", v)} options={STAGES} placeholder="Select stage" />
                    </Field>
                    <Field label="Status">
                      <SearchableSelect
                        value={formData.status || ""}
                        onChange={v => update("status", v)}
                        options={[{ value: "Active", label: "Active" }, { value: "Closed", label: "Closed" }]}
                        placeholder="Select status"
                      />
                    </Field>
                  </div>
                </Section>
              )}

              {/* Assignment */}
              <Section icon={<UserCheck className="w-4 h-4" />} title="Assignment">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Assigned To">
                    <SearchableSelect value={assignedId} onChange={setAssignedId} options={employeeOpts} placeholder="Assign to an employee" />
                  </Field>
                  <Field label="Resume / Portfolio URL">
                    <input type="url" value={formData.resume_url || ""} onChange={e => update("resume_url", e.target.value)} placeholder="https://…" className={inputCls} />
                  </Field>
                </div>
                <Field label="Notes">
                  <textarea
                    rows={3}
                    value={formData.notes || ""}
                    onChange={e => update("notes", e.target.value)}
                    placeholder="Any additional notes about the candidate…"
                    className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </Field>
              </Section>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Configure the interview rounds for this candidate. You can update round statuses later.</p>
              <RoundBuilder value={rounds} onChange={setRounds} employees={employeeOptions} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex items-center justify-between">
          <div>
            {step === "rounds" && !isEditing && (
              <button type="button" onClick={() => setStep("basic")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 h-9 rounded-lg border border-border text-sm hover:bg-muted transition-colors disabled:opacity-50">
              Cancel
            </button>
            {step === "basic" && !isEditing ? (
              <button type="button" onClick={handleNext} className="inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || (!isEditing && step === "rounds" && rounds.length === 0)}
                className="..."
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Candidate"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

// ==========================================
// FORM HELPERS
// ==========================================
const inputCls = "w-full bg-muted/40 border border-border rounded-lg h-9 px-3 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow";

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-3 text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground font-medium">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function StepIndicator({ active, done, label, num }: { active: boolean; done: boolean; label: string; num: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
        active ? "bg-primary text-primary-foreground" :
        done ? "bg-green-500 text-white" :
        "bg-muted text-muted-foreground"
      }`}>
        {num}
      </div>
      <span className={`text-xs ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}