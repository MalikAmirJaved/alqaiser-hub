"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useExpenses, useDeleteExpense, useRecordExpensePayment, expenseCategoryLabels } from "@/hooks/finance/useExpenses";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";
import { Trash2, Send } from "lucide-react";
import ExpenseFormModal from "@/components/finance/expenses/ExpenseFormModal";

export default function ExpensesPage() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: expenses, isLoading } = useExpenses();
  const deleteExpense = useDeleteExpense();
  const recordPayment = useRecordExpensePayment();
  const permissions = useFeaturePermissions("FINANCE", "expense");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: true,
  };

  const handleRowClick = (expense: any) => {
    router.push(`/finance/expenses/${expense.id}`);
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setModalOpen(true);
  };

  const handleDelete = (expense: any) => {
    deleteExpense.mutate(expense.id);
  };

  const handleRecordPayment = (expense: any) => {
    recordPayment.mutate({
      id: expense.id,
      data: { payment_date: new Date().toISOString().split("T")[0], payment_method: "BANK_TRANSFER" },
    });
  };

  const handleBulkDelete = () => {
    selectedIds.forEach((id) => deleteExpense.mutate(id));
    setSelectedIds([]);
  };

  const handleBulkRecordPayment = () => {
    selectedIds.forEach((id) =>
      recordPayment.mutate({
        id,
        data: { payment_date: new Date().toISOString().split("T")[0], payment_method: "BANK_TRANSFER" },
      })
    );
    setSelectedIds([]);
  };

const computeKPIs = (data: any[]) => {
  // Convert string amounts to numbers safely
  const parseAmount = (val: any): number => {
    return typeof val === "string" ? parseFloat(val) : (val as number);
  };

  const totalUnpaid = data
    .filter((e) => !e.paid)
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
      label: "Unpaid",
      value: totalUnpaid,
      sub: `${data.filter((e) => !e.paid).length} open`,
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
    { key: "category", label: "Category", sortable: true, render: (val: string) => expenseCategoryLabels[val] || val },
    { key: "description", label: "Description" },
    { key: "amount", label: "Amount", align: "right" as const, sortable: true, render: (val: number) => formatCurrency(val) },
    { key: "paid", label: "Paid", sortable: true, render: (val: boolean) => (val ? "Yes" : "No") },
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
          onPost: (expense) => {
            if (!expense.paid) handleRecordPayment(expense);
          },
          canPost: (expense) => !expense.paid,
        }}
        onRowClick={handleRowClick}
        exportEnabled
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
              onClick={handleBulkRecordPayment}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80"
            >
              <Send className="w-4 h-4" />
              Pay Selected
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