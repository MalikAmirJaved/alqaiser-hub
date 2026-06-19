"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreHorizontal, CheckCircle, FileText } from "lucide-react";
import {
  useLeads,
  useDeleteLead,
  useAcceptLead,
  useCreateCustomerFromLead,
  Lead,
} from "@/hooks/sales/useLeads";
import {
  DynamicModulePage,
  type ModulePermissions,
  type Kpi,
} from "@/components/reuseable/final/DynamicModulePage";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { StatusBadge } from "@/components/finance/ui";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { Trash2 } from "lucide-react";
import LeadFormModal from "./LeadFormModal";
import QuoteFormModal from "./QuoteFormModal";
import { Quote } from "@/hooks/sales/useQuotes";

// Separate component to handle each lead's dropdown independently
function LeadActionsCell({
  lead,
  onAccept,
  onConvertToQuote,
  isConverting,
}: {
  lead: Lead;
  onAccept: (lead: Lead) => void;
  onConvertToQuote: (lead: Lead) => void;
  isConverting: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAccepted = lead.status === "ACCEPTED";
  const isWon = lead.status === "WON";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          btnRef.current && !btnRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleScroll = () => setIsOpen(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("scroll", handleScroll, true);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (isOpen) {
      setIsOpen(false);
    } else {
      setPosition({ top: rect.bottom + 4, right: document.documentElement.clientWidth - rect.right });
      setIsOpen(true);
    }
  };

  const handleAccept = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAccept(lead);
    setIsOpen(false);
  };

  const handleConvert = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConvertToQuote(lead);
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleDropdown}
        className="p-1.5 rounded-md hover:bg-muted transition"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {isOpen && position && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: position.top, right: position.right, zIndex: 9999 }}
          className="w-48 rounded-md border border-border bg-card shadow-xl"
        >
          <div className="py-1">
            {!isAccepted && !isWon && (
              <button
                onClick={handleAccept}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4 text-success" />
                Accept Lead
              </button>
            )}
            {isAccepted && !isWon && (
              <button
                onClick={handleConvert}
                disabled={isConverting}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2 disabled:opacity-50"
              >
                <FileText className="w-4 h-4 text-primary" />
                {isConverting ? "Preparing..." : "Convert to Quote"}
              </button>
            )}
            {isWon && (
              <span className="block px-3 py-1.5 text-xs text-muted-foreground">
                Converted to Quote
              </span>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default function LeadsPanel() {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quotePrefillCustomerId, setQuotePrefillCustomerId] = useState<string | null>(null);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const leadStatusOptions = [
    { value: "NEW", label: "New" },
    { value: "CONTACTED", label: "Contacted" },
    { value: "QUALIFIED", label: "Qualified" },
    { value: "ACCEPTED", label: "Accepted" },
    { value: "LOST", label: "Lost" },
    { value: "WON", label: "Won" },
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
  const acceptLead = useAcceptLead();
  const createCustomerFromLead = useCreateCustomerFromLead();
  const permissions = useFeaturePermissions("SALES", "lead");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: permissions.export,
  };

  const handleRowClick = (lead: Lead) => {
    router.push(`/sales/leads/${lead.id}`);
  };

  const handleAccept = async (lead: Lead) => {
    try {
      await acceptLead.mutateAsync(lead.id);
      refetch();
    } catch (error: any) {
      console.error("Accept failed", error);
    }
  };

  const handleConvertToQuote = async (lead: Lead) => {
    setConvertingLeadId(lead.id);
    try {
      let customerId = lead.customer;

      if (!customerId) {
        const result = await createCustomerFromLead.mutateAsync(lead.id);
        customerId = result.customer_id;
        await refetch();
      }

      setQuotePrefillCustomerId(customerId);
      setQuoteModalOpen(true);
    } catch (error: any) {
      console.error("Failed to prepare customer for quote:", error);
    } finally {
      setConvertingLeadId(null);
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
    const newLeads = data.filter((l) => l.status === "NEW").length;
    const acceptedLeads = data.filter((l) => l.status === "ACCEPTED").length;
    const wonLeads = data.filter((l) => l.status === "WON").length;

    return [
      {
        label: "Total Leads",
        value: totalLeads,
        sub: "All time",
        tone: "info" as const,
        isCurrency: false,
      },
      {
        label: "New Leads",
        value: newLeads,
        sub: "Awaiting contact",
        tone: "warning" as const,
        isCurrency: false,
      },
      {
        label: "Accepted",
        value: acceptedLeads,
        sub: "Ready for quote",
        tone: "success" as const,
        isCurrency: false,
      },
      {
        label: "Converted",
        value: wonLeads,
        sub: "Won deals",
        tone: "info" as const,
        isCurrency: false,
      },
    ];
  };

  const columns = [
    { key: "title", label: "Lead Title", sortable: true, mono: true },
    {
      key: "first_name",
      label: "Contact Name",
      render: (_: any, row: Lead) => `${row.first_name} ${row.last_name}`,
    },
    { key: "company_name", label: "Company", sortable: true },
    {
      key: "source",
      label: "Source",
      render: (val: string) => (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
          {val}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (val: string) => <StatusBadge status={val} />,
    },
    {
      key: "created_at",
      label: "Created",
      render: (val: string) => new Date(val).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "",
      align: "right" as const,
      render: (_: any, lead: Lead) => (
        <LeadActionsCell
          lead={lead}
          onAccept={handleAccept}
          onConvertToQuote={handleConvertToQuote}
          isConverting={convertingLeadId === lead.id}
        />
      ),
    },
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
          canEdit: (lead) => lead.status !== "ACCEPTED" && lead.status !== "WON",
          canDelete: (lead) => lead.status !== "ACCEPTED" && lead.status !== "WON",
        }}
        onRowClick={handleRowClick}
        exportEnabled={permissions.export}
        onRowSelect={setSelectedIds}
        filterBar={
          <FilterBar
            fields={filterFields}
            filters={filters}
            onChange={setFilters}
          />
        }
        batchActions={
          <button
            onClick={() => {
              const deletableIds = selectedIds.filter((id) => {
                const lead = leads.find((l) => l.id === id);
                return lead && lead.status !== "ACCEPTED" && lead.status !== "WON";
              });
              if (deletableIds.length === 0) return;
              deletableIds.forEach((id) => deleteLead.mutate(id));
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