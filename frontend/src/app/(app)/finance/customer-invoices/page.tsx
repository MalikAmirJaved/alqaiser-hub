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

// Status badge component (matches lovable styling)
const StatusBadge = ({ status }: { status: CustomerInvoice["status"] }) => {
  const styles = {
    DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    POSTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    PARTIAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    PAID: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
};

const columns: Column[] = [
  { key: "invoice_number", label: "Invoice #", sortable: true, mono: true },
  { key: "customer_name", label: "Customer", sortable: true },
  { key: "invoice_date", label: "Issued", sortable: true },
  { key: "due_date", label: "Due", sortable: true },
  {
    key: "amount",
    label: "Amount",
    sortable: true,
    align: "right",
    render: (val) => formatCurrency(Number(val)),
  },
  {
    key: "outstanding",
    label: "Balance",
    align: "right",
    render: (val, row) => {
      const outstanding = Number(val);
      return outstanding ? formatCurrency(outstanding) : "—";
    },
  },
  { key: "currency", label: "Curr", render: () => "USD" }, // hardcoded or get from company settings
  {
    key: "status",
    label: "Status",
    render: (val) => <StatusBadge status={val as CustomerInvoice["status"]} />,
  },
];

// KPI cards (derived from real data)
function InvoiceKPIs({ invoices }: { invoices?: CustomerInvoice[] }) {
  const totalOutstanding = invoices?.reduce((sum, inv) => sum + inv.outstanding, 0) || 0;
  const totalPaid = invoices?.reduce((sum, inv) => sum + inv.paid_amount, 0) || 0;
  const overdueCount = invoices?.filter(inv => inv.status !== "PAID" && new Date(inv.due_date) < new Date()).length || 0;
  const draftCount = invoices?.filter(inv => inv.status === "DRAFT").length || 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Outstanding</div>
        <div className="text-2xl font-semibold tracking-tight mt-1 text-info">{formatCurrency(totalOutstanding)}</div>
        <div className="text-xs text-muted-foreground mt-1">{invoices?.length || 0} open invoices</div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Overdue</div>
        <div className="text-2xl font-semibold tracking-tight mt-1 text-destructive">{formatCurrency(overdueCount)}</div>
        <div className="text-xs text-muted-foreground mt-1">{overdueCount} invoices past due</div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Paid (MTD)</div>
        <div className="text-2xl font-semibold tracking-tight mt-1 text-success">{formatCurrency(totalPaid)}</div>
        <div className="text-xs text-muted-foreground mt-1">YTD</div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Draft</div>
        <div className="text-2xl font-semibold tracking-tight mt-1">{draftCount}</div>
        <div className="text-xs text-muted-foreground mt-1">Awaiting issue</div>
      </div>
    </div>
  );
}

export default function CustomerInvoicesPage() {
  const permissions = useFeaturePermissions("FINANCE", "customerinvoice");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const { data: invoices, isLoading } = useCustomerInvoices({
    status: statusFilter || undefined,
    customer: customerFilter || undefined,
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
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Customer Invoices"
        subtitle="Issue, track, and reconcile customer invoices across companies and currencies."
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
              Export
            </button>
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

      <InvoiceKPIs invoices={invoices} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="POSTED">Posted</option>
          <option value="PARTIAL">Partial</option>
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
            <option key={cust.id} value={cust.id}>
              {cust.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
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