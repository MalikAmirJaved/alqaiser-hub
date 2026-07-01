"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuotes, useSendQuote, useMarkViewedQuote, useApproveQuote, useRejectQuote, useMarkConvertedQuote, useRevertQuoteStatus, Quote } from "@/hooks/sales/useQuotes";
import { DynamicModulePage, type ModulePermissions, type Kpi } from "@/components/reuseable/final/DynamicModulePage";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { StatusBadge } from "@/components/finance/ui";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { CheckCircle, XCircle, FileText, ExternalLink, MoreVertical, Pencil, Trash2, Send, Eye, Undo2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
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
  const revertQuoteStatus = useRevertQuoteStatus();
  const permissions = useFeaturePermissions("SALES", "quote");
  const { confirm: confirmDelete, Modal: ConfirmModal } = useConfirmationModal();

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
      render: (_: any, quote: Quote) => {
        if (quote.status === "CONVERTED") return null;

        const canRevert = ["SENT", "VIEWED", "APPROVED", "REJECTED"].includes(quote.status);
        const hasWorkflowActions = ["DRAFT", "SENT", "VIEWED", "APPROVED"].includes(quote.status);
        const showEdit = quote.status === "DRAFT" && permissions.update;
        const showSeparator = (hasWorkflowActions || canRevert) && showEdit;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button onClick={(e) => e.stopPropagation()} className="p-1 rounded-md hover:bg-muted transition">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} side="bottom">
              {quote.status === "DRAFT" && (
                <DropdownMenuItem onClick={() => handleSend(quote)}>
                  <Send className="w-4 h-4 mr-2" /> Send to Customer
                </DropdownMenuItem>
              )}
              {quote.status === "SENT" && (
                <DropdownMenuItem onClick={() => handleMarkViewed(quote)}>
                  <Eye className="w-4 h-4 mr-2" /> Mark as Viewed
                </DropdownMenuItem>
              )}
              {quote.status === "VIEWED" && (
                <>
                  <DropdownMenuItem onClick={() => handleApprove(quote)}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleReject(quote)}>
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </DropdownMenuItem>
                </>
              )}
              {quote.status === "APPROVED" && quote.converted_invoice ? (
                <DropdownMenuItem onClick={() => router.push(`/sales/customer-invoices/${quote.converted_invoice}`)}>
                  <ExternalLink className="w-4 h-4 mr-2" /> View Invoice
                </DropdownMenuItem>
              ) : quote.status === "APPROVED" ? (
                <DropdownMenuItem onClick={() => handleConvertToInvoice(quote)}>
                  <FileText className="w-4 h-4 mr-2" /> Convert to Invoice
                </DropdownMenuItem>
              ) : null}
              {canRevert && (
                <DropdownMenuItem onClick={() => revertQuoteStatus.mutate(quote.id, { onSuccess: () => refetch() })}>
                  <Undo2 className="w-4 h-4 mr-2" /> Revert Status
                </DropdownMenuItem>
              )}
              {showSeparator && <DropdownMenuSeparator />}
              {showEdit && (
                <DropdownMenuItem onClick={() => handleEdit(quote)}>
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
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
      <ConfirmModal />
    </>
  );
}