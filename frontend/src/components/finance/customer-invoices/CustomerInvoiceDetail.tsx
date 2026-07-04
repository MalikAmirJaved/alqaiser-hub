"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DetailLayout, StandardSidebar, RelatedRecords, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { useCustomerInvoice, useUpdateCustomerInvoice, usePayCustomerInvoice, useSendInvoice, useCancelInvoice, useRefundInvoicePayments, useCustomerInvoiceAuditLog, useCustomerInvoiceActivityLog } from "@/hooks/finance/useCustomerInvoices";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useCompanySettingsQuery } from "@/hooks/useCompanySettings";
import { useTermsAndConditions } from "@/hooks/useTermsAndConditions";
import { PrintPreviewModal } from "@/components/common/QuoteInvoiceDocument";
import { StatusBadge } from "@/components/finance/ui";
import CustomerInvoiceFormModal from "./CustomerInvoiceFormModal";
import PayAmountModal from "@/components/finance/PayAmountModal";
import InvoiceCancelModal from "./InvoiceCancelModal";
import { FileText, Send, Printer, Download, Share2, Receipt, Edit, User, Clock, Mail, Loader2, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface CustomerInvoiceDetailProps {
  id: string;
  moduleCode: "FINANCE" | "SALES";
  onBack?: () => void;
}

const toNumber = (value: number | string | undefined): number => {
  if (value === undefined || value === null) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
};

export default function CustomerInvoiceDetail({ id, moduleCode, onBack }: CustomerInvoiceDetailProps) {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const { data: invoice, isLoading, refetch } = useCustomerInvoice(id);
  const updateInvoice = useUpdateCustomerInvoice();
  const payInvoice = usePayCustomerInvoice();
  const sendInvoice = useSendInvoice();
  const cancelInvoice = useCancelInvoice();
  const refundPayments = useRefundInvoicePayments();
  const resourceName = moduleCode === "SALES" ? "sales_customers_invoice" : "customer_invoice";
  const permissions = useFeaturePermissions(moduleCode, resourceName);
  const { data: companySettings } = useCompanySettingsQuery();
  const { terms: termsData } = useTermsAndConditions();
  const { data: auditLogs, isLoading: auditLogsLoading } = useCustomerInvoiceAuditLog(id);
  const { data: activityLog, isLoading: activityLoading } = useCustomerInvoiceActivityLog(id);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [posting, setPosting] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!invoice) return <div className="p-8 text-center">Invoice not found</div>;

  const amount = toNumber(invoice.amount);
  const paidAmount = toNumber(invoice.paid_amount);
  const outstanding = toNumber(invoice.outstanding);
  const canPay = invoice.status === "SENT" && invoice.payment_status !== "PAID";
  const canEdit = (invoice.status === "DRAFT" || invoice.status === "PENDING" || invoice.status === "SENT") && permissions.update && invoice.payment_status !== "PAID"
  const canDelete = (invoice.status === "DRAFT" || invoice.status === "PENDING") && permissions.delete;
  const canRecordPayment = canPay;
  const canSend = invoice.status === "PENDING" && permissions.send;
  const isRefunded = invoice.payments?.some((p: any) => p.payment_type === "PAYMENT" && p.status === "CONFIRMED");
  const hasReturnedLines = invoice.lines?.some((l: any) => l.status === "RETURNED");
  const canCancel = invoice.status !== "CANCELLED" && permissions.cancel && !isRefunded && !hasReturnedLines;
  const canReturn = invoice.payment_status === "PAID" && invoice.status !== "CANCELLED";

  const handleEdit = () => {
    setEditingInvoice(invoice);
    setModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    refetch();
    setModalOpen(false);
    setEditingInvoice(null);
  };

  const handlePay = async () => {
    setPayModalOpen(true);
  };

  const handleSend = async () => {
    try {
      await sendInvoice.mutateAsync(invoice.id);
      toast.success("Invoice sent successfully");
      refetch();
    } catch {
      /* toast from apiFetch */
    }
  };

  const handleCancel = async () => {
    const reason = window.prompt("Reason for cancellation (required):");
    if (!reason || !reason.trim()) {
      toast.error("Cancellation reason is required");
      return;
    }

    const hasLines = (invoice.lines || []).length > 0;
    if (hasLines || invoice.payment_status === "PAID") {
      setCancelReason(reason.trim());
      setCancelModalOpen(true);
      return;
    }

    try {
      await cancelInvoice.mutateAsync({ id: invoice.id, reason: reason.trim() });
      toast.success("Invoice cancelled");
      refetch();
    } catch {
      /* toast from apiFetch */
    }
  };

  const handleConfirmCancel = async (payload: {
    line_actions: { source_line_id: string; action: string }[];
    stock_dispositions: {
      source_line_id: string;
      product_qty: number;
      damage_qty: number;
      damage_reason: string;
    }[];
  }) => {
    if (!cancelReason) return;
    try {
      if (invoice.payment_status === "PAID") {
        await refundPayments.mutateAsync(invoice.id);
      }
      await cancelInvoice.mutateAsync({
        id: invoice.id,
        reason: cancelReason,
        line_actions: payload.line_actions,
        stock_dispositions: payload.stock_dispositions,
      });
      toast.success(
        invoice.payment_status === "PAID"
          ? "Payments refunded and invoice cancelled"
          : "Invoice cancelled"
      );
      setCancelModalOpen(false);
      setCancelReason("");
      refetch();
    } catch {
      /* toast from apiFetch */
    }
  };

  const handlePrint = () => {
    setShowPrintPreview(true);
  };

  const handleReturnToRefund = () => {
    const basePath = moduleCode === "SALES" ? "/sales/return" : "/finance/return";
    const params = new URLSearchParams({
      document_type: "INVOICE",
      document_number: invoice.invoice_number,
      document_id: invoice.id,
    });
    router.push(`${basePath}?${params.toString()}`);
  };

  const handleExportPdf = () => {
    setShowPrintPreview(true);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      const backPath = moduleCode === "FINANCE" ? "/finance/customer-invoices" : "/sales/customer-invoices";
      router.push(backPath);
    }
  };

  // Build related records
  const relatedItems: { id: string; type: string; title: string; amount?: string; status?: string }[] = [];

  if (invoice.sales_order) {
    relatedItems.push({
      id: invoice.sales_order,
      type: "Sales Order",
      title: "Sales order reference",
      amount: formatCurrency(amount),
      status: "Active",
    });
  }

  if (invoice.journal_entry) {
    relatedItems.push({
      id: String(invoice.journal_entry),
      type: "Journal Entry",
      title: "Journal entry",
      status: "Posted",
    });
  }

  // Get payments from invoice (if any – need to fetch separately)
  // This would require a separate API call to fetch payments for this invoice

  const tabs: DetailTab[] = [
    {
      id: "items",
      label: "Line Items",
      count: invoice.lines?.length || 0,
      render: () => (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
              <tr>
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-4 py-2 text-left">Supplier</th>
                <th className="px-4 py-2 text-right">Cost Price</th>
                <th className="px-4 py-2 text-right">Quantity</th>
                <th className="px-4 py-2 text-right">Unit Price</th>
                <th className="px-4 py-2 text-right">Discount</th>
                <th className="px-4 py-2 text-right">Tax</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines?.map((line, idx) => {
                const subtotal = line.quantity * line.unit_price;
                const discount = line.discount_amount || 0;
                const tax = (subtotal - discount) * (line.tax_rate / 100);
                const lineTotal = subtotal - discount + tax;
                const lineStatus = line.status || "ACTIVE";
                return (
                  <tr key={idx} className={`border-b border-border/60 ${lineStatus === "CANCELLED" ? "bg-destructive/5" : ""}`}>
                    <td className="px-4 py-2">
                      <div className="font-medium">{line.variant_name || "Product"}</div>
                      <div className="text-xs text-muted-foreground">SKU: {line.variant_sku || "—"}</div>
                      {(line as any).description && (
                        <div className="text-xs text-muted-foreground/70 italic mt-0.5">{(line as any).description}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {line.vendor_name ? (
                        <span className="text-muted-foreground">{line.vendor_name}</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-sm">
                      {line.cost_price != null && line.cost_price > 0 ? (
                        <span className="text-muted-foreground">{formatCurrency(line.cost_price)}</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{line.quantity}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(line.unit_price)}</td>
                    <td className="px-4 py-2 text-right text-destructive">{discount > 0 ? formatCurrency(discount) : "—"}</td>
                    <td className="px-4 py-2 text-right">{line.tax_rate}%</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(lineTotal)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${
                        lineStatus === "CANCELLED" ? "bg-destructive/15 text-destructive" :
                        lineStatus === "RETURNED" ? "bg-warning/15 text-warning" :
                        "bg-success/15 text-success"
                      }`}>{lineStatus}</span>
                    </td>
                  </tr>
                );
              })}
              {(!invoice.lines || invoice.lines.length === 0) && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    No items in this invoice
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-border">
              {invoice.lines && invoice.lines.length > 0 && (
                <>
                  <tr>
                    <td colSpan={8} className="px-4 py-2 text-right text-sm text-muted-foreground">Subtotal</td>
                    <td className="px-4 py-2 text-right text-sm">
                      {formatCurrency(
                        invoice.lines.reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0)
                      )}
                    </td>
                  </tr>
                  {(invoice as any).overall_discount_percent > 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-2 text-right text-sm text-muted-foreground">
                        Discount ({(invoice as any).overall_discount_percent}%)
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-destructive">
                        -{formatCurrency(
                          invoice.lines.reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0) *
                          (Number((invoice as any).overall_discount_percent) / 100)
                        )}
                      </td>
                    </tr>
                  )}
                  {(invoice as any).overall_tax_percent > 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-2 text-right text-sm text-muted-foreground">
                        Tax ({(invoice as any).overall_tax_percent}%)
                      </td>
                      <td className="px-4 py-2 text-right text-sm">
                        {formatCurrency(
                          (invoice.lines.reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0) -
                            invoice.lines.reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0) *
                            (Number((invoice as any).overall_discount_percent) / 100)) *
                          (Number((invoice as any).overall_tax_percent) / 100)
                        )}
                      </td>
                    </tr>
                  )}
                </>
              )}
              <tr className="border-t-2 border-border">
                <td colSpan={8} className="px-4 py-3 text-right font-bold">Total</td>
                <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ),
    },
    {
      id: "overview",
      label: "Details",
      render: () => {
        const sourceLabel = (invoice as any).source_label || "New";
        return (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Invoice Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Invoice Number", invoice.invoice_number],
                  ["Customer", invoice.customer_name || "—"],
                  ["Invoice Date", invoice.invoice_date],
                  ["Due Date", invoice.due_date],
                  ["Discount %", (invoice as any).overall_discount_percent ? `${(invoice as any).overall_discount_percent}%` : "—"],
                  ["Tax %", (invoice as any).overall_tax_percent ? `${(invoice as any).overall_tax_percent}%` : "—"],
                  ["Status", invoice.status],
                  ["Payment Method", invoice.payment_method || "—"],
                  ["Notes", invoice.notes || "—"],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Source & Origin</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Source", sourceLabel],
                  ["Created By", (invoice as any).created_by_label || invoice.created_by_name || "—"],
                  ["Created At", new Date(invoice.created_at).toLocaleString()],
                  ["Modified By", invoice.updated_by_name || "—"],
                  ["Modified At", new Date(invoice.updated_at).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      },
    },
  ];

  if (relatedItems.length > 0) {
    tabs.push({
      id: "related",
      label: "Related",
      count: relatedItems.length,
      render: () => <RelatedRecords items={relatedItems} />,
    });
  }

  const editLogs = auditLogs?.filter((l) => l.action === "UPDATE") || [];

  tabs.push({
    id: "activity",
    label: "Activity",
    count: activityLog?.length || 0,
    render: () => {
      if (activityLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading activity...</div>;
      }
      if (!activityLog || activityLog.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Clock className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No activity recorded yet.</p>
          </div>
        );
      }

      const colorMap: Record<string, string> = {
        success: "bg-success/10 text-success border-success/20",
        warning: "bg-warning/10 text-warning border-warning/20",
        destructive: "bg-destructive/10 text-destructive border-destructive/20",
        info: "bg-info/10 text-info border-info/20",
      };

      const iconMap: Record<string, React.ReactNode> = {
        plus: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
        "check-circle": <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        edit: <Edit className="w-4 h-4" />,
        "dollar-sign": <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        undo: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
        "rotate-ccw": <RotateCcw className="w-4 h-4" />,
        "x-circle": <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      };

      return (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border/60" />

          <div className="space-y-0">
            {activityLog.map((event, idx) => (
              <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Timeline dot */}
                <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 shrink-0 ${colorMap[event.color] || colorMap.info}`}>
                  {iconMap[event.icon] || <Clock className="w-4 h-4" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {event.amount && (
                        <p className={`text-sm font-bold ${event.type === 'payment' ? 'text-success' : event.type === 'return' || event.type === 'payment_refund' ? 'text-destructive' : 'text-foreground'}`}>
                          {event.type === 'payment' ? '+' : event.type === 'return' || event.type === 'payment_refund' ? '-' : ''}{formatCurrency(Number(event.amount))}
                        </p>
                      )}
                      {event.status && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border mt-1 ${
                          event.status === 'CONFIRMED' || event.status === 'COMPLETED' ? 'bg-success/10 text-success border-success/20' :
                          event.status === 'DRAFT' ? 'bg-muted text-muted-foreground border-border' :
                          'bg-warning/10 text-warning border-warning/20'
                        }`}>
                          {event.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  {event.details && event.details.length > 0 && (
                    <div className="mt-2 rounded-lg bg-muted/30 border border-border/40 px-3 py-2">
                      {event.details.map((d, di) => (
                        <div key={di} className="flex items-center justify-between text-xs py-0.5 border-b border-border/20 last:border-0">
                          <span className="text-muted-foreground">{d.label}</span>
                          <span className="font-medium text-foreground">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* User & time */}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {event.user}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    },
  });

  const getStatusColor = (status: string): "success" | "warning" | "destructive" | "info" => {
    if (isRefunded) return "destructive";
    switch (status) {
      case "PAID": return "success";
      case "UNPAID": return "warning";
      case "PARTIAL": return "warning";
      case "DRAFT": return "info";
      case "PENDING": return "warning";
      case "SENT": return "info";
      case "CANCELLED": return "destructive";
      default: return "info";
    }
  };

  return (
    <>
      <DetailLayout
        breadcrumbs={
          moduleCode === "FINANCE"
            ? ["Receivables", "Customer Invoices", invoice.invoice_number]
            : ["Sales", "Invoices", invoice.invoice_number]
        }
        entityId={invoice.invoice_number}
        title={
          invoice.status === "CANCELLED"
            ? `❌ CANCELLED — ${invoice.customer_name || "Customer"} — ${invoice.invoice_number}`
            : `${invoice.customer_name || "Customer"} — ${invoice.invoice_number}`
        }
        status={invoice.status === "CANCELLED" ? "CANCELLED" : isRefunded ? "REFUNDED" : invoice.payment_status || "UNPAID"}
        subtitle={
          invoice.status === "CANCELLED"
            ? `Cancelled${invoice.cancelled_at ? ` on ${new Date(invoice.cancelled_at).toLocaleDateString()}` : ""}${invoice.cancelled_by_name ? ` by ${invoice.cancelled_by_name}` : ""}${invoice.notes?.includes("Cancelled by") ? ` — ${invoice.notes.split("\n").filter((l: string) => l.includes("Cancelled by")).pop()}` : ""}`
            : `Issued ${invoice.invoice_date} · Due ${invoice.due_date}`
        }
        data={invoice}
        meta={[
          { label: "Customer", value: invoice.customer_name || "-" },
          { label: "Due Date", value: invoice.due_date },
        ]}
        summary={[
          { label: "Invoice Total", value: formatCurrency(amount), tone: "info", isCurrency: true },
          { label: "Paid", value: formatCurrency(paidAmount), tone: "success", sub: `${((paidAmount / amount) * 100).toFixed(1)}% paid`, isCurrency: true },
          { label: "Outstanding", value: formatCurrency(outstanding), tone: outstanding > 0 ? "warning" : "success", isCurrency: true },
          { label: "Due Date", value: invoice.due_date, isCurrency: false },
          ...(isRefunded ? [{
            label: "Refunded",
            value: formatCurrency(invoice.payments?.filter((p: any) => p.payment_type === "PAYMENT" && p.status === "CONFIRMED").reduce((s: number, p: any) => s + Number(p.amount), 0) || 0),
            tone: "destructive" as const,
            isCurrency: true,
          }] : []),
        ]}
        primaryActionLabel={canReturn ? "Return & Refund" : canSend ? "Send Invoice" : canPay ? "Pay Invoice" : undefined}
        onPrimaryAction={canReturn ? handleReturnToRefund : canSend ? handleSend : canPay ? handlePay : undefined}
        onEdit={canEdit ? handleEdit : undefined}
        onDelete={canCancel ? handleCancel : undefined}
        deleteLabel="Cancel Invoice"
        onPrint={handlePrint}
        onExport={handleExportPdf}
        permissions={{ edit: canEdit, submit: canReturn || canSend || canPay }}
        tabs={tabs}
        sidebar={
          <div className="space-y-4">
            <StandardSidebar
              riskIndicators={[
                { label: "High value", value: amount > 50000 ? "> $50k" : "Within limit", tone: amount > 50000 ? "warning" : "success" },
                { label: "Outstanding", value: outstanding > 0 ? `${formatCurrency(outstanding)} due` : "Fully paid", tone: outstanding > 0 ? "warning" : "success" },
                { label: "Overdue", value: new Date(invoice.due_date) < new Date() && outstanding > 0 ? "Yes" : "No", tone: new Date(invoice.due_date) < new Date() && outstanding > 0 ? "destructive" : "success" },
                { label: "Source", value: (invoice as any).source_label || "New", tone: "info" },
              ]}
              metadata={[
                ["Invoice #", invoice.invoice_number],
                ["Created", new Date(invoice.created_at).toLocaleString()],
                ["Created By", (invoice as any).created_by_label || invoice.created_by_name || "—"],
                ["Modified", new Date(invoice.updated_at).toLocaleString()],
                ["Modified By", invoice.updated_by_name || "—"],
                ["Source", (invoice as any).source_label || "New"],
                ["Customer", invoice.customer_name || "—"],
                ["Payment Status", invoice.payment_status || "—"],
                ["Due Date", invoice.due_date],
              ]}
            />
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              {canSend && (
                <button
                  onClick={handleSend}
                  disabled={sendInvoice.isPending}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {sendInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send Invoice
                </button>
              )}
              {canPay && (
                <button
                  onClick={handlePay}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition"
                >
                  <Receipt className="w-4 h-4" /> Record Payment
                </button>
              )}
            </div>
          </div>
        }
        currencyFormatter={formatCurrency}
      />
      <CustomerInvoiceFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingInvoice(null);
        }}
        initialData={editingInvoice}
        onSuccess={handleUpdateSuccess}
      />

      {invoice && (
        <PayAmountModal
          open={payModalOpen}
          onClose={() => setPayModalOpen(false)}
          title="Receive Payment"
          documentLabel="Invoice"
          documentNumber={invoice.invoice_number}
          subtitle={invoice.customer_name ? `Customer: ${invoice.customer_name}` : undefined}
          totalAmount={toNumber(invoice.amount)}
          paidAmount={toNumber(invoice.paid_amount || 0)}
          outstanding={toNumber(invoice.outstanding || 0)}
          paymentStatus={invoice.payment_status || "UNPAID"}
          isPending={payInvoice.isPending}
          onSubmit={async (data) => {
            await payInvoice.mutateAsync({
              id: invoice.id,
              body: {
                amount: data.amount,
                payment_method: data.payment_method,
                payment_date: data.payment_date,
                reference_number: data.reference_number,
              },
            });
            setPayModalOpen(false);
            refetch();
          }}
        />
      )}
      {invoice && companySettings && (
        <PrintPreviewModal
          open={showPrintPreview}
          onClose={() => setShowPrintPreview(false)}
          documentProps={{
            data: {
              type: "INVOICE",
              documentNumber: invoice.invoice_number,
              date: invoice.invoice_date,
              dueDate: invoice.due_date,
              customerName: invoice.customer_name || "—",
              customerEmail: (invoice as any).customer_email || "",
              customerPhone: (invoice as any).customer_phone || "",
              lines: (invoice.lines || []).map((l) => ({
                variant_name: l.variant_name,
                variant_sku: l.variant_sku,
                quantity: l.quantity,
                unit_price: l.unit_price,
                tax_rate: l.tax_rate,
                discount_amount: l.discount_amount,
              })),
              totalAmount: toNumber(invoice.amount),
              overallDiscountPercent: Number((invoice as any).overall_discount_percent || 0),
              overallTaxPercent: Number((invoice as any).overall_tax_percent || 0),
              status: invoice.status,
              paymentStatus: invoice.payment_status,
              notes: invoice.notes,
            },
            company: {
              companyName: companySettings.companyName,
              address: companySettings.address,
              city: companySettings.city,
              state: companySettings.state,
              country: companySettings.country,
              phone: companySettings.phone,
              email: companySettings.email,
              taxId: companySettings.taxId,
              logo: (companySettings as any).logo || "",
              logoUrl: (companySettings as any).logo
                ? `${process.env.NEXT_PUBLIC_API_URL}${(companySettings as any).logo}`
                : "",
            },
            termsContent: termsData?.invoice || "",
            formatCurrency,
          }}
        />
      )}

      <InvoiceCancelModal
        open={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setCancelReason("");
        }}
        invoiceNumber={invoice.invoice_number}
        paidAmount={paidAmount}
        requiresRefund={invoice.payment_status === "PAID"}
        reason={cancelReason}
        isSubmitting={refundPayments.isPending || cancelInvoice.isPending}
        lines={(invoice.lines || []).map((l: any) => ({
          id: l.id,
          name: l.variant_name || l.manual_variant_name || "Item",
          quantity: l.quantity,
          unit_price: l.unit_price,
          is_manual_entry: l.is_manual_entry,
        }))}
        onConfirm={handleConfirmCancel}
      />
    </>
  );
}