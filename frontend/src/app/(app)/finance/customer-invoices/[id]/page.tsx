"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { DetailLayout, StandardSidebar, ApprovalTimeline, RelatedRecords } from "@/components/reuseable/final/DetailLayout";
import { useCustomerInvoice, useUpdateCustomerInvoice } from "@/hooks/finance/useCustomerInvoices";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";
import CustomerInvoiceFormModal from "@/components/finance/customer-invoices/CustomerInvoiceFormModal";

// Helper function to convert string|number to number
const toNumber = (value: number | string): number => {
  return typeof value === "string" ? parseFloat(value) : value;
};

// Example chart data – you would fetch this from your API
const revenueData = [
  { month: "Jan", amount: 48200 },
  { month: "Feb", amount: 51900 },
  { month: "Mar", amount: 54800 },
  { month: "Apr", amount: 59200 },
  { month: "May", amount: 63100 },
  { month: "Jun", amount: 67800 },
];

const expenseData = [
  { category: "Payroll", amount: 31200 },
  { category: "Rent", amount: 8500 },
  { category: "Software", amount: 4200 },
  { category: "Marketing", amount: 3800 },
  { category: "Travel", amount: 2100 },
];

export default function CustomerInvoiceDetailPage() {
  const { id } = useParams();
  const { data: invoice, isLoading, refetch } = useCustomerInvoice(id as string);
  const updateInvoice = useUpdateCustomerInvoice();
  const permissions = useFeaturePermissions("FINANCE", "customerinvoice");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!invoice) return <div className="p-8 text-center">Invoice not found</div>;

  // Convert to numbers safely
const amount = toNumber(invoice.amount);
const paidAmount = toNumber(invoice.paid_amount);
const outstanding = toNumber(invoice.outstanding);

  const handleEdit = () => {
    setEditingInvoice(invoice);
    setModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    refetch(); // Refresh the detail page after update
    setModalOpen(false);
    setEditingInvoice(null);
  };

  const charts = [
    {
      id: "revenue-trend",
      title: "Revenue Trend",
      subtitle: "Last 6 months",
      type: "area" as const,
      data: revenueData,
      dataKeys: { x: "month", y: "amount" },
      height: 260,
      tooltipFormatter: (value: number) => formatCurrency(value),
    },
    {
      id: "expense-breakdown",
      title: "Expense Breakdown",
      type: "pie" as const,
      data: expenseData,
      dataKeys: { name: "category", value: "amount" },
      height: 260,
      tooltipFormatter: (value: number) => formatCurrency(value),
    },
  ];

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
          { label: "PO", value: "PO-9821" },
          { label: "Sales Rep", value: "K. Nakamura" },
          { label: "Project", value: invoice.sales_order || "-" },
        ]}
        summary={[
          { label: "Invoice Total", value: amount, tone: "info", isCurrency: true },
          { label: "Paid", value: paidAmount, tone: "success", sub: "Receipt pending", isCurrency: true },
          { label: "Outstanding", value: outstanding, tone: outstanding > 0 ? "warning" : "success", isCurrency: true },
          { label: "Due Date", value: invoice.due_date, sub: "Days remaining: 12", isCurrency: false },
        ]}
        charts={charts}
        tabs={[
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