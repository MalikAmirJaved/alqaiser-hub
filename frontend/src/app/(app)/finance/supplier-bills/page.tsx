"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useSupplierBills, useDeleteSupplierBill, usePaySupplierBill } from "@/hooks/finance/useSupplierBills";
import { StatusBadge } from "@/components/finance/ui";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import SupplierBillFormModal from "@/components/finance/supplier-bills/SupplierBillFormModal";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Trash2, Send } from "lucide-react";


export default function SupplierBillsPage() {
    const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: bills, isLoading } = useSupplierBills();

  const deleteBill = useDeleteSupplierBill();
  const payBill = usePaySupplierBill();
  const permissions = useFeaturePermissions("FINANCE", "supplier_bill");
  const modulePermissions: ModulePermissions = {
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

  const handlePay = (bill: any) => {
    if (bill.payment_status !== "PAID" && bill.status !== "CANCELLED") {
      payBill.mutate({ id: bill.id });
    }
  };

  const handleBulkDelete = () => {
    selectedIds.forEach((id) => deleteBill.mutate(id));
    setSelectedIds([]);
  };

  const computeKPIs = (data: any[]) => {
    const totalOutstanding = data.reduce((sum, bill) => sum + Number(bill.outstanding || 0), 0);
    const totalPaid = data.reduce((sum, bill) => sum + Number(bill.paid_amount || 0), 0);
    const overdueCount = data.filter((bill) => bill.payment_status !== "PAID" && new Date(bill.due_date) < new Date()).length;
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
      key: "payment_status",
      label: "Payment",
      sortable: true,
      render: (val: string) => <StatusBadge status={val || "UNPAID"} />,
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
          onPost: handlePay,
          canPost: (bill) => bill.payment_status !== "PAID" && bill.status !== "CANCELLED",
          postLabel: "Pay",
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
                selectedIds.forEach((id) => payBill.mutate({ id }));
                setSelectedIds([]);
              }}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80"
            >
              <Send className="w-4 h-4" />
              Pay Selected
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