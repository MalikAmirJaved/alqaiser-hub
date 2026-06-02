"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useExpenses, useDeleteExpense, useRecordExpensePayment, expenseCategoryLabels } from "@/hooks/finance/useExpenses";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import ExpenseFormModal from "@/components/finance/expenses/ExpenseFormModal";
import { formatCurrency } from "@/lib/currency";

const columns: Column[] = [
  { key: "expense_date", label: "Date", sortable: true },
  { key: "expense_number", label: "Expense #", sortable: true },
  { key: "category", label: "Category", render: (val) => expenseCategoryLabels[String(val)] ?? String(val), },
  { key: "description", label: "Description" },
  { key: "amount", label: "Amount", sortable: true, render: (val) => formatCurrency(Number(val)) },
  { key: "paid", label: "Paid", render: (val) => (val ? "Yes" : "No") },
];

export default function ExpensesPage() {
  const permissions = useFeaturePermissions("FINANCE", "expense");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [paidFilter, setPaidFilter] = useState<string>("");
  const { data: expenses, isLoading } = useExpenses({
    category: categoryFilter || undefined,
    paid: paidFilter === "" ? undefined : paidFilter === "paid",
  });
  const deleteExpense = useDeleteExpense();
  const recordPayment = useRecordExpensePayment();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  const handleDelete = (expense: any) => {
    confirm({
      title: "Delete Expense",
      message: `Are you sure you want to delete expense "${expense.expense_number}"?`,
      onConfirm: () => deleteExpense.mutate(expense.id),
    });
  };

  const handleRecordPayment = (expense: any) => {
    confirm({
      title: "Record Payment",
      message: `Record payment for expense "${expense.expense_number}" of ${formatCurrency(expense.amount)}?`,
      onConfirm: () => recordPayment.mutate({ id: expense.id, data: { payment_date: new Date().toISOString().split("T")[0], payment_method: "BANK_TRANSFER" } }),
      type: "info",
      confirmText: "Yes, Record",
    });
  };

  const tableData = (expenses || []).map(e => ({ ...e })) as Record<string, unknown>[];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Expenses"
        subtitle="Record and track company expenses"
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setEditingExpense(null); setModalOpen(true); }} className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm">
              <Plus className="w-4 h-4" /> New Expense
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-md">
          <option value="">All Categories</option>
          {Object.entries(expenseCategoryLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>
        <select value={paidFilter} onChange={(e) => setPaidFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-md">
          <option value="">All</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>

      <TableView
        columns={columns}
        data={tableData}
        loading={isLoading}
        actions={(row) => {
          const expense = expenses?.find(e => e.id === row.id);
          if (!expense) return null;
          return (
            <div className="flex gap-1">
              {!expense.paid && permissions.update && (
                <button onClick={() => handleRecordPayment(expense)} className="p-1.5 rounded-md hover:bg-muted" title="Record Payment">
                  <CreditCard className="w-4 h-4" />
                </button>
              )}
              {permissions.update && (
                <button onClick={() => { setEditingExpense(expense); setModalOpen(true); }} className="p-1.5 rounded-md hover:bg-muted">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {permissions.delete && (
                <button onClick={() => handleDelete(expense)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        }}
      />

      <ExpenseFormModal open={modalOpen} onClose={() => { setModalOpen(false); setEditingExpense(null); }} initialData={editingExpense} />
      <ConfirmModal />
    </div>
  );
}