"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuotes, useDeleteQuote, useAcceptQuote, useRejectQuote, Quote } from "@/hooks/sales/useQuotes";
import { DynamicModulePage, type ModulePermissions, type Kpi } from "@/components/reuseable/final/DynamicModulePage";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";
import { StatusBadge } from "@/components/finance/ui";
import { CheckCircle, XCircle, Trash2 } from "lucide-react";
import QuoteFormModal from "./QuoteFormModal";

export default function QuotesPanel() {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const { data: quotes = [], isLoading, refetch } = useQuotes();
  const deleteQuote = useDeleteQuote();
  const acceptQuote = useAcceptQuote();
  const rejectQuote = useRejectQuote();
  const permissions = useFeaturePermissions("SALES", "quote");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: true,
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
          onDelete: (quote) => deleteQuote.mutate(quote.id),
        }}
        onRowClick={(quote) => router.push(`/sales/quotes/${quote.id}`)}
        exportEnabled
        onRowSelect={setSelectedIds}
        batchActions={
          <button
            onClick={() => selectedIds.forEach(id => deleteQuote.mutate(id))}
            className="inline-flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 transition"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected
          </button>
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