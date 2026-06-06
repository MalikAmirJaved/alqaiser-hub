"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLeads, useDeleteLead, useConvertLead, Lead } from "@/hooks/sales/useLeads";
import { DynamicModulePage, type ModulePermissions, type Kpi } from "@/components/reuseable/final/DynamicModulePage";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { StatusBadge } from "@/components/finance/ui";
import { CheckCircle, Trash2 } from "lucide-react";
import LeadFormModal from "./LeadFormModal";

export default function LeadsPanel() {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const { data: leads = [], isLoading, refetch } = useLeads();
  const deleteLead = useDeleteLead();
  const convertLead = useConvertLead();
  const permissions = useFeaturePermissions("SALES", "lead");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: true,
  };

  const handleRowClick = (lead: Lead) => {
    router.push(`/sales/leads/${lead.id}`);
  };

  const handleConvert = async (lead: Lead) => {
    try {
      const res = await convertLead.mutateAsync({ id: lead.id, createQuote: true });
      if (res.quote_id) {
        router.push(`/sales/quotes/${res.quote_id}`);
      }
      refetch();
    } catch (error: any) {
      console.error("Conversion failed", error);
    }
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

  const computeKPIs = (data: Lead[]): Kpi[] => {
    const totalLeads = data.length;
    const newLeads = data.filter(l => l.status === "NEW").length;
    const wonLeads = data.filter(l => l.status === "WON").length;
    const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : "0";

    return [
      { label: "Total Leads", value: totalLeads, sub: "All time", tone: "info" as const, isCurrency: false },
      { label: "New Leads", value: newLeads, sub: "Awaiting contact", tone: "warning" as const, isCurrency: false },
      { label: "Won", value: wonLeads, sub: "Converted to customers", tone: "success" as const, isCurrency: false },
      { label: "Conversion", value: `${conversionRate}%`, sub: "Lead to Win ratio", tone: "info" as const, isCurrency: false },
    ];
  };

  const columns = [
    { key: "title", label: "Lead Title", sortable: true, mono: true },
    { key: "first_name", label: "Contact Name", render: (_: any, row: Lead) => `${row.first_name} ${row.last_name}` },
    { key: "company_name", label: "Company", sortable: true },
    { key: "source", label: "Source", render: (val: string) => <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">{val}</span> },
    { key: "status", label: "Status", sortable: true, render: (val: string) => <StatusBadge status={val} /> },
    { key: "created_at", label: "Created", render: (val: string) => new Date(val).toLocaleDateString() },
  ];

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Sales", "Leads"]}
        title="Leads Management"
        description="Track and manage potential customer opportunities from various sources."
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
          onPost: (lead) => handleConvert(lead),
          canPost: (lead) => lead.status !== "WON" && lead.status !== "LOST",
        }}
        onRowClick={handleRowClick}
        exportEnabled
        onRowSelect={setSelectedIds}
        batchActions={
          <button
            onClick={() => selectedIds.forEach(id => deleteLead.mutate(id))}
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
    </>
  );
}