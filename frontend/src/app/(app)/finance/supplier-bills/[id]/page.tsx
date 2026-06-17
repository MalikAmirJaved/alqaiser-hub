"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DetailLayout, StandardSidebar, RelatedRecords, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { useSupplierBill, useUpdateSupplierBill } from "@/hooks/finance/useSupplierBills";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import SupplierBillFormModal from "@/components/finance/supplier-bills/SupplierBillFormModal";

const toNumber = (value: number | string): number => {
  return typeof value === "string" ? parseFloat(value) : value;
};

export default function SupplierBillDetailPage() {
    const formatCurrency = useFormatCurrency();
  const { id } = useParams();
  const router = useRouter();
  const { data: bill, isLoading, refetch } = useSupplierBill(id as string);
  const permissions = useFeaturePermissions("FINANCE", "supplier_bill");

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

  // Build related records with explicit typing
  const relatedItems: { id: string; type: string; title: string; amount?: string; status?: string }[] = [];
  if (bill.purchase_order) {
    relatedItems.push({
      id: bill.purchase_order,
      type: "Purchase Order",
      title: "PO reference",
      amount: formatCurrency(amount),
      status: "Approved",
    });
  }
  if (bill.journal_entry) {
    relatedItems.push({
      id: String(bill.journal_entry),
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
        breadcrumbs={["Payables", "Supplier Bills", bill.bill_number]}
        entityId={bill.bill_number}
        title={`${bill.supplier_name || "Supplier"} — ${bill.bill_number}`}
        status={bill.status}
        subtitle={`Issued ${bill.bill_date} · Net 30 · USD`}
        data={bill}
        meta={[
          { label: "Supplier", value: bill.supplier_name || "-" },
          { label: "PO Reference", value: bill.purchase_order || "-" },
          { label: "Due Date", value: bill.due_date },
        ]}
        summary={[
          { label: "Bill Total", value: amount, tone: "info", isCurrency: true },
          { label: "Paid", value: paidAmount, tone: "success", sub: "Receipt pending", isCurrency: true },
          { label: "Outstanding", value: outstanding, tone: outstanding > 0 ? "warning" : "success", isCurrency: true },
          { label: "Due Date", value: bill.due_date, isCurrency: false },
        ]}
        tabs={tabs}
        sidebar={
          <StandardSidebar
            riskIndicators={[
              { label: "High value", value: amount > 50000 ? "> $50k" : "Within limit", tone: amount > 50000 ? "warning" : "success" },
              { label: "Foreign currency", value: "No", tone: "success" },
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
        permissions={{ view: true }}
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