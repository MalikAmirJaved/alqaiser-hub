"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DetailLayout, StandardSidebar, RelatedRecords, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { useCustomerInvoice, useUpdateCustomerInvoice, usePayCustomerInvoice, useCustomerInvoiceAuditLog } from "@/hooks/finance/useCustomerInvoices";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useCompanySettingsQuery } from "@/hooks/useCompanySettings";
import { useTermsAndConditions } from "@/hooks/useTermsAndConditions";
import { PrintPreviewModal } from "@/components/common/QuoteInvoiceDocument";
import { StatusBadge } from "@/components/finance/ui";
import CustomerInvoiceFormModal from "./CustomerInvoiceFormModal";
import PayAmountModal from "@/components/finance/PayAmountModal";
import { FileText, Send, Printer, Download, Share2, Receipt, Edit, User, Clock } from "lucide-react";

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
  const permissions = useFeaturePermissions(moduleCode, "customer_invoice");
  const { data: companySettings } = useCompanySettingsQuery();
  const { terms: termsData } = useTermsAndConditions();
  const { data: auditLogs, isLoading: auditLogsLoading } = useCustomerInvoiceAuditLog(id);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [posting, setPosting] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!invoice) return <div className="p-8 text-center">Invoice not found</div>;

  const amount = toNumber(invoice.amount);
  const paidAmount = toNumber(invoice.paid_amount);
  const outstanding = toNumber(invoice.outstanding);
  const canPay = invoice.payment_status !== "PAID" && invoice.status !== "CANCELLED";
  const canEdit = invoice.status === "DRAFT" && permissions.update && invoice.payment_status !== "PAID"
  const canDelete = invoice.status === "DRAFT" && permissions.delete;
  const canRecordPayment = canPay;

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

  const handlePrint = () => {
    setShowPrintPreview(true);
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
                <th className="px-4 py-2 text-right">Quantity</th>
                <th className="px-4 py-2 text-right">Unit Price</th>
                <th className="px-4 py-2 text-right">Discount</th>
                <th className="px-4 py-2 text-right">Tax</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines?.map((line, idx) => {
                const subtotal = line.quantity * line.unit_price;
                const discount = line.discount_amount || 0;
                const tax = (subtotal - discount) * (line.tax_rate / 100);
                const lineTotal = subtotal - discount + tax;
                return (
                  <tr key={idx} className="border-b border-border/60">
                    <td className="px-4 py-2">
                      <div className="font-medium">{line.variant_name || "Product"}</div>
                      <div className="text-xs text-muted-foreground">SKU: {line.variant_sku || "—"}</div>
                      {(line as any).description && (
                        <div className="text-xs text-muted-foreground/70 italic mt-0.5">{(line as any).description}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{line.quantity}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(line.unit_price)}</td>
                    <td className="px-4 py-2 text-right text-destructive">{discount > 0 ? formatCurrency(discount) : "—"}</td>
                    <td className="px-4 py-2 text-right">{line.tax_rate}%</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(lineTotal)}</td>
                  </tr>
                );
              })}
              {(!invoice.lines || invoice.lines.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No items in this invoice
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-border">
              {invoice.lines && invoice.lines.length > 0 && (
                <>
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-right text-sm text-muted-foreground">Subtotal</td>
                    <td className="px-4 py-2 text-right text-sm">
                      {formatCurrency(
                        invoice.lines.reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0)
                      )}
                    </td>
                  </tr>
                  {(invoice as any).overall_discount_percent > 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-2 text-right text-sm text-muted-foreground">
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
                      <td colSpan={5} className="px-4 py-2 text-right text-sm text-muted-foreground">
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
                <td colSpan={5} className="px-4 py-3 text-right font-bold">Total</td>
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
    id: "edit_history",
    label: "Edit History",
    count: editLogs.length,
    render: () => {
      if (auditLogsLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading edit history...</div>;
      }
      if (editLogs.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Edit className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No edit history recorded yet.</p>
          </div>
        );
      }
      return (
        <div className="space-y-4">
          {editLogs.map((log) => (
            <div key={log.id} className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-xs ${
                  log.action === "CREATE" ? "bg-success/15 text-success" :
                  log.action === "UPDATE" ? "bg-primary/15 text-primary" :
                  "bg-destructive/15 text-destructive"
                }`}>{log.action_display}</span>
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {log.user_name || "System"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
              {log.field_changes && log.field_changes.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/40">
                        <th className="px-3 py-1.5 text-left font-medium">Field</th>
                        <th className="px-3 py-1.5 text-left font-medium">Old Value</th>
                        <th className="px-3 py-1.5 text-left font-medium">New Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {log.field_changes.map((change) => (
                        <tr key={change.id} className="border-b border-border/20">
                          <td className="px-3 py-1.5 font-medium text-foreground">{change.field_name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground max-w-[200px] truncate">{change.old_value || "—"}</td>
                          <td className="px-3 py-1.5 text-foreground max-w-[200px] truncate">{change.new_value || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(!log.field_changes || log.field_changes.length === 0) && (
                <p className="text-xs text-muted-foreground">No field-level changes tracked for this action.</p>
              )}
            </div>
          ))}
        </div>
      );
    },
  });

  tabs.push({
    id: "payment",
    label: "Payment History",
    count: invoice.payments?.length || 0,
    render: () => (
      <div>
        {(!invoice.payments || invoice.payments.length === 0) ? (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No payments recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Method</th>
                  <th className="px-4 py-2 text-left">Reference</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="px-4 py-2">{p.payment_date}</td>
                    <td className="px-4 py-2">{p.payment_method}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.reference_number || "—"}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(Number(p.amount))}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${
                        p.status === "CONFIRMED" ? "bg-success/15 text-success" : "bg-muted/40 text-muted-foreground"
                      }`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canRecordPayment && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setPayModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
            >
              Record Payment
            </button>
          </div>
        )}
      </div>
    ),
  });

  const getStatusColor = (status: string): "success" | "warning" | "destructive" | "info" => {
    switch (status) {
      case "PAID": return "success";
      case "UNPAID": return "warning";
      case "PARTIAL": return "warning";
      case "DRAFT": return "warning";
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
        title={`${invoice.customer_name || "Customer"} — ${invoice.invoice_number}`}
        status={invoice.payment_status || "UNPAID"}
        subtitle={`Issued ${invoice.invoice_date} · Due ${invoice.due_date}`}
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
        ]}
        primaryActionLabel={canPay ? "Pay Invoice" : undefined}
        onPrimaryAction={canPay ? handlePay : undefined}
        onEdit={canEdit ? handleEdit : undefined}
        onPrint={handlePrint}
        onExport={handleExportPdf}
        permissions={{ edit: canEdit, submit: canPay }}
        tabs={tabs}
        sidebar={
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
    </>
  );
}