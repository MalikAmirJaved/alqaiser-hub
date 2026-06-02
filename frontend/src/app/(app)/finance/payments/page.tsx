"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import {
  usePayments,
  useDeletePayment,
  paymentTypeLabels,
  paymentMethodLabels,
  type Payment,
} from "@/hooks/finance/usePayments";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { Plus, Pencil, Trash2 } from "lucide-react";
import PaymentFormModal from "@/components/finance/payments/PaymentFormModal";
import { formatCurrency } from "@/lib/currency";
import type { ReactNode } from "react";

const columns: Column[] = [
  { key: "payment_date", label: "Date", sortable: true },

  {
    key: "payment_type",
    label: "Type",
    render: (val: unknown): ReactNode =>
      paymentTypeLabels[val as keyof typeof paymentTypeLabels] ?? String(val),
  },

  {
    key: "payment_method",
    label: "Method",
    render: (val: unknown): ReactNode =>
      paymentMethodLabels[val as keyof typeof paymentMethodLabels] ?? String(val),
  },

  {
    key: "amount",
    label: "Amount",
    sortable: true,
    render: (val: unknown): ReactNode =>
      formatCurrency(Number(val)),
  },

  { key: "reference_number", label: "Reference" },

  {
    key: "supplier_bill",
    label: "Supplier Bill",
    render: (val: unknown, row: Record<string, unknown>): ReactNode =>
      (row.supplier_name as string) ||
      (val ? `Bill #${String(val)}` : ""),
  },

  {
    key: "customer_invoice",
    label: "Customer Invoice",
    render: (val: unknown, row: Record<string, unknown>): ReactNode =>
      (row.customer_name as string) ||
      (val ? `Invoice #${String(val)}` : ""),
  },
];

export default function PaymentsPage() {
  const permissions = useFeaturePermissions("FINANCE", "payment");

  const [typeFilter, setTypeFilter] =
    useState<"RECEIPT" | "PAYMENT" | "">("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: payments, isLoading } = usePayments({
    payment_type: typeFilter || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  });

  const deletePayment = useDeletePayment();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const handleDelete = (payment: Payment) => {
    confirm({
      title: "Delete Payment",
      message: `Are you sure you want to delete this ${
        payment.payment_type === "RECEIPT" ? "receipt" : "payment"
      }? This action cannot be undone.`,
      onConfirm: () => deletePayment.mutate(payment.id),
    });
  };

  const tableData =
    (payments || []).map((p) => ({ ...p })) as Record<string, unknown>[];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Payments"
        subtitle="Record receipts from customers and payments to suppliers"
        actions={
          <div className="flex flex-wrap gap-2">
            {permissions.create && (
              <button
                onClick={() => {
                  setEditingPayment(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                New Payment
              </button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as "RECEIPT" | "PAYMENT" | "")
          }
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        >
          <option value="">All Types</option>
          <option value="RECEIPT">Receipts (Customer)</option>
          <option value="PAYMENT">Payments (Supplier)</option>
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        />
      </div>

      <TableView
        columns={columns}
        data={tableData}
        loading={isLoading}
        actions={(row: Record<string, unknown>) => {
          const payment = payments?.find((p) => p.id === row.id);
          if (!payment) return null;

          return (
            <div className="flex items-center justify-end gap-1">
              {permissions.update && (
                <button
                  onClick={() => {
                    setEditingPayment(payment);
                    setModalOpen(true);
                  }}
                  className="p-1.5 rounded-md hover:bg-muted"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}

              {permissions.delete && (
                <button
                  onClick={() => handleDelete(payment)}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        }}
      />

      <PaymentFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingPayment(null);
        }}
        initialData={editingPayment}
      />

      <ConfirmModal />
    </div>
  );
}