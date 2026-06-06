"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DetailLayout, StandardSidebar, RelatedRecords, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { useLead, useUpdateLead, useConvertLead } from "@/hooks/sales/useLeads";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";
import LeadFormModal from "@/components/sales/LeadFormModal";

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: lead, isLoading, refetch } = useLead(id as string);
  const updateLead = useUpdateLead();
  const convertLead = useConvertLead();
  const permissions = useFeaturePermissions("SALES", "lead");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);

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

  const handleConvert = async () => {
    try {
      const res = await convertLead.mutateAsync({ id: lead.id, createQuote: true });
      if (res.quote_id) {
        router.push(`/sales/quotes/${res.quote_id}`);
      }
      refetch();
    } catch (error) {
      console.error("Conversion failed", error);
    }
  };

  const tabs: DetailTab[] = [
    {
      id: "overview",
      label: "Overview",
      render: () => (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Lead Title", lead.title],
            ["Full Name", `${lead.first_name} ${lead.last_name}`],
            ["Company", lead.company_name || "—"],
            ["Email", lead.email || "—"],
            ["Phone", lead.phone || "—"],
            ["Source", lead.source],
            ["Status", lead.status],
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
  ];

  // Build related records
  const relatedItems: { id: string; type: string; title: string; amount?: string; status?: string }[] = [];
  if (lead.customer) {
    relatedItems.push({
      id: lead.customer,
      type: "Customer",
      title: "Linked Customer",
      status: "Active",
    });
  }
  // Add quotes if they exist (not directly on lead, but we can fetch via quotes hook later)
  // For now, optional.

  if (relatedItems.length > 0) {
    tabs.push({
      id: "related",
      label: "Related",
      count: relatedItems.length,
      render: () => <RelatedRecords items={relatedItems} />,
    });
  }

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
          { label: "Email", value: lead.email || "—" },
          { label: "Phone", value: lead.phone || "—" },
        ]}
        summary={[
          { label: "Created", value: new Date(String(lead.created_at)).toLocaleDateString(), isCurrency: false },
          { label: "Status", value: lead.status, tone: lead.status === "WON" ? "success" : lead.status === "LOST" ? "destructive" : "info" },
          { label: "Converted", value: lead.status === "WON" ? "Yes" : "No", isCurrency: false },
        ]}
        primaryActionLabel={lead.status === "WON" ? "Already Converted" : "Convert to Quote"}
        onPrimaryAction={lead.status !== "WON" ? handleConvert : undefined}
        onEdit={permissions.update ? handleEdit : undefined}
        permissions={{ edit: permissions.update, submit: permissions.create }}
        tabs={tabs}
        sidebar={
          <StandardSidebar
            metadata={[
              ["Created", new Date(String(lead.created_at)).toLocaleString()],
              ["Created by", lead.created_by_name || "—"],
              ["Modified", new Date(String(lead.updated_at)).toLocaleString()],
              ["Modified by", lead.updated_by_name || "—"],
            ]}
          />
        }
        currencyFormatter={formatCurrency}
      />
      <LeadFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingLead(null);
        }}
        initialData={editingLead}
        onSuccess={handleUpdateSuccess}
      />
    </>
  );
}