"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DetailLayout, StandardSidebar, RelatedRecords, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { useCustomerInvoice, useUpdateCustomerInvoice, usePayCustomerInvoice } from "@/hooks/finance/useCustomerInvoices";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useCompanySettingsQuery } from "@/hooks/useCompanySettings";
import { useTermsAndConditions } from "@/hooks/useTermsAndConditions";
import { PrintPreviewModal } from "@/components/common/QuoteInvoiceDocument";
import { StatusBadge } from "@/components/finance/ui";
import CustomerInvoiceFormModal from "./CustomerInvoiceFormModal";
import { FileText, Send, Printer, Download, Share2, Receipt } from "lucide-react";

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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [posting, setPosting] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

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
    setPosting(true);
    try {
      await payInvoice.mutateAsync({ id: invoice.id });
      refetch();
    } finally {
      setPosting(false);
    }
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
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right font-semibold">Subtotal</td>
                <td className="px-4 py-3 text-right">{formatCurrency(amount)}</td>
              </tr>
              <tr className="border-t border-border/60">
                <td colSpan={5} className="px-4 py-3 text-right font-semibold">Tax</td>
                <td className="px-4 py-3 text-right">{formatCurrency(amount * 0.08)}</td>
              </tr>
              <tr className="border-t border-border/60">
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
      render: () => (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Invoice Number", invoice.invoice_number],
            ["Customer", invoice.customer_name || "—"],
            ["Invoice Date", invoice.invoice_date],
            ["Due Date", invoice.due_date],
            ["Status", invoice.status],
            ["Source", invoice.source || "Manual"],
            ["Payment Method", invoice.payment_method || "—"],
            ["Created", new Date(invoice.created_at).toLocaleDateString()],
            ["Last Updated", new Date(invoice.updated_at).toLocaleDateString()],
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

  if (relatedItems.length > 0) {
    tabs.push({
      id: "related",
      label: "Related",
      count: relatedItems.length,
      render: () => <RelatedRecords items={relatedItems} />,
    });
  }

  tabs.push({
    id: "payment",
    label: "Payment History",
    count: 0,
    render: () => (
      <div className="text-center py-8 text-muted-foreground">
        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Payment history will appear here</p>
        {canRecordPayment && (
          <button
            onClick={() => router.push(`/finance/payments/new?invoice=${invoice.id}`)}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          >
            Record Payment
          </button>
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
        subtitle={`Issued ${invoice.invoice_date} · Due ${invoice.due_date} · USD`}
        data={invoice}
        meta={[
          { label: "Customer", value: invoice.customer_name || "-" },
          { label: "Due Date", value: invoice.due_date },
          { label: "Currency", value: "USD" },
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
            ]}
            metadata={[
              ["Created", new Date(invoice.created_at).toLocaleString()],
              ["Created by", invoice.created_by_name || "System"],
              ["Modified", new Date(invoice.updated_at).toLocaleString()],
              ["Modified by", invoice.updated_by_name || "System"],
              ["Source", invoice.source || "Manual"],
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
            },
            termsContent: termsData?.invoice || "",
            formatCurrency,
          }}
        />
      )}
    </>
  );
}