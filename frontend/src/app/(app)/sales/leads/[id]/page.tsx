"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DetailLayout,
  StandardSidebar,
  RelatedRecords,
  type DetailTab,
} from "@/components/reuseable/final/DetailLayout";
import {
  useLead,
  useUpdateLead,
  useCreateCustomerFromLead,
} from "@/hooks/sales/useLeads";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";
import LeadFormModal from "@/components/sales/LeadFormModal";
import QuoteFormModal from "@/components/sales/QuoteFormModal";
import { Quote } from "@/hooks/sales/useQuotes";

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: lead, isLoading, refetch } = useLead(id as string);
  const updateLead = useUpdateLead();
  const createCustomerFromLead = useCreateCustomerFromLead();
  const permissions = useFeaturePermissions("SALES", "lead");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quotePrefillCustomerId, setQuotePrefillCustomerId] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

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

  const handleConvertToQuote = async () => {
    setIsConverting(true);
    try {
      let customerId = lead.customer;
      if (!customerId) {
        const result = await createCustomerFromLead.mutateAsync(lead.id);
        customerId = result.customer_id;
        await refetch();
      }
      setQuotePrefillCustomerId(customerId);
      setQuoteModalOpen(true);
    } catch (error) {
      console.error("Failed to prepare customer for quote:", error);
    } finally {
      setIsConverting(false);
    }
  };

  const handleQuoteModalSuccess = (quote?: Quote) => {
    setQuoteModalOpen(false);
    setQuotePrefillCustomerId(null);
    refetch();
    if (quote?.id) {
      router.push(`/sales/quotes/${quote.id}`);
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
            <div
              key={label as string}
              className="flex justify-between border-b border-border/60 pb-2"
            >
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const relatedItems: {
    id: string;
    type: string;
    title: string;
    amount?: string;
    status?: string;
  }[] = [];
  if (lead.customer) {
    relatedItems.push({
      id: lead.customer,
      type: "Customer",
      title: "Linked Customer",
      status: "Active",
    });
  }

  if (relatedItems.length > 0) {
    tabs.push({
      id: "related",
      label: "Related",
      count: relatedItems.length,
      render: () => <RelatedRecords items={relatedItems} />,
    });
  }

  const canConvert = lead.status !== "WON" && lead.status !== "ACCEPTED";

  return (
    <>
      <DetailLayout
        breadcrumbs={["Sales", "Leads", lead.title || lead.id.slice(0, 8)]}
        entityId={lead.id.slice(0, 8)}
        title={lead.title}
        status={lead.status}
        subtitle={`${lead.first_name} ${lead.last_name} · ${
          lead.company_name || "Individual"
        }`}
        data={lead}
        meta={[
          { label: "Source", value: lead.source },
          { label: "Email", value: lead.email || "—" },
          { label: "Phone", value: lead.phone || "—" },
        ]}
        summary={[
          {
            label: "Created",
            value: new Date(String(lead.created_at)).toLocaleDateString(),
            isCurrency: false,
          },
          {
            label: "Status",
            value: lead.status,
            tone:
              lead.status === "WON"
                ? "success"
                : lead.status === "LOST"
                ? "destructive"
                : lead.status === "ACCEPTED"
                ? "info"
                : "warning",
          },
          {
            label: "Converted",
            value: lead.status === "WON" ? "Yes" : "No",
            isCurrency: false,
          },
        ]}
        primaryActionLabel={canConvert ? "Convert to Quote" : "Already Converted"}
        onPrimaryAction={canConvert ? handleConvertToQuote : undefined}
        onEdit={permissions.update ? handleEdit : undefined}
        permissions={{ edit: permissions.update, submit: canConvert }}
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
      <QuoteFormModal
        open={quoteModalOpen}
        onClose={() => {
          setQuoteModalOpen(false);
          setQuotePrefillCustomerId(null);
        }}
        initialCustomerId={quotePrefillCustomerId}
        onSuccess={handleQuoteModalSuccess}
      />
    </>
  );
}