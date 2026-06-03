"use client";

import { useParams } from "next/navigation";
import { DetailLayout, StandardSidebar, ApprovalTimeline, RelatedRecords } from "@/components/reuseable/final/DetailLayout";
import { useCustomerInvoice } from "@/hooks/finance/useCustomerInvoices";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";

export default function CustomerInvoiceDetailPage() {
  const { id } = useParams();
  const { data: invoice, isLoading } = useCustomerInvoice(id as string);
  const permissions = useFeaturePermissions("FINANCE", "customerinvoice");

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!invoice) return <div className="p-8 text-center">Invoice not found</div>;

  // Convert string amounts to numbers
  const amount = typeof invoice.amount === "string" ? parseFloat(invoice.amount) : invoice.amount;
  const paidAmount = typeof invoice.paid_amount === "string" ? parseFloat(invoice.paid_amount) : invoice.paid_amount;
  const outstanding = typeof invoice.outstanding === "string" ? parseFloat(invoice.outstanding) : invoice.outstanding;

  return (
    <DetailLayout
      breadcrumbs={["Receivables", "Customer Invoices", invoice.invoice_number]}
      entityId={invoice.invoice_number}
      title={`${invoice.customer_name || "Customer"} — ${invoice.invoice_number}`}
      status={invoice.status}
      subtitle={`Issued ${invoice.invoice_date} · Net 30 · USD`}
      data={invoice}
      meta={[
        { label: "Customer", value: invoice.customer_name || "-" },
        { label: "PO", value: "PO-9821" },
        { label: "Sales Rep", value: "K. Nakamura" },
        { label: "Project", value: invoice.sales_order || "-" },
      ]}
      summary={[
        { label: "Invoice Total", value: amount, tone: "info", isCurrency: true },
        { label: "Paid", value: paidAmount, tone: "success", sub: "Receipt pending", isCurrency: true },
        { label: "Outstanding", value: outstanding, tone: outstanding > 0 ? "warning" : "success", isCurrency: true },
        { label: "Due Date", value: invoice.due_date, sub: "Days remaining: 12", isCurrency: false },  // NOT currency
      ]}
      tabs={[
        {
          id: "overview",
          label: "Overview",
          render: (inv) => (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(amount)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Tax (8%)</span>
                <span>{formatCurrency(amount * 0.08)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Discount</span>
                <span>—</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatCurrency(amount)}</span>
              </div>
            </div>
          ),
        },
        {
          id: "approval",
          label: "Approvals",
          render: () => (
            <ApprovalTimeline
              steps={[
                { step: "Submitted", who: "Sara Romero", when: "Jun 2, 14:22", state: "done" },
                { step: "Finance Review", who: "M. Hughes", when: "—", state: "current" },
              ]}
            />
          ),
        },
        {
          id: "related",
          label: "Related",
          count: 2,
          render: () => (
            <RelatedRecords
              items={[
                {
                  id: invoice.sales_order || "-",
                  type: "Sales Order",
                  title: "Sales order reference",
                  amount: formatCurrency(amount),
                  status: "Active",
                },
                {
                  id: invoice.journal_entry ? String(invoice.journal_entry) : "-",
                  type: "Journal",
                  title: "Journal entry",
                  status: "Posted",
                },
              ]}
            />
          ),
        },
      ]}
      sidebar={
        <StandardSidebar
          approvers={
            <ApprovalTimeline
              steps={[
                { step: "Submitted", who: "Sara Romero", when: "Jun 2, 14:22", state: "done" },
                { step: "Finance Review", who: "M. Hughes", when: "—", state: "current" },
              ]}
            />
          }
          riskIndicators={[
            { label: "High value", value: "> $50k", tone: "warning" },
            { label: "Foreign currency", value: "No", tone: "success" },
            { label: "Segregation check", value: "Compliant", tone: "success" },
          ]}
          metadata={[
            ["Created", new Date(invoice.created_at).toLocaleString()],
            ["Created by", String(invoice.created_by || "-")],
            ["Modified", new Date(invoice.updated_at).toLocaleString()],
            ["Source", "Manual"],
          ]}
        />
      }
      onPrimaryAction={() => (window.location.href = `/finance/payments/new?invoice=${invoice.id}`)}
      onEdit={() => { }}
      permissions={{ edit: permissions.update, submit: permissions.create }}
      currencyFormatter={formatCurrency}
    />
  );
}