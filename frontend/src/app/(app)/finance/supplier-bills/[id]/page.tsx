"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DetailLayout, StandardSidebar, ApprovalTimeline, RelatedRecords } from "@/components/reuseable/final/DetailLayout";
import { useSupplierBill, useUpdateSupplierBill } from "@/hooks/finance/useSupplierBills";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";
import SupplierBillFormModal from "@/components/finance/supplier-bills/SupplierBillFormModal";

const toNumber = (value: number | string): number => {
  return typeof value === "string" ? parseFloat(value) : value;
};

// Example chart data (you can replace with real API data)
const paymentTrendData = [
  { month: "Jan", paid: 12500, due: 15000 },
  { month: "Feb", paid: 13800, due: 14200 },
  { month: "Mar", paid: 14200, due: 14800 },
  { month: "Apr", paid: 15600, due: 16000 },
  { month: "May", paid: 16800, due: 16500 },
  { month: "Jun", paid: 17200, due: 17000 },
];

export default function SupplierBillDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: bill, isLoading, refetch } = useSupplierBill(id as string);
  const updateBill = useUpdateSupplierBill();
  const permissions = useFeaturePermissions("FINANCE", "supplierbill");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any>(null);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!bill) return <div className="p-8 text-center">Bill not found</div>;

  const amount = toNumber(bill.amount);
  const paidAmount = toNumber(bill.paid_amount);
  const outstanding = toNumber(bill.outstanding);

  const handleEdit = () => {
    setEditingBill(bill);
    setModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    refetch();
    setModalOpen(false);
    setEditingBill(null);
  };

  const charts = [
    {
      id: "payment-trend",
      title: "Payment Trend",
      subtitle: "Paid vs Due (last 6 months)",
      type: "bar" as const,
      data: paymentTrendData,
      dataKeys: { x: "month", y: ["paid", "due"] },
      height: 260,
      tooltipFormatter: (value: number) => formatCurrency(value),
    },
  ];

  return (
    <>
      <DetailLayout
        breadcrumbs={["Payables", "Supplier Bills", bill.bill_number]}
        entityId={bill.bill_number}
        title={`${bill.supplier_name || "Supplier"} — ${bill.bill_number}`}
        status={bill.status}
        subtitle={`Issued ${bill.bill_date} · Net 30 · USD`}
        data={bill}
        meta={[
          { label: "Supplier", value: bill.supplier_name || "-" },
          { label: "PO Reference", value: bill.purchase_order || "-" },
          { label: "Category", value: "Inventory" },
          { label: "Payment Terms", value: "Net 30" },
        ]}
        summary={[
          { label: "Bill Total", value: amount, tone: "info", isCurrency: true },
          { label: "Paid", value: paidAmount, tone: "success", sub: "Last payment: Jun 5", isCurrency: true },
          { label: "Outstanding", value: outstanding, tone: outstanding > 0 ? "warning" : "success", isCurrency: true },
          { label: "Due Date", value: bill.due_date, sub: `${Math.ceil((new Date(bill.due_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24))} days remaining`, isCurrency: false },
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
            id: "line-items",
            label: "Line Items",
            count: 2,
            render: () => (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-2 py-2 text-left">SKU</th>
                      <th className="px-2 py-2 text-left">Description</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Unit Price</th>
                      <th className="px-2 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/60">
                      <td className="px-2 py-2 font-mono">PROD-001</td>
                      <td className="px-2 py-2">Raw materials</td>
                      <td className="px-2 py-2 text-right">100</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(amount / 100)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            id: "payment-history",
            label: "Payment History",
            render: () => (
              <div className="text-sm text-muted-foreground">No payments recorded yet</div>
            ),
          },
          {
            id: "approval",
            label: "Approvals",
            render: () => (
              <ApprovalTimeline
                steps={[
                  { step: "Submitted", who: "Procurement Team", when: bill.created_at.split("T")[0], state: "done" },
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
                    id: bill.purchase_order || "-",
                    type: "Purchase Order",
                    title: "PO reference",
                    amount: formatCurrency(amount),
                    status: "Approved",
                  },
                  {
                    id: bill.journal_entry ? String(bill.journal_entry) : "-",
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
                  { step: "Submitted", who: "Procurement Team", when: bill.created_at.split("T")[0], state: "done" },
                  { step: "Finance Review", who: "M. Hughes", when: "—", state: "current" },
                ]}
              />
            }
            riskIndicators={[
              { label: "High value", value: amount > 50000 ? "> $50k" : "Within limit", tone: amount > 50000 ? "warning" : "success" },
              { label: "Foreign currency", value: "No", tone: "success" },
              { label: "Segregation check", value: "Compliant", tone: "success" },
            ]}
            metadata={[
              ["Created", new Date(bill.created_at).toLocaleString()],
              ["Created by", String(bill.created_by || "-")],
              ["Modified", new Date(bill.updated_at).toLocaleString()],
              ["Source", "Manual"],
            ]}
          />
        }
        onPrimaryAction={() => router.push(`/finance/payments/new?bill=${bill.id}`)}
        onEdit={handleEdit}
        permissions={{ edit: permissions.update, submit: permissions.create }}
        currencyFormatter={formatCurrency}
      />
      <SupplierBillFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingBill(null);
        }}
        initialData={editingBill}
        onSuccess={handleUpdateSuccess}
      />
    </>
  );
}