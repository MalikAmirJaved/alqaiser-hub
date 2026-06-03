"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useSupplierBills, useDeleteSupplierBill, usePostSupplierBill } from "@/hooks/finance/useSupplierBills";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useSuppliers } from "@/hooks/useSuppliers";
import SupplierBillFormModal from "@/components/finance/supplier-bills/SupplierBillFormModal";
import { formatCurrency } from "@/lib/currency";
import { StatusBadge } from "@/components/finance/ui";
import { Trash2, Send } from "lucide-react";

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  POSTED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  PARTIAL: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function SupplierBillsPage() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: bills, isLoading } = useSupplierBills();
  const deleteBill = useDeleteSupplierBill();
  const postBill = usePostSupplierBill();
  const { data: suppliers } = useSuppliers();
  const permissions = useFeaturePermissions("FINANCE", "supplierbill");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: true,
  };

  const handleRowClick = (bill: any) => {
    router.push(`/finance/supplier-bills/${bill.id}`);
  };

  const handleEdit = (bill: any) => {
    setEditingBill(bill);
    setModalOpen(true);
  };

  const handleDelete = (bill: any) => {
    deleteBill.mutate(bill.id);
  };

  const handlePost = (bill: any) => {
    if (bill.status === "DRAFT") {
      postBill.mutate(bill.id);
    }
  };

  const handleBulkDelete = () => {
    selectedIds.forEach((id) => deleteBill.mutate(id));
    setSelectedIds([]);
  };

  const computeKPIs = (data: any[]) => {
    const totalOutstanding = data.reduce((sum, bill) => sum + Number(bill.outstanding || 0), 0);
    const totalPaid = data.reduce((sum, bill) => sum + Number(bill.paid_amount || 0), 0);
    const overdueCount = data.filter((bill) => bill.status !== "PAID" && new Date(bill.due_date) < new Date()).length;
    const draftCount = data.filter((bill) => bill.status === "DRAFT").length;
    return [
      { label: "Outstanding", value: totalOutstanding, sub: `${data.length} open bills`, tone: "info" as const, isCurrency: true },
      { label: "Overdue", value: overdueCount, sub: `${overdueCount} bills past due`, tone: "destructive" as const, isCurrency: false },
      { label: "Paid (MTD)", value: totalPaid, sub: "YTD", tone: "success" as const, isCurrency: true },
      { label: "Draft", value: draftCount, sub: "Awaiting issue", isCurrency: false },
    ];
  };

  const columns = [
    { key: "bill_number", label: "Bill #", mono: true, sortable: true },
    { key: "supplier_name", label: "Supplier", sortable: true },
    { key: "bill_date", label: "Bill Date", sortable: true },
    { key: "due_date", label: "Due Date", sortable: true },
    { key: "amount", label: "Amount", align: "right" as const, sortable: true, render: (val: number) => formatCurrency(val) },
    { key: "paid_amount", label: "Paid", align: "right" as const, render: (val: number) => formatCurrency(val) },
    {
      key: "outstanding",
      label: "Outstanding",
      align: "right" as const,
      sortable: true,
      render: (val: number) => (val ? formatCurrency(val) : "—"),
    },
    { key: "currency", label: "Curr", render: () => "USD" },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (val: string) => {
        const status = val as keyof typeof statusColors;
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
            {status}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Payables", "Supplier Bills"]}
        title="Supplier Bills"
        description="Manage bills from your suppliers (accounts payable)"
        data={bills || []}
        isLoading={isLoading}
        columns={columns}
        kpis={computeKPIs}
        getRowId={(bill) => bill.id}
        permissions={modulePermissions}
        primaryActionLabel="New Bill"
        onCreate={() => {
          setEditingBill(null);
          setModalOpen(true);
        }}
        actions={{
          onEdit: handleEdit,
          onDelete: handleDelete,
          onPost: handlePost,
        }}
        onRowClick={handleRowClick}
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
                selectedIds.forEach((id) => postBill.mutate(id));
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
      <SupplierBillFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingBill(null);
        }}
        initialData={editingBill}
        onSuccess={() => {
          // Refetch is handled by the hook automatically
          setModalOpen(false);
          setEditingBill(null);
        }}
      />
    </>
  );
}