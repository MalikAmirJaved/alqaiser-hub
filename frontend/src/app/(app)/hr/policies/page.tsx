// app/(dashboard)/hr/policies/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { usePolicies, usePolicyStats, useCreatePolicy, useUpdatePolicy, useDeletePolicy, useBulkPolicyAction } from "@/hooks/usePolicies";
import type { PolicyRecord, PolicyFilters, PolicyFormData, BulkActionPayload } from "@/hooks/usePolicies";
import PageHeader from "@/components/PageHeader";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { useServerSearch } from "@/hooks/useServerSearch";
import { ConfirmationModal, useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import {
  Search, Plus, Pencil, Trash2, FileText,
  AlertCircle, X, BookOpen, Users,
  CheckSquare, Square, RotateCcw, ChevronDown, ChevronLeft, ChevronRight
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useAutoCode } from "@/hooks/useAutoCode";
import { useDepartmentOptions } from "@/hooks/useDepartments";

// ==========================================
// CONSTANTS
// ==========================================
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
  const permissions = useFeaturePermissions("HR", "policy");
  const [filters, setFilters] = useState<PolicyFilters>({
    sortBy: "-created_at",
    page: 1,
    pageSize: 50,
  });
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PolicyRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<string>("");
  
  const { confirm, Modal } = useConfirmationModal();
  
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      search: query || undefined,
      category: filterCategory || undefined,
      status: filterStatus || undefined,
    }));
  }, [query, filterCategory, filterStatus]);

  const { 
    data: policiesData, 
    isLoading: policiesLoading, 
    isError: policiesError,
    error: policiesErrorData,
    refetch: refetchPolicies 
  } = usePolicies(filters);
  
  const { 
    data: stats, 
    isLoading: statsLoading 
  } = usePolicyStats();

  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();
  const deletePolicy = useDeletePolicy();
  const bulkActionMutation = useBulkPolicyAction();

  const records = useMemo(() => policiesData?.results || [], [policiesData]);
  const totalCount = policiesData?.count || 0;

  const loading = policiesLoading || statsLoading;

  // ==========================================
  // BULK ACTIONS
  // ==========================================
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(records.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;

    try {
      await bulkActionMutation.mutateAsync({
        action: bulkAction as BulkActionPayload['action'],
        policy_ids: Array.from(selectedIds),
        notes: `Bulk ${bulkAction} action`
      });
      
      setSelectedIds(new Set());
      setBulkActionOpen(false);
    } catch (error: any) {
    }
  };

  // ==========================================
  // CRUD ACTIONS
  // ==========================================
  const handleSave = async (data: PolicyFormData, isEditing: boolean) => {
    try {
      if (isEditing && editingRecord) {
        await updatePolicy.mutateAsync({
          id: editingRecord.id,
          data: data
        });
      } else {
        await createPolicy.mutateAsync(data);
      }
      
      setModalOpen(false);
      setEditingRecord(null);
    } catch (error: any) {
    }
  };

  const handleDelete = async (id: string) => {
    confirm({
      title: "Delete Policy",
      message: "This action cannot be undone. The policy will be archived.",
      type: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          await deletePolicy.mutateAsync(id);
        } catch (error: any) {
        }
      }
    });
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updatePolicy.mutateAsync({
        id: id,
        data: { status: newStatus as any }
      });
    } catch (error: any) {
    }
  };

  // ==========================================
  // RENDER
  // ==========================================
  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="HR Policy Management" subtitle="Create, publish, and manage policies" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <Skeleton className="h-12 m-3 rounded-md" />
          <div className="overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2.5"><Skeleton className="h-3 w-6" /></th>
                  <th className="px-4 py-2.5"><Skeleton className="h-3 w-16" /></th>
                  <th className="px-4 py-2.5"><Skeleton className="h-3 w-20" /></th>
                  <th className="px-4 py-2.5"><Skeleton className="h-3 w-12" /></th>
                  <th className="px-4 py-2.5"><Skeleton className="h-3 w-14" /></th>
                  <th className="px-4 py-2.5 text-right"><Skeleton className="h-3 w-12 ml-auto" /></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, r) => (
                  <tr key={r} className="border-t border-border">
                    <td className="px-4 py-2.5"><Skeleton className="h-4 w-4" /></td>
                    <td className="px-4 py-2.5"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-2.5"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-2.5"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-2.5"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="px-4 py-2.5 text-right"><Skeleton className="h-8 w-16 ml-auto rounded-md" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Skeleton className="h-10 m-3 rounded-md" />
        </div>
      </div>
    );
  }

  if (policiesError) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-destructive">
          <AlertCircle className="w-12 h-12" />
        </div>
        <h3 className="text-lg font-semibold">Failed to load policies</h3>
        <p className="text-sm text-muted-foreground">
          {(policiesErrorData as any)?.message || "An unexpected error occurred"}
        </p>
        <button
          onClick={() => refetchPolicies()}
          className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
        >
          <RotateCcw className="w-4 h-4 inline mr-2" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="HR Policy Management"
        subtitle="Create, publish, and manage policies"
        actions={
          permissions.create && (
            <button 
              onClick={() => { setEditingRecord(null); setModalOpen(true); }} 
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Create Policy
            </button>
          )
        }
      />

      {/* Stats Grid */}
      <StatsCards
        stats={[
          {
            id: "total-policies",
            label: "Total Policies",
            value: stats?.totalPolicies || 0,
          },
          {
            id: "published",
            label: "Published",
            value: stats?.publishedPolicies || 0,
          },
          {
            id: "pending-review",
            label: "Pending Review",
            value:
              (stats?.pendingReview || 0) +
              (stats?.approvedPolicies || 0),
          },
        ]}
      />

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && permissions.update && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedIds.size} policies selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setBulkActionOpen(true)}
              className="px-3 h-8 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
            >
              Bulk Actions
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 h-8 rounded-md border border-border text-sm hover:bg-muted"
            >
              Clear Selection
            </button>
          </div>
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
              placeholder="Search policies by title, code, or content..." 
              className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" 
            />
          </div>
          <div className="flex gap-2">
            <SearchableSelect 
              value={filterCategory} 
              onChange={v => setFilterCategory(v)} 
              options={CATEGORIES.map(c => ({ value: c, label: c }))} 
              placeholder="Category" 
              className="w-40" 
            />
            <SearchableSelect 
              value={filterStatus} 
              onChange={v => setFilterStatus(v)} 
              options={STATUSES} 
              placeholder="Status" 
              className="w-44" 
            />
            <button 
              onClick={() => refetchPolicies()} 
              className="px-3 h-9 rounded-md border border-border text-sm hover:bg-muted" 
              title="Refresh"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 w-10">
                  <button onClick={() => handleSelectAll(selectedIds.size !== records.length)}>
                    {selectedIds.size === records.length && records.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : selectedIds.size > 0 ? (
                      <Square className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="text-left px-4 py-2.5">Policy</th>
                <th className="text-left px-4 py-2.5">Category / Audience</th>
                <th className="text-left px-4 py-2.5">Version</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground">
                    No policies found.
                  </td>
                </tr>
              ) : records.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <button onClick={() => handleSelect(r.id)}>
                      {selectedIds.has(r.id) ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.code}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-xs">{r.category}</div>
                    <div className="text-[11px] text-muted-foreground">{r.department_name || 'All'} · {r.employee_type}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-xs">v{r.version}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    {permissions.update ? (
                      <div className="relative inline-block">
                        <select
                          value={r.status}
                          onChange={e => handleStatusChange(r.id, e.target.value)}
                          disabled={updatePolicy.isPending}
                          className={`appearance-none pr-5 pl-2 py-0.5 text-[11px] rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring ${
                            r.status === "PUBLISHED" ? "bg-success/15 text-success border-success/30" :
                            r.status === "APPROVED" ? "bg-info/15 text-info border-info/30" :
                            r.status === "PENDING_REVIEW" ? "bg-warning/15 text-warning border-warning/30" :
                            r.status === "ARCHIVED" || r.status === "REVOKED" ? "bg-destructive/15 text-destructive border-destructive/30" :
                            "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {STATUSES.map(s => (
                            <option key={s.value} value={s.value}>{s.value.replace("_", " ")}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    ) : (
                      <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                        r.status === "PUBLISHED" ? "bg-success/15 text-success border-success/30" :
                        r.status === "APPROVED" ? "bg-info/15 text-info border-info/30" :
                        r.status === "PENDING_REVIEW" ? "bg-warning/15 text-warning border-warning/30" :
                        r.status === "ARCHIVED" || r.status === "REVOKED" ? "bg-destructive/15 text-destructive border-destructive/30" :
                        "bg-muted text-muted-foreground border-border"
                      }`}>
                        {r.status.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {permissions.update && (
                      <button 
                        onClick={() => { setEditingRecord(r); setModalOpen(true); }} 
                        className="p-1.5 rounded-md hover:bg-muted"
                        title="Edit"
                        disabled={updatePolicy.isPending}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {permissions.delete && (
                      <button 
                        onClick={() => handleDelete(r.id)} 
                        className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive"
                        title="Delete"
                        disabled={deletePolicy.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer with count and pagination */}
        <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {records.length} of {totalCount} policies</span>
          <div className="flex items-center gap-2">
            <span>Page {filters.page ?? 1}</span>
            {policiesData?.previous && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
                disabled={(filters.page ?? 1) <= 1}
                className="p-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {policiesData?.next && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                className="p-1 rounded-md border border-border hover:bg-muted transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Form */}
      {(modalOpen && (editingRecord ? permissions.update : permissions.create)) && (
        <PolicyFormModal 
          initialData={editingRecord} 
          onSubmit={handleSave} 
          onClose={() => setModalOpen(false)} 
          isSaving={createPolicy.isPending || updatePolicy.isPending}
        />
      )}

      {/* Bulk Action Modal */}
      {bulkActionOpen && permissions.update && (
        <BulkActionModal
          selectedCount={selectedIds.size}
          onAction={handleBulkAction}
          onClose={() => setBulkActionOpen(false)}
          bulkAction={bulkAction}
          setBulkAction={setBulkAction}
          isProcessing={bulkActionMutation.isPending}
        />
      )}

      {/* Confirmation Modal */}
      <Modal />
    </div>
  );
}

// ==========================================
// POLICY FORM MODAL
// ==========================================
function PolicyFormModal({ 
  initialData, 
  onSubmit, 
  onClose,
  isSaving = false,
}: { 
  initialData: PolicyRecord | null; 
  onSubmit: (data: PolicyFormData, isEditing: boolean) => void; 
  onClose: () => void;
  isSaving?: boolean;
}) {
  const { generateCode, validateCode } = useAutoCode("policy", "POL");

  const fetchDepartments = useServerSearch("/api/organization/departments/", {
    transformOption: (dept: any) => ({
      value: dept.id,
      label: dept.name,
    }),
  });

  const [codeLoading, setCodeLoading] = useState(false);

  const [formData, setFormData] = useState<PolicyFormData>({
    code: initialData?.code || "",
    title: initialData?.title || "",
    category: initialData?.category || "",
    department: initialData?.department || null,
    employee_type: initialData?.employee_type || "ALL",
    version: initialData?.version || "1.0",
    status: initialData?.status || "DRAFT",
    document_url: initialData?.document_url || "",
    content: initialData?.content || "",
    change_summary: initialData?.change_summary || "",
  });

  const isEditing = !!initialData;

  useEffect(() => {
    if (!isEditing && !formData.code) {
      setCodeLoading(true);
      generateCode()
        .then(code => setFormData(prev => ({ ...prev, code })))
        .catch(() => {})
        .finally(() => setCodeLoading(false));
    }
  }, [isEditing]);

  const handleCodeBlur = async () => {
    if (formData.code) {
      await validateCode(formData.code, initialData?.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) {
      toast.error("Title and Content are required.");
      return;
    }
    
    onSubmit(formData, isEditing);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <form 
        onSubmit={handleSubmit} 
        className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold">{isEditing ? "Edit Policy" : "Create New Policy"}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5 space-y-6">
          {/* Section 1: Policy Details */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4"/> Policy Information
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Policy Code *</span>
                <div className="flex items-center gap-1">
                  <input 
                    value={formData.code} 
                    onChange={e => setFormData({...formData, code: e.target.value})} 
                    onBlur={handleCodeBlur}
                    disabled={isEditing || codeLoading}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring font-mono text-xs flex-1 disabled:opacity-50" 
                  />
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={async () => {
                        setCodeLoading(true);
                        try {
                          const code = await generateCode();
                          setFormData(prev => ({ ...prev, code }));
                        } catch {}
                        setCodeLoading(false);
                      }}
                      disabled={codeLoading}
                      className="p-2 rounded-md border border-border hover:bg-muted"
                      title="Regenerate code"
                    >
                      <RotateCcw className={`w-3 h-3 ${codeLoading ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Version *</span>
                <input 
                  value={formData.version} 
                  onChange={e => setFormData({...formData, version: e.target.value})} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" 
                />
              </label>
              <label className="text-sm flex flex-col gap-1 sm:col-span-2">
                <span className="text-muted-foreground">Policy Title *</span>
                <input 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" 
                />
              </label>
            </div>
          </div>

          {/* Section 2: Audience & Compliance */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
              <Users className="w-4 h-4"/> Audience & Compliance
            </h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Category</span>
                <SearchableSelect 
                  value={formData.category} 
                  onChange={v => setFormData({...formData, category: v})} 
                  options={CATEGORIES.map(c => ({value:c, label:c}))} 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Applicable Department</span>
                <SearchableSelect 
                  value={formData.department || ""} 
                  onChange={v => setFormData({...formData, department: v || null})} 
                  fetchOptions={fetchDepartments}
                  placeholder="Search departments..."
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Employee Type</span>
                <SearchableSelect 
                  value={formData.employee_type} 
                  onChange={v => setFormData({...formData, employee_type: v})} 
                  options={["ALL", "FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"].map(e => ({value:e, label:e}))} 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Status</span>
                <SearchableSelect 
                  value={formData.status} 
                  onChange={v => setFormData({...formData, status: v as any})} 
                  options={STATUSES} 
                />
              </label>
            </div>
          </div>

          {/* Section 3: Content & Documentation */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4"/> Content & Documentation
            </h3>
            <label className="text-sm flex flex-col gap-1 mb-4">
              <span className="text-muted-foreground">Policy Content / Summary *</span>
              <textarea 
                rows={6} 
                value={formData.content} 
                onChange={e => setFormData({...formData, content: e.target.value})} 
                className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring resize-y" 
                placeholder="Enter policy details, rules, or guidelines..." 
              />
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Document URL (PDF/Drive)</span>
                <input 
                  value={formData.document_url} 
                  onChange={e => setFormData({...formData, document_url: e.target.value})} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" 
                  placeholder="https://..." 
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Change Summary</span>
                <input 
                  value={formData.change_summary} 
                  onChange={e => setFormData({...formData, change_summary: e.target.value})} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" 
                  placeholder="Briefly explain changes in this version" 
                />
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <button 
            type="button" 
            onClick={onClose} 
            disabled={isSaving}
            className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isSaving}
            className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isSaving && (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            )}
            {isSaving ? "Saving..." : isEditing ? "Update Policy" : "Create Policy"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ==========================================
// BULK ACTION MODAL
// ==========================================
function BulkActionModal({
  selectedCount,
  onAction,
  onClose,
  bulkAction,
  setBulkAction,
  isProcessing = false,
}: {
  selectedCount: number;
  onAction: () => void;
  onClose: () => void;
  bulkAction: string;
  setBulkAction: (action: string) => void;
  isProcessing?: boolean;
}) {
  const actions = [
    { value: "submit_for_review", label: "Submit for Review", description: "Change status to Pending Review" },
    { value: "approve", label: "Approve", description: "Approve selected policies" },
    { value: "publish", label: "Publish", description: "Make policies visible to employees" },
    { value: "archive", label: "Archive", description: "Archive policies (no longer active)" },
    { value: "delete", label: "Soft Delete", description: "Soft delete selected policies" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Bulk Action</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted" disabled={isProcessing}>
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Select an action for {selectedCount} selected policies:
          </p>
          
          <div className="space-y-2">
            {actions.map(action => (
              <label
                key={action.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  bulkAction === action.value 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:bg-muted/50"
                } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name="bulkAction"
                  value={action.value}
                  checked={bulkAction === action.value}
                  onChange={e => setBulkAction(e.target.value)}
                  disabled={isProcessing}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium">{action.label}</div>
                  <div className="text-xs text-muted-foreground">{action.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button 
            onClick={onClose} 
            disabled={isProcessing}
            className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onAction}
            disabled={!bulkAction || isProcessing}
            className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isProcessing && (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            )}
            {isProcessing ? "Processing..." : "Apply Action"}
          </button>
        </div>
      </div>
    </div>
  );
}
