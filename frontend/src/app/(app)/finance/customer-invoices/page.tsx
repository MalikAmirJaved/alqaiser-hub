"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import {
  useCustomerInvoices,
  useDeleteCustomerInvoice,
  usePostCustomerInvoice,
  type CustomerInvoice,
} from "@/hooks/finance/useCustomerInvoices";
import { useCustomers } from "@/hooks/useCustomers";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { Plus, Pencil, Trash2, Send } from "lucide-react";
import CustomerInvoiceFormModal from "@/components/finance/customer-invoices/CustomerInvoiceFormModal";
import { formatCurrency } from "@/lib/currency";
import type { ReactNode } from "react";

const statusColors: Record<CustomerInvoice["status"], string> = {
  DRAFT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  POSTED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  PARTIAL: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const columns: Column[] = [
  { key: "invoice_number", label: "Invoice #", sortable: true },
  { key: "customer_name", label: "Customer", sortable: true },
  { key: "invoice_date", label: "Invoice Date", sortable: true },
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
      const status = val as CustomerInvoice["status"];
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
          {status}
        </span>
      );
    },
  },
];

export default function CustomerInvoicesPage() {
  const permissions = useFeaturePermissions("FINANCE", "customerinvoice");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const { data: invoices, isLoading } = useCustomerInvoices({
    status: statusFilter || undefined,
    customer: customerFilter ? Number(customerFilter) : undefined,
  });
  const { data: customers } = useCustomers();
  const deleteInvoice = useDeleteCustomerInvoice();
  const postInvoice = usePostCustomerInvoice();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<CustomerInvoice | null>(null);

  const handleDelete = (invoice: CustomerInvoice) => {
    confirm({
      title: "Delete Customer Invoice",
      message: `Are you sure you want to delete invoice "${invoice.invoice_number}"? This action cannot be undone.`,
      onConfirm: () => deleteInvoice.mutate(invoice.id),
    });
  };

  const handlePost = (invoice: CustomerInvoice) => {
    confirm({
      title: "Post Invoice",
      message: `Are you sure you want to post invoice "${invoice.invoice_number}"? This will create journal entries and cannot be reversed.`,
      onConfirm: () => postInvoice.mutate(invoice.id),
      type: "warning",
      confirmText: "Yes, Post",
    });
  };

  const tableData = (invoices || []).map((inv) => ({ ...inv })) as Record<string, unknown>[];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Customer Invoices"
        subtitle="Manage invoices issued to customers (accounts receivable)"
        actions={
          <div className="flex flex-wrap gap-2">
            {permissions.create && (
              <button
                onClick={() => {
                  setEditingInvoice(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                New Invoice
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
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        >
          <option value="">All Customers</option>
          {customers?.map((cust) => (
            <option key={cust.id} value={Number(cust.id)}>
              {cust.name}
            </option>
          ))}
        </select>
      </div>

      <TableView
        columns={columns}
        data={tableData}
        loading={isLoading}
        actions={(row: Record<string, unknown>) => {
          const invoice = invoices?.find((inv) => inv.id === row.id);
          if (!invoice) return null;
          return (
            <div className="flex items-center justify-end gap-1">
              {invoice.status === "DRAFT" && permissions.update && (
                <>
                  <button
                    onClick={() => handlePost(invoice)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                    title="Post Invoice"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingInvoice(invoice);
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
                  onClick={() => handleDelete(invoice)}
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

      <CustomerInvoiceFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingInvoice(null);
        }}
        initialData={editingInvoice}
      />

      <ConfirmModal />
    </div>
  );
}