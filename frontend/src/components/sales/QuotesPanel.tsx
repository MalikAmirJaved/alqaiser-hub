"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuotes, useAcceptQuote, useRejectQuote, Quote } from "@/hooks/sales/useQuotes";
import { DynamicModulePage, type ModulePermissions, type Kpi } from "@/components/reuseable/final/DynamicModulePage";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { StatusBadge } from "@/components/finance/ui";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { CheckCircle, XCircle } from "lucide-react";
import QuoteFormModal from "./QuoteFormModal";

export default function QuotesPanel() {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const quoteStatusOptions = [
    { value: "DRAFT", label: "Draft" },
    { value: "SENT", label: "Sent" },
    { value: "ACCEPTED", label: "Accepted" },
    { value: "DECLINED", label: "Declined" },
    { value: "EXPIRED", label: "Expired" },
    { value: "REJECTED", label: "Rejected" },
  ];

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    { name: "status", label: "Status", type: "status", options: quoteStatusOptions },
  ];

  const { data: quotes = [], isLoading, refetch } = useQuotes(
    Object.keys(filters).length > 0
      ? { status: filters.status || undefined, search: filters.search || undefined }
      : undefined
  );
  const acceptQuote = useAcceptQuote();
  const rejectQuote = useRejectQuote();
  const permissions = useFeaturePermissions("SALES", "quote");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: permissions.export,
  };

  const handleAccept = async (quote: Quote) => {
    try {
      const res = await acceptQuote.mutateAsync(quote.id);
      if (res.invoice_id) {
        router.push(`/sales/customer-invoices/${res.invoice_id}`);
      }
      refetch();
    } catch (error: any) {
      console.error("Accept failed", error);
    }
  };

  const handleReject = async (quote: Quote) => {
    try {
      await rejectQuote.mutateAsync(quote.id);
      refetch();
    } catch (error: any) {
      console.error("Reject failed", error);
    }
  };

  const handleCreate = () => {
    setEditingQuote(null);
    setModalOpen(true);
  };

  const handleEdit = (quote: Quote) => {
    setEditingQuote(quote);
    setModalOpen(true);
  };

  const handleModalSuccess = () => {
    refetch();
    setModalOpen(false);
    setEditingQuote(null);
  };

  const computeKPIs = (data: Quote[]): Kpi[] => {
    const totalAmount = data.reduce((sum, q) => sum + Number(q.total_amount || 0), 0);
    const acceptedAmount = data.filter(q => q.status === "ACCEPTED").reduce((sum, q) => sum + Number(q.total_amount || 0), 0);
    const pendingCount = data.filter(q => q.status === "DRAFT" || q.status === "SENT").length;
    const acceptedCount = data.filter(q => q.status === "ACCEPTED").length;

    return [
      { label: "Pipeline Value", value: totalAmount, sub: `${data.length} total quotes`, tone: "info" as const, isCurrency: true },
      { label: "Pending Quotes", value: pendingCount, sub: "Awaiting approval", tone: "warning" as const, isCurrency: false },
      { label: "Closed (Won)", value: acceptedAmount, sub: `${acceptedCount} quotes accepted`, tone: "success" as const, isCurrency: true },
      { label: "Win Rate", value: data.length > 0 ? `${((acceptedCount / data.length) * 100).toFixed(1)}%` : "0%", sub: "Accepted ratio", tone: "info" as const, isCurrency: false },
    ];
  };

  const columns = [
    { key: "quote_number", label: "Quote #", mono: true, sortable: true },
    { key: "customer_name", label: "Customer", sortable: true },
    { key: "date", label: "Issued Date", sortable: true },
    { key: "total_amount", label: "Total Value", align: "right" as const, sortable: true, render: (val: number) => formatCurrency(val) },
    { key: "status", label: "Status", sortable: true, render: (val: string) => <StatusBadge status={val} /> },
    {
      key: "actions",
      label: "",
      align: "right" as const,
      render: (_: any, quote: Quote) => (
        (quote.status === "DRAFT" || quote.status === "SENT") ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleAccept(quote); }}
              className="p-1.5 rounded-md hover:bg-success/10 text-success transition"
              title="Approve & Invoice"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleReject(quote); }}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition"
              title="Reject Quote"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        ) : null
      ),
    },
  ];

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Sales", "Quotes"]}
        title="Sales Quotes"
        description="Create, manage and track price estimates for your customers."
        data={quotes}
        isLoading={isLoading}
        columns={columns}
        kpis={computeKPIs}
        getRowId={(quote) => quote.id}
        permissions={modulePermissions}
        primaryActionLabel="New Quote"
        onCreate={handleCreate}
        actions={{
          onEdit: handleEdit,
          canEdit: (quote) => !["ACCEPTED", "REJECTED"].includes(quote.status)
        }}
        onRowClick={(quote) => router.push(`/sales/quotes/${quote.id}`)}
        exportEnabled={permissions.export}
        filterBar={
          <FilterBar
            fields={filterFields}
            filters={filters}
            onChange={setFilters}
          />
        }
      />
      <QuoteFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editingQuote}
        onSuccess={handleModalSuccess}
      />
    </>
  );
}