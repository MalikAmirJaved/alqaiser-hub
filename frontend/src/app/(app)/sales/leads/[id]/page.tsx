"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  DetailLayout,
  StandardSidebar,
  type DetailTab,
} from "@/components/reuseable/final/DetailLayout";
import {
  useLead, useUpdateLead,
  useContactLead, useQualifyLead,
  useConvertLeadToCustomer, useMarkLost, useScheduleFollowUp,
  useLeadStatusHistory,
} from "@/hooks/sales/useLeads";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import LeadFormModal from "@/components/sales/LeadFormModal";
import QuoteFormModal from "@/components/sales/QuoteFormModal";
import StatusHistoryTimeline from "@/components/sales/StatusHistoryTimeline";
import { toast } from "sonner";
import { CheckCircle, Phone, ThumbsUp, UserPlus, XCircle, Calendar, FileText, Loader2, X, Clock } from "lucide-react";

export default function LeadDetailPage() {
  const formatCurrency = useFormatCurrency();
  const { id } = useParams();
  const { data: lead, isLoading, refetch } = useLead(id as string);
  const updateLead = useUpdateLead();
  const contactLead = useContactLead();
  const qualifyLead = useQualifyLead();
  const convertLeadToCustomer = useConvertLeadToCustomer();
  const markLost = useMarkLost();
  const scheduleFollowUp = useScheduleFollowUp();
  const permissions = useFeaturePermissions("SALES", "lead");

  const { data: statusHistory, isLoading: historyLoading } = useLeadStatusHistory(id as string);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteCustomerId, setQuoteCustomerId] = useState<string | null>(null);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!lead) return <div className="p-8 text-center">Lead not found</div>;

  const handleEdit = () => {
    setEditingLead(lead);
    setModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    refetch();
    setModalOpen(false);
    setEditingLead(null);
  };

  const handleAction = async (action: string) => {
    try {
      switch (action) {
        case "contact":
          await contactLead.mutateAsync(lead.id);
          toast.success("Lead marked as Contacted");
          break;
        case "qualify":
          await qualifyLead.mutateAsync(lead.id);
          toast.success("Lead qualified");
          break;
        case "convert":
          await convertLeadToCustomer.mutateAsync(lead.id);
          toast.success("Lead converted to customer");
          break;
      }
      refetch();
    } catch { /* toast from apiFetch */ }
  };

  const handleFollowUp = async () => {
    try {
      await scheduleFollowUp.mutateAsync({
        id: lead.id,
        follow_up_date: followUpDate || undefined,
        follow_up_notes: followUpNotes,
      });
      toast.success("Follow-up scheduled");
      setShowFollowUp(false);
      refetch();
    } catch { /* toast from apiFetch */ }
  };

  const handleCreateQuote = async () => {
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

  const handleMarkLost = async () => {
    try {
      await markLost.mutateAsync({ id: lead.id, lost_reason: lostReason });
      toast.success("Lead marked as Lost");
      setShowLost(false);
      refetch();
    } catch { /* toast from apiFetch */ }
  };

  const canEdit = !["CONVERTED", "LOST"].includes(lead.status);

  const tabs: DetailTab[] = [
    {
      id: "overview",
      label: "Overview",
      render: () => (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Lead Title", lead.title],
            ["Full Name", `${lead.first_name} ${lead.last_name}`.trim()],
            ["Company", lead.company_name || "—"],
            ["Email", lead.email || "—"],
            ["Phone", lead.phone || "—"],
            ["Priority", lead.priority ? (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                lead.priority === "HOT" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                lead.priority === "WARM" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              }`}>
                {lead.priority === "HOT" ? "🔥" : lead.priority === "WARM" ? "🟡" : "🔵"} {lead.priority}
              </span>
            ) : "—"],
            ["Score", lead.score !== null && lead.score !== undefined ? `${lead.score}/100` : "—"],
            ["Source", lead.source],
            ["Status", lead.status],
            ["Address", lead.address_line || "—"],
            ["City", lead.city || "—"],
            ["State", lead.state || "—"],
            ["Country", lead.country || "—"],
            ["Follow Up Date", lead.follow_up_date || "—"],
            ["Follow Up Notes", lead.follow_up_notes || "—"],
            ["Lost Reason", lead.lost_reason || "—"],
            ["Created", new Date(String(lead.created_at)).toLocaleDateString()],
            ["Last Updated", new Date(String(lead.updated_at)).toLocaleDateString()],
            ["Notes", lead.notes || "—"],
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "history",
      label: "Status History",
      count: statusHistory?.length || 0,
      render: () => (
        <StatusHistoryTimeline history={statusHistory || []} isLoading={historyLoading} />
      ),
    },
  ];

  const getPrimaryAction = () => {
    switch (lead.status) {
      case "NEW":
        return { label: "Contact Lead", action: () => handleAction("contact"), icon: Phone };
      case "QUALIFIED":
      case "CONVERTED":
        return { label: "Create Quote", action: handleCreateQuote, icon: FileText };
      case "CONTACTED":
      case "FOLLOW_UP":
        return { label: "Qualify Lead", action: () => handleAction("qualify"), icon: ThumbsUp };
      default:
        return null;
    }
  };

  const primaryAction = getPrimaryAction();

  const statusTone: Record<string, string> = {
    NEW: "info", CONTACTED: "warning", QUALIFIED: "primary",
    FOLLOW_UP: "warning", CONVERTED: "success", LOST: "destructive",
  };

  return (
    <>
      <DetailLayout
        breadcrumbs={["Sales", "Leads", lead.title || lead.id.slice(0, 8)]}
        entityId={lead.id.slice(0, 8)}
        title={lead.title}
        status={lead.status}
        subtitle={`${lead.first_name} ${lead.last_name} · ${lead.company_name || "Individual"}`}
        data={lead}
        meta={[
          { label: "Source", value: lead.source },
          { label: "Priority", value: lead.priority || "—" },
          { label: "Email", value: lead.email || "—" },
          { label: "Phone", value: lead.phone || "—" },
        ]}
        summary={[
          { label: "Created", value: new Date(String(lead.created_at)).toLocaleDateString(), isCurrency: false },
          { label: "Status", value: lead.status, tone: statusTone[lead.status] as any || "warning", isCurrency: false },
          { label: "Priority", value: lead.priority || "—", tone: lead.priority === "HOT" ? "destructive" : lead.priority === "WARM" ? "warning" : lead.priority === "COLD" ? "info" : undefined, isCurrency: false },
          { label: "Score", value: lead.score != null ? `${lead.score}/100` : "—", isCurrency: false },
          { label: "Converted", value: lead.status === "CONVERTED" ? "Yes" : "No", isCurrency: false },
        ]}
        primaryActionLabel={primaryAction?.label || ""}
        onPrimaryAction={primaryAction?.action}
        onEdit={permissions.update && canEdit ? handleEdit : undefined}
        permissions={{ edit: permissions.update && canEdit, submit: !!primaryAction }}
        tabs={tabs}
        sidebar={
          <div className="space-y-4">
            <StandardSidebar
              metadata={[
                ["Created", new Date(String(lead.created_at)).toLocaleString()],
                ["Created by", lead.created_by_name || "—"],
                ["Modified", new Date(String(lead.updated_at)).toLocaleString()],
                ["Modified by", lead.updated_by_name || "—"],
              ]}
            />
          </div>
        }
        currencyFormatter={formatCurrency}
      />

      <LeadFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingLead(null); }}
        initialData={editingLead}
        onSuccess={handleUpdateSuccess}
      />

      <QuoteFormModal
        open={quoteModalOpen}
        onClose={() => { setQuoteModalOpen(false); setQuoteCustomerId(null); }}
        initialCustomerId={quoteCustomerId}
        onSuccess={handleQuoteModalSuccess}
      />

      {/* Follow Up Modal */}
      {showFollowUp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowFollowUp(false)}>
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Schedule Follow Up</h3>
              <button onClick={() => setShowFollowUp(false)} className="p-1 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea rows={3} value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="e.g., Customer needs approval from manager" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowFollowUp(false)} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleFollowUp} disabled={scheduleFollowUp.isPending}
                className="inline-flex items-center gap-1.5 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50">
                {scheduleFollowUp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lost Reason Modal */}
      {showLost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowLost(false)}>
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Mark Lead as Lost</h3>
              <button onClick={() => setShowLost(false)} className="p-1 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <select value={lostReason} onChange={e => setLostReason(e.target.value)}
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
              <button onClick={() => setShowLost(false)} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleMarkLost} disabled={markLost.isPending}
                className="inline-flex items-center gap-1.5 px-4 h-9 rounded-md bg-destructive text-destructive-foreground text-sm hover:opacity-90 disabled:opacity-50">
                {markLost.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Mark Lost
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
