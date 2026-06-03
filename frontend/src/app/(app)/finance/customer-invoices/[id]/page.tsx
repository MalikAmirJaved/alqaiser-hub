"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { DetailLayout, StandardSidebar, RelatedRecords, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { useCustomerInvoice, useUpdateCustomerInvoice } from "@/hooks/finance/useCustomerInvoices";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";
import CustomerInvoiceFormModal from "@/components/finance/customer-invoices/CustomerInvoiceFormModal";

const toNumber = (value: number | string): number => {
  return typeof value === "string" ? parseFloat(value) : value;
};

export default function CustomerInvoiceDetailPage() {
  const { id } = useParams();
  const { data: invoice, isLoading, refetch } = useCustomerInvoice(id as string);
  const permissions = useFeaturePermissions("FINANCE", "customerinvoice");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!invoice) return <div className="p-8 text-center">Invoice not found</div>;

  const amount = toNumber(invoice.amount);
  const paidAmount = toNumber(invoice.paid_amount);
  const outstanding = toNumber(invoice.outstanding);

  const handleEdit = () => {
    setEditingInvoice(invoice);
    setModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    refetch();
    setModalOpen(false);
    setEditingInvoice(null);
  };

  // Build related records from real data (explicitly typed)
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
      type: "Journal",
      title: "Journal entry",
      status: "Posted",
    });
  }

  const tabs: DetailTab[] = [
    {
      id: "overview",
      label: "Overview",
      render: () => (
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
  ];

  if (relatedItems.length > 0) {
    tabs.push({
      id: "related",
      label: "Related",
      count: relatedItems.length,
      render: () => <RelatedRecords items={relatedItems} />,
    });
  }

  return (
    <>
      <DetailLayout
        breadcrumbs={["Receivables", "Customer Invoices", invoice.invoice_number]}
        entityId={invoice.invoice_number}
        title={`${invoice.customer_name || "Customer"} — ${invoice.invoice_number}`}
        status={invoice.status}
        subtitle={`Issued ${invoice.invoice_date} · Net 30 · USD`}
        data={invoice}
        meta={[
          { label: "Customer", value: invoice.customer_name || "-" },
          { label: "Due Date", value: invoice.due_date },
          { label: "Currency", value: "USD" },
        ]}
        summary={[
          { label: "Invoice Total", value: amount, tone: "info", isCurrency: true },
          { label: "Paid", value: paidAmount, tone: "success", sub: "Receipt pending", isCurrency: true },
          { label: "Outstanding", value: outstanding, tone: outstanding > 0 ? "warning" : "success", isCurrency: true },
          { label: "Due Date", value: invoice.due_date, isCurrency: false },
        ]}
        tabs={tabs}
        sidebar={
          <StandardSidebar
            riskIndicators={[
              { label: "High value", value: amount > 50000 ? "> $50k" : "Within limit", tone: amount > 50000 ? "warning" : "success" },
              { label: "Foreign currency", value: "No", tone: "success" },
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
        onEdit={handleEdit}
        permissions={{ edit: permissions.update, submit: permissions.create }}
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
    </>
  );
}