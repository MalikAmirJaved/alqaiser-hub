"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useExpenses, useDeleteExpense, expenseCategoryLabels } from "@/hooks/finance/useExpenses";
import { usePaySupplierBill } from "@/hooks/finance/useSupplierBills";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Trash2, Send } from "lucide-react";
import ExpenseFormModal from "@/components/finance/expenses/ExpenseFormModal";

export default function ExpensesPage() {
    const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const paySupplierBill = usePaySupplierBill();
  const { data: expenses, isLoading } = useExpenses();
  const deleteExpense = useDeleteExpense();
  const permissions = useFeaturePermissions("FINANCE", "expense");
  
  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: permissions.export,
  };

  const handleRowClick = (expense: any) => {
    router.push(`/finance/expenses/${expense.id}`);
  };

  const handleEdit = (expense: any) => {
    // Do not allow editing if expense is linked to a supplier bill (read-only)
    if (expense.supplier_bill_id) {
      console.warn("Expense linked to a supplier bill cannot be edited");
      return;
    }
    setEditingExpense(expense);
    setModalOpen(true);
  };

  const handleDelete = (expense: any) => {
    // Do not allow deletion if expense is linked to a supplier bill
    if (expense.supplier_bill_id) {
      console.warn("Expense linked to a supplier bill cannot be deleted");
      return;
    }
    deleteExpense.mutate(expense.id);
  };

  // Payment should only happen for expenses WITHOUT a supplier bill
  const handleRecordPayment = (expense: any) => {
    if (!expense.supplier_bill_id) {
      // For manual expenses, you may still want direct payment (if you have that endpoint)
      // For now, we use the supplier bill payment endpoint, but for manual expenses there is no bill.
      // Alternative: create a direct expense payment endpoint (not implemented)
      console.warn("Manual expense payment not implemented via this button");
    }
  };

  const handleBulkDelete = () => {
    const idsToDelete = selectedIds.filter(
      (id) => !(expenses || []).find((e: any) => e.id === id && e.supplier_bill_id)
    );
    idsToDelete.forEach((id) => deleteExpense.mutate(id));
    setSelectedIds([]);
  };

  const handleBulkRecordPayment = () => {
    // Only pay expenses that have a supplier_bill_id (so we can pay the bill)
    const expensesToPay = (expenses || []).filter(
      (e: any) => selectedIds.includes(e.id) && e.supplier_bill_id
    );
    expensesToPay.forEach((expense: any) => {
      paySupplierBill.mutate({ id: expense.supplier_bill_id });
    });
    setSelectedIds([]);
  };

  const computeKPIs = (data: any[]) => {
    const parseAmount = (val: any): number => {
      return typeof val === "string" ? parseFloat(val) : (val as number);
    };

    const totalUnpaid = data
      .filter((e) => !e.paid && !e.supplier_bill_id) // only manual unpaid
      .reduce((sum, e) => sum + parseAmount(e.amount), 0);
    const totalPaid = data
      .filter((e) => e.paid)
      .reduce((sum, e) => sum + parseAmount(e.amount), 0);
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const monthlyTotal = data
      .filter(
        (e) =>
          new Date(e.expense_date).getMonth() === thisMonth &&
          new Date(e.expense_date).getFullYear() === thisYear
      )
      .reduce((sum, e) => sum + parseAmount(e.amount), 0);
    const totalAll = data.reduce((sum, e) => sum + parseAmount(e.amount), 0);

    return [
      {
        label: "Unpaid (manual)",
        value: totalUnpaid,
        sub: `${data.filter((e) => !e.paid && !e.supplier_bill_id).length} open`,
        tone: "destructive" as const,
        isCurrency: true,
      },
      {
        label: "Paid (MTD)",
        value: totalPaid,
        sub: `${data.filter((e) => e.paid).length} settled`,
        tone: "success" as const,
        isCurrency: true,
      },
      {
        label: "This Month",
        value: monthlyTotal,
        sub: "current period",
        tone: "info" as const,
        isCurrency: true,
      },
      {
        label: "Total Expenses",
        value: totalAll,
        sub: `${data.length} records`,
        isCurrency: true,
      },
    ];
  };

  const columns = [
    { key: "expense_date", label: "Date", sortable: true },
    { key: "expense_number", label: "Expense #", mono: true, sortable: true },
    {
      key: "supplier_bill_number",
      label: "Bill #",
      render: (val: string, row: any) =>
        val ? (
          <a
            href={`/finance/supplier-bills/${row.supplier_bill_id}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {val}
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      render: (val: string) => expenseCategoryLabels[val] || val,
    },
    { key: "description", label: "Description" },
    {
      key: "amount",
      label: "Amount",
      align: "right" as const,
      sortable: true,
      render: (val: number) => formatCurrency(val),
    },
    {
      key: "paid",
      label: "Paid",
      sortable: true,
      render: (val: boolean, row: any) => {
        if (row.supplier_bill_id) {
          // If linked to a bill, the paid status is derived from the bill
          return val ? "Yes (via bill)" : "No (bill unpaid)";
        }
        return val ? "Yes" : "No";
      },
    },
  ];

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Operations", "Expenses"]}
        title="Expenses"
        description="Record and track company expenses"
        data={expenses || []}
        isLoading={isLoading}
        columns={columns}
        kpis={computeKPIs}
        getRowId={(expense) => expense.id}
        permissions={modulePermissions}
        primaryActionLabel="New Expense"
        onCreate={() => {
          setEditingExpense(null);
          setModalOpen(true);
        }}
        actions={{
          onEdit: handleEdit,
          onDelete: handleDelete,
          // No "Post" action for expenses – payment is only via supplier bills
        }}
        onRowClick={handleRowClick}
        exportEnabled={permissions.export}
        onRowSelect={setSelectedIds}
        batchActions={
          <>
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected (manual only)
            </button>
            <button
              onClick={handleBulkRecordPayment}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80"
            >
              <Send className="w-4 h-4" />
              Pay Selected Bills
            </button>
          </>
        }
      />
      <ExpenseFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingExpense(null);
        }}
        initialData={editingExpense}
      />
    </>
  );
}