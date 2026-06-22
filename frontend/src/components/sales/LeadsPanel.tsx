"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useLeads, useDeleteLead,
  useContactLead, useScheduleFollowUp, useQualifyLead,
  useConvertLeadToCustomer, useMarkLost,
  Lead,
} from "@/hooks/sales/useLeads";
import { DynamicModulePage, type ModulePermissions, type Kpi } from "@/components/reuseable/final/DynamicModulePage";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { StatusBadge } from "@/components/finance/ui";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { Trash2, Phone, Calendar, ThumbsUp, UserPlus, XCircle, FileText, Loader2 } from "lucide-react";
import LeadFormModal from "./LeadFormModal";
import QuoteFormModal from "./QuoteFormModal";
import { toast } from "sonner";

function FollowUpModal({
  open, lead, onClose, onSuccess,
}: {
  open: boolean;
  lead: Lead | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const scheduleFollowUp = useScheduleFollowUp();
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  if (!open || !lead) return null;

  const handleSubmit = async () => {
    try {
      await scheduleFollowUp.mutateAsync({
        id: lead.id,
        follow_up_date: date || undefined,
        follow_up_notes: notes,
      });
      toast.success("Follow-up scheduled");
      onSuccess();
      onClose();
    } catch { /* toast from apiFetch */ }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Schedule Follow Up</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Follow Up Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g., Customer needs approval from manager" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">Cancel</button>
          <button onClick={handleSubmit} disabled={scheduleFollowUp.isPending}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50">
            {scheduleFollowUp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

function LostReasonModal({
  open, lead, onClose, onSuccess,
}: {
  open: boolean;
  lead: Lead | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const markLost = useMarkLost();
  const [reason, setReason] = useState("");

  if (!open || !lead) return null;

  const handleSubmit = async () => {
    try {
      await markLost.mutateAsync({ id: lead.id, lost_reason: reason });
      toast.success("Lead marked as Lost");
      onSuccess();
      onClose();
    } catch { /* toast from apiFetch */ }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Mark Lead as Lost</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">Select a reason...</option>
              <option value="TOO_EXPENSIVE">Too Expensive</option>
              <option value="COMPETITOR_SELECTED">Competitor Selected</option>
              <option value="NO_RESPONSE">No Response</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">Cancel</button>
          <button onClick={handleSubmit} disabled={markLost.isPending}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-md bg-destructive text-destructive-foreground text-sm hover:opacity-90 disabled:opacity-50">
            {markLost.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Mark Lost
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeadsPanel() {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteCustomerId, setQuoteCustomerId] = useState<string | null>(null);

  const leadStatusOptions = [
    { value: "NEW", label: "New" },
    { value: "CONTACTED", label: "Contacted" },
    { value: "QUALIFIED", label: "Qualified" },
    { value: "FOLLOW_UP", label: "Follow Up" },
    { value: "CONVERTED", label: "Converted" },
    { value: "LOST", label: "Lost" },
  ];

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    { name: "status", label: "Status", type: "status", options: leadStatusOptions },
  ];

  const { data: leads = [], isLoading, refetch } = useLeads(
    Object.keys(filters).length > 0
      ? { status: filters.status || undefined, search: filters.search || undefined }
      : undefined
  );
  const deleteLead = useDeleteLead();
  const contactLead = useContactLead();
  const qualifyLead = useQualifyLead();
  const convertLeadToCustomer = useConvertLeadToCustomer();
  const permissions = useFeaturePermissions("SALES", "lead");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: permissions.export,
  };

  const handleCreate = () => {
    setEditingLead(null);
    setModalOpen(true);
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setModalOpen(true);
  };

  const handleModalSuccess = () => {
    refetch();
    setModalOpen(false);
    setEditingLead(null);
  };

  const handleCreateQuote = async (lead: Lead) => {
    if (lead.status === "CONVERTED") {
      setQuoteCustomerId(lead.converted_customer_id || null);
      setQuoteModalOpen(true);
      return;
    }
    try {
      const result = await convertLeadToCustomer.mutateAsync(lead.id);
      setQuoteCustomerId(result.customer_id);
      setQuoteModalOpen(true);
    } catch { /* toast from apiFetch */ }
  };

  const handleQuoteModalSuccess = () => {
    setQuoteModalOpen(false);
    setQuoteCustomerId(null);
    refetch();
  };

  const workflowActions = (lead: Lead) => {
    const btnClass = "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition";

    switch (lead.status) {
      case "NEW":
        return (
          <button onClick={(e) => { e.stopPropagation(); contactLead.mutate(lead.id, { onSuccess: () => refetch() }); }}
            className={`${btnClass} bg-info/10 text-info hover:bg-info/20`}>
            <Phone className="w-3.5 h-3.5" /> Contact
          </button>
        );
      case "CONTACTED":
        return (
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={(e) => { e.stopPropagation(); setFollowUpLead(lead); }}
              className={`${btnClass} bg-purple-100/40 text-purple-700 hover:bg-purple-200/40`}>
              <Calendar className="w-3.5 h-3.5" /> Follow Up
            </button>
            <button onClick={(e) => { e.stopPropagation(); qualifyLead.mutate(lead.id, { onSuccess: () => refetch() }); }}
              className={`${btnClass} bg-primary/10 text-primary hover:bg-primary/20`}>
              <ThumbsUp className="w-3.5 h-3.5" /> Qualify
            </button>
            <button onClick={(e) => { e.stopPropagation(); setLostLead(lead); }}
              className={`${btnClass} bg-destructive/10 text-destructive hover:bg-destructive/20`}>
              <XCircle className="w-3.5 h-3.5" /> Lost
            </button>
          </div>
        );
      case "FOLLOW_UP":
        return (
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={(e) => { e.stopPropagation(); qualifyLead.mutate(lead.id, { onSuccess: () => refetch() }); }}
              className={`${btnClass} bg-primary/10 text-primary hover:bg-primary/20`}>
              <ThumbsUp className="w-3.5 h-3.5" /> Qualify
            </button>
            <button onClick={(e) => { e.stopPropagation(); setLostLead(lead); }}
              className={`${btnClass} bg-destructive/10 text-destructive hover:bg-destructive/20`}>
              <XCircle className="w-3.5 h-3.5" /> Lost
            </button>
          </div>
        );
      case "QUALIFIED":
      case "CONVERTED":
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {lead.status === "CONVERTED" && (
              <button onClick={(e) => { e.stopPropagation(); handleCreateQuote(lead); }}
                className={`${btnClass} bg-primary/10 text-primary hover:bg-primary/20`}>
                <FileText className="w-3.5 h-3.5" /> Quote
              </button>
            )}
            {lead.status === "QUALIFIED" && (
              <button onClick={(e) => { e.stopPropagation(); convertLeadToCustomer.mutate(lead.id, { onSuccess: () => refetch() }); }}
                className={`${btnClass} bg-success/10 text-success hover:bg-success/20`}>
                <UserPlus className="w-3.5 h-3.5" /> Customer
              </button>
            )}
            {lead.status !== "CONVERTED" && (
              <button onClick={(e) => { e.stopPropagation(); setLostLead(lead); }}
                className={`${btnClass} bg-destructive/10 text-destructive hover:bg-destructive/20`}>
                <XCircle className="w-3.5 h-3.5" /> Lost
              </button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const computeKPIs = (data: Lead[]): Kpi[] => {
    const total = data.length;
    const newLeads = data.filter(l => l.status === "NEW").length;
    const qualified = data.filter(l => l.status === "QUALIFIED").length;
    const converted = data.filter(l => l.status === "CONVERTED").length;

    return [
      { label: "Total Leads", value: total, sub: "All time", tone: "info" as const, isCurrency: false },
      { label: "New Leads", value: newLeads, sub: "Awaiting contact", tone: "warning" as const, isCurrency: false },
      { label: "Qualified", value: qualified, sub: "Ready to convert", tone: "info" as const, isCurrency: false },
      { label: "Converted", value: converted, sub: "Became customers", tone: "success" as const, isCurrency: false },
    ];
  };

  const columns = [
    { key: "title", label: "Lead Title", sortable: true, mono: true },
    {
      key: "first_name", label: "Contact",
      render: (_: any, row: Lead) => `${row.first_name} ${row.last_name}`.trim(),
    },
    { key: "company_name", label: "Company", sortable: true },
    { key: "city", label: "City", sortable: true,
      render: (val: string) => val || "—",
    },
    { key: "source", label: "Source",
      render: (val: string) => <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">{val}</span>,
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (val: string) => <StatusBadge status={val} />,
    },
    {
      key: "actions", label: "", align: "right" as const,
      render: (_: any, lead: Lead) => workflowActions(lead),
    },
  ];

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Sales", "Leads"]}
        title="Leads Management"
        description="Track and manage potential customer opportunities."
        data={leads}
        isLoading={isLoading}
        columns={columns}
        kpis={computeKPIs}
        getRowId={(lead) => lead.id}
        permissions={modulePermissions}
        primaryActionLabel="New Lead"
        onCreate={handleCreate}
        actions={{
          onEdit: handleEdit,
          onDelete: (lead) => deleteLead.mutate(lead.id),
          canEdit: (lead) => !["CONVERTED", "LOST"].includes(lead.status),
          canDelete: (lead) => !["CONVERTED", "LOST"].includes(lead.status),
        }}
        onRowClick={(lead) => router.push(`/sales/leads/${lead.id}`)}
        exportEnabled={permissions.export}
        onRowSelect={setSelectedIds}
        filterBar={
          <FilterBar fields={filterFields} filters={filters} onChange={setFilters} />
        }
        batchActions={
          <button
            onClick={() => {
              const deletableIds = selectedIds.filter(id => {
                const lead = leads.find(l => l.id === id);
                return lead && !["CONVERTED", "LOST"].includes(lead.status);
              });
              if (deletableIds.length === 0) return;
              deletableIds.forEach(id => deleteLead.mutate(id));
            }}
            className="inline-flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 transition"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected
          </button>
        }
      />

      <LeadFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editingLead}
        onSuccess={handleModalSuccess}
      />

      <QuoteFormModal
        open={quoteModalOpen}
        onClose={() => { setQuoteModalOpen(false); setQuoteCustomerId(null); }}
        initialCustomerId={quoteCustomerId}
        onSuccess={handleQuoteModalSuccess}
      />

      <FollowUpModal
        open={!!followUpLead}
        lead={followUpLead}
        onClose={() => setFollowUpLead(null)}
        onSuccess={() => refetch()}
      />

      <LostReasonModal
        open={!!lostLead}
        lead={lostLead}
        onClose={() => setLostLead(null)}
        onSuccess={() => refetch()}
      />
    </>
  );
}
