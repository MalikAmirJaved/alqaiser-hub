"use client";

import { useState } from "react";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/DynamicModulePage";
import { useCustomerInvoices, useDeleteCustomerInvoice, usePostCustomerInvoice } from "@/hooks/finance/useCustomerInvoices";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import CustomerInvoiceFormModal from "@/components/finance/customer-invoices/CustomerInvoiceFormModal";
import { formatCurrency } from "@/lib/currency";
import { StatusBadge } from "@/components/finance/ui";
import { Trash2, Send } from "lucide-react";

export default function CustomerInvoicesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: invoices, isLoading } = useCustomerInvoices();
  const deleteInvoice = useDeleteCustomerInvoice();
  const postInvoice = usePostCustomerInvoice();

  const permissions = useFeaturePermissions("FINANCE", "customerinvoice");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: true,
  };

  const handleEdit = (invoice: any) => {
    setEditingInvoice(invoice);
    setModalOpen(true);
  };

  const handleDelete = (invoice: any) => {
    deleteInvoice.mutate(invoice.id);
  };

  const handlePost = (invoice: any) => {
    if (invoice.status === "DRAFT") {
      postInvoice.mutate(invoice.id);
    }
  };

  const handleBulkDelete = () => {
    selectedIds.forEach((id) => deleteInvoice.mutate(id));
    setSelectedIds([]);
  };

  const computeKPIs = (data: any[]) => {
        const totalOutstanding = data.reduce((sum, inv) => sum + Number(inv.outstanding || 0), 0);
    const totalPaid = data.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
    const overdueCount = data.filter((inv) => inv.status !== "PAID" && new Date(inv.due_date) < new Date()).length;
    const draftCount = data.filter((inv) => inv.status === "DRAFT").length;
    return [
      {
        label: "Outstanding",
        value: totalOutstanding,
        sub: `${data.length} open invoices`,
        tone: "info" as const,
      },
      {
        label: "Overdue",
        value: overdueCount,
        sub: `${overdueCount} invoices past due`,
        tone: "destructive" as const,
      },
      {
        label: "Paid (MTD)",
        value: totalPaid,
        sub: "YTD",
        tone: "success" as const,
      },
      { label: "Draft", value: draftCount, sub: "Awaiting issue" },
    ];
  };

  const columns = [
    { key: "invoice_number", label: "Invoice #", mono: true, sortable: true },
    { key: "customer_name", label: "Customer", sortable: true },
    { key: "invoice_date", label: "Issued", sortable: true },
    { key: "due_date", label: "Due", sortable: true },
    {
      key: "amount",
      label: "Amount",
      align: "right" as const,
      sortable: true,
      render: (val: number) => formatCurrency(val),
    },
    {
      key: "outstanding",
      label: "Balance",
      align: "right" as const,
      sortable: true,
      render: (val: number) => (val ? formatCurrency(val) : "—"),
    },
    { key: "currency", label: "Curr", render: () => "USD" },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (val: string) => <StatusBadge status={val} />,
    },
  ];

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Receivables", "Customer Invoices"]}
        title="Customer Invoices"
        description="Issue, track, and reconcile customer invoices across companies and currencies."
        data={invoices || []}
        isLoading={isLoading}
        columns={columns}
        kpis={computeKPIs}
        getRowId={(invoice) => invoice.id}
        permissions={modulePermissions}
        primaryActionLabel="New Invoice"
        onCreate={() => {
          setEditingInvoice(null);
          setModalOpen(true);
        }}
        actions={{
          onEdit: handleEdit,
          onDelete: handleDelete,
          onPost: handlePost,
        }}
        exportEnabled={true}
        onRowSelect={setSelectedIds}
        batchActions={
          <>
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
            <button
              onClick={() => {
                selectedIds.forEach((id) => postInvoice.mutate(id));
                setSelectedIds([]);
              }}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80"
            >
              <Send className="w-4 h-4" />
              Post Selected
            </button>
          </>
        }
      />
      <CustomerInvoiceFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingInvoice(null);
        }}
        initialData={editingInvoice}
      />
    </>
  );
}