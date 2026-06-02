"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import {
  useSupplierBills,
  useDeleteSupplierBill,
  usePostSupplierBill,
  type SupplierBill,
} from "@/hooks/finance/useSupplierBills";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { Plus, Pencil, Trash2, Send, Eye } from "lucide-react";
import SupplierBillFormModal from "@/components/finance/supplier-bills/SupplierBillFormModal";
import { formatCurrency } from "@/lib/currency";
import type { ReactNode } from "react";

const statusColors: Record<SupplierBill["status"], string> = {
  DRAFT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  POSTED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  PARTIAL: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const columns: Column[] = [
  { key: "bill_number", label: "Bill #", sortable: true },
  { key: "supplier_name", label: "Supplier", sortable: true },
  { key: "bill_date", label: "Bill Date", sortable: true },
  { key: "due_date", label: "Due Date", sortable: true },
  {
    key: "amount",
    label: "Amount",
    sortable: true,
    render: (val: unknown) => formatCurrency(Number(val)),
  },
  {
    key: "paid_amount",
    label: "Paid",
    render: (val: unknown) => formatCurrency(Number(val)),
  },
  {
    key: "outstanding",
    label: "Outstanding",
    render: (val: unknown) => {
      const outstanding = Number(val);
      return (
        <span className={outstanding > 0 ? "font-semibold text-destructive" : "text-success"}>
          {formatCurrency(outstanding)}
        </span>
      );
    },
  },
  {
    key: "status",
    label: "Status",
    render: (val: unknown) => {
      const status = val as SupplierBill["status"];
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
          {status}
        </span>
      );
    },
  },
];

export default function SupplierBillsPage() {
  const permissions = useFeaturePermissions("FINANCE", "supplierbill");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const { data: bills, isLoading } = useSupplierBills({
    status: statusFilter || undefined,
    supplier: supplierFilter ? Number(supplierFilter) : undefined,
  });
  const { data: suppliers } = useSuppliers();
  const deleteBill = useDeleteSupplierBill();
  const postBill = usePostSupplierBill();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<SupplierBill | null>(null);

  const handleDelete = (bill: SupplierBill) => {
    confirm({
      title: "Delete Supplier Bill",
      message: `Are you sure you want to delete bill "${bill.bill_number}"? This action cannot be undone.`,
      onConfirm: () => deleteBill.mutate(bill.id),
    });
  };

  const handlePost = (bill: SupplierBill) => {
    confirm({
      title: "Post Bill",
      message: `Are you sure you want to post bill "${bill.bill_number}"? This will create journal entries and cannot be reversed.`,
      onConfirm: () => postBill.mutate(bill.id),
      type: "warning",
      confirmText: "Yes, Post",
    });
  };

  const tableData = (bills || []).map((b) => ({ ...b })) as Record<string, unknown>[];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Supplier Bills"
        subtitle="Manage bills from your suppliers (accounts payable)"
        actions={
          <div className="flex flex-wrap gap-2">
            {permissions.create && (
              <button
                onClick={() => {
                  setEditingBill(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                New Bill
              </button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="POSTED">Posted</option>
          <option value="PARTIAL">Partially Paid</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        >
          <option value="">All Suppliers</option>
          {suppliers?.map((sup) => (
            <option key={sup.id} value={sup.id}>
              {sup.name}
            </option>
          ))}
        </select>
      </div>

      <TableView
        columns={columns}
        data={tableData}
        loading={isLoading}
        actions={(row: Record<string, unknown>) => {
          const bill = bills?.find((b) => b.id === row.id);
          if (!bill) return null;
          return (
            <div className="flex items-center justify-end gap-1">
              {bill.status === "DRAFT" && permissions.update && (
                <>
                  <button
                    onClick={() => handlePost(bill)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                    title="Post Bill"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingBill(bill);
                      setModalOpen(true);
                    }}
                    className="p-1.5 rounded-md hover:bg-muted"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </>
              )}
              {permissions.delete && (
                <button
                  onClick={() => handleDelete(bill)}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        }}
      />

      <SupplierBillFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingBill(null);
        }}
        initialData={editingBill}
      />

      <ConfirmModal />
    </div>
  );
}