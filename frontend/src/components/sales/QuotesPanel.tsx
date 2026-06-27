"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuotes, useSendQuote, useMarkViewedQuote, useApproveQuote, useRejectQuote, useMarkConvertedQuote, Quote } from "@/hooks/sales/useQuotes";
import { DynamicModulePage, type ModulePermissions, type Kpi } from "@/components/reuseable/final/DynamicModulePage";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { StatusBadge } from "@/components/finance/ui";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { CheckCircle, XCircle, FileText, ExternalLink } from "lucide-react";
import QuoteFormModal from "./QuoteFormModal";
import CustomerInvoiceFormModal from "@/components/finance/customer-invoices/CustomerInvoiceFormModal";
import { usePagination } from "@/hooks/usePagination";

export default function QuotesPanel() {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [quoteToConvert, setQuoteToConvert] = useState<Quote | null>(null);
  const pagination = usePagination();

  const quoteStatusOptions = [
    { value: "DRAFT", label: "Draft" },
    { value: "SENT", label: "Sent" },
    { value: "VIEWED", label: "Viewed" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
    { value: "CONVERTED", label: "Converted to Invoice" },
  ];

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    { name: "status", label: "Status", type: "status", options: quoteStatusOptions },
  ];

  const quoteFilters = useMemo(() => {
    const f: { status?: string; search?: string; page?: string } = {};
    if (filters.status) f.status = filters.status;
    if (filters.search) f.search = filters.search;
    f.page = String(pagination.page);
    return f;
  }, [filters, pagination.page]);

  const { data: quotes = [], isLoading, refetch, totalCount } = useQuotes(quoteFilters);
  const sendQuote = useSendQuote();
  const markViewed = useMarkViewedQuote();
  const approveQuote = useApproveQuote();
  const rejectQuote = useRejectQuote();
  const markConverted = useMarkConvertedQuote();
  const permissions = useFeaturePermissions("SALES", "quote");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: permissions.export,
  };

  const handleSend = async (quote: Quote) => {
    try {
      await sendQuote.mutateAsync(quote.id);
      refetch();
    } catch { /* toast from apiFetch */ }
  };

  const handleMarkViewed = async (quote: Quote) => {
    try {
      await markViewed.mutateAsync(quote.id);
      refetch();
    } catch { /* toast from apiFetch */ }
  };

  const handleApprove = async (quote: Quote) => {
    try {
      await approveQuote.mutateAsync(quote.id);
      refetch();
    } catch { /* toast from apiFetch */ }
  };

  const handleReject = async (quote: Quote) => {
    try {
      await rejectQuote.mutateAsync(quote.id);
      refetch();
    } catch { /* toast from apiFetch */ }
  };

  const handleConvertToInvoice = (quote: Quote) => {
    setQuoteToConvert(quote);
    setInvoiceModalOpen(true);
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

  const handleInvoiceSuccess = (result?: any) => {
    const invoiceId = result?.data?.id || result?.id;
    if (quoteToConvert && invoiceId) {
      markConverted.mutate({ quoteId: quoteToConvert.id, invoiceId });
    }
    refetch();
    setInvoiceModalOpen(false);
    setQuoteToConvert(null);
  };

  const computeKPIs = (data: Quote[]): Kpi[] => {
    const totalAmount = data.reduce((sum, q) => sum + Number(q.total_amount || 0), 0);
    const acceptedAmount = data.filter(q => q.status === "APPROVED" || q.status === "CONVERTED").reduce((sum, q) => sum + Number(q.total_amount || 0), 0);
    const pendingCount = data.filter(q => q.status === "DRAFT" || q.status === "SENT" || q.status === "VIEWED").length;
    const acceptedCount = data.filter(q => q.status === "APPROVED" || q.status === "CONVERTED").length;

    return [
      { label: "Pipeline Value", value: totalAmount, sub: `${data.length} total quotes`, tone: "info" as const, isCurrency: true },
      { label: "Pending Quotes", value: pendingCount, sub: "Awaiting approval or sent", tone: "warning" as const, isCurrency: false },
      { label: "Closed (Won)", value: acceptedAmount, sub: `${acceptedCount} quotes won`, tone: "success" as const, isCurrency: true },
      { label: "Win Rate", value: data.length > 0 ? `${((acceptedCount / data.length) * 100).toFixed(1)}%` : "0%", sub: "Accepted ratio", tone: "info" as const, isCurrency: false },
    ];
  };

  const buildInvoiceInitialData = (quote: Quote): any => ({
    customer: quote.customer || "",
    customer_name: quote.customer_name || "",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: quote.expiration_date || "",
    amount: Number(quote.total_amount),
    overall_discount_percent: Number((quote as any).overall_discount_percent || 0),
    overall_tax_percent: Number((quote as any).overall_tax_percent || 0),
    notes: quote.notes || "",
    lines: (quote.lines || []).map((line) => ({
      variant: line.variant,
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_amount: line.discount_amount || 0,
      tax_rate: line.tax_rate || 0,
      variant_name: line.variant_name,
      variant_sku: line.variant_sku,
      is_manual_entry: line.is_manual_entry || false,
      manual_variant_name: line.manual_variant_name || "",
      manual_variant_sku: line.manual_variant_sku || "",
      vendor: line.vendor || "",
      vendor_name: line.vendor_name || "",
    })),
  });

  const columns = [
    { key: "quote_number", label: "Quote #", mono: true, sortable: true },
    { key: "customer_name", label: "Customer", sortable: true },
    { key: "date", label: "Issued Date", sortable: true },
    { key: "total_amount", label: "Total Value", sortable: true, render: (val: number) => formatCurrency(val) },
    { key: "status", label: "Status", sortable: true, render: (val: string) => <StatusBadge status={val} /> },
    {
      key: "actions",
      label: "",
      align: "right" as const,
      render: (_: any, quote: Quote) => (
        <div className="flex items-center gap-1">
          {quote.status === "DRAFT" && (
            <button
              onClick={(e) => { e.stopPropagation(); handleSend(quote); }}
              className="p-1.5 rounded-md hover:bg-info/10 text-info transition"
              title="Send to Customer"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}
          {quote.status === "SENT" && (
            <button
              onClick={(e) => { e.stopPropagation(); handleMarkViewed(quote); }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-info/10 text-info hover:bg-info/20 text-xs font-medium transition"
              title="Mark as Viewed"
            >
              Viewed
            </button>
          )}
          {quote.status === "VIEWED" && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handleApprove(quote); }}
                className="p-1.5 rounded-md hover:bg-success/10 text-success transition"
                title="Approve Quote"
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
            </>
          )}
          {quote.status === "APPROVED" && quote.converted_invoice ? (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/sales/customer-invoices/${quote.converted_invoice}`); }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-success/10 text-success hover:bg-success/20 text-xs font-medium transition"
              title="View converted invoice"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {quote.converted_invoice_number || "Invoiced"}
            </button>
          ) : quote.status === "APPROVED" ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleConvertToInvoice(quote); }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium transition"
              title="Convert to Invoice"
            >
              <FileText className="w-3.5 h-3.5" />
              Invoice
            </button>
          ) : null}
        </div>
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
          canEdit: (quote) => quote.status === "DRAFT"
        }}
        onRowClick={(quote) => router.push(`/sales/quotes/${quote.id}`)}
        exportEnabled={permissions.export}
        totalCount={totalCount}
        currentPage={pagination.page}
        onPageChange={pagination.setPage}
        filterBar={
          <FilterBar
            fields={filterFields}
            filters={filters}
            onChange={(f) => { setFilters(f); pagination.resetPage(); }}
          />
        }
      />
      <QuoteFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editingQuote}
        onSuccess={handleModalSuccess}
      />
      <CustomerInvoiceFormModal
        open={invoiceModalOpen}
        onClose={() => {
          setInvoiceModalOpen(false);
          setQuoteToConvert(null);
        }}
        defaultValues={quoteToConvert ? buildInvoiceInitialData(quoteToConvert) : null}
        onSuccess={handleInvoiceSuccess}
        moduleCode="SALES"
      />
    </>
  );
}