"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DetailLayout, StandardSidebar, RelatedRecords, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { useExpense, useUpdateExpense, useRecordExpensePayment, expenseCategoryLabels } from "@/hooks/finance/useExpenses";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";
import ExpenseFormModal from "@/components/finance/expenses/ExpenseFormModal";

const toNumber = (value: number | string): number => {
  return typeof value === "string" ? parseFloat(value) : value;
};

export default function ExpenseDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: expense, isLoading, refetch } = useExpense(id as string);
  const updateExpense = useUpdateExpense();
  const recordPayment = useRecordExpensePayment();
  const permissions = useFeaturePermissions("FINANCE", "expense");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!expense) return <div className="p-8 text-center">Expense not found</div>;

  const amount = toNumber(expense.amount);
  const paid = expense.paid;

  const handleEdit = () => {
    setEditingExpense(expense);
    setModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    refetch();
    setModalOpen(false);
    setEditingExpense(null);
  };

  const handleRecordPayment = () => {
    recordPayment.mutate({
      id: expense.id,
      data: { payment_date: new Date().toISOString().split("T")[0], payment_method: "BANK_TRANSFER" },
    });
  };

  const relatedItems: { id: string; type: string; title: string; amount?: string; status?: string }[] = [];
  if (expense.journal_entry) {
    relatedItems.push({
      id: String(expense.journal_entry),
      type: "Journal",
      title: "Journal entry",
      status: "Posted",
    });
  }

  const tabs: DetailTab[] = [
    {
      id: "overview",
      label: "Overview",
      render: () => (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Expense Number", expense.expense_number],
            ["Category", expenseCategoryLabels[expense.category] || expense.category],
            ["Date", expense.expense_date],
            ["Amount", formatCurrency(amount)],
            ["Description", expense.description || "—"],
            ["Notes", expense.notes || "—"],
          ].map(([l, v]) => (
            <div key={l as string} className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">{l}</span>
              <span className="num font-medium">{v}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "payment",
      label: "Payment",
      render: () =>
        expense.paid ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Date</span>
              <span>{expense.payment_date || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Method</span>
              <span>{expense.payment_method || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference</span>
              <span>{expense.reference_number || "—"}</span>
            </div>
          </div>
        ) : (
          <button
            onClick={handleRecordPayment}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            Record Payment
          </button>
        ),
    },
  ];

  if (relatedItems.length > 0) {
    tabs.push({
      id: "related",
      label: "Related",
      count: relatedItems.length,
      render: () => <RelatedRecords items={relatedItems} />,
    });
  }

  return (
    <>
      <DetailLayout
        breadcrumbs={["Operations", "Expenses", expense.expense_number]}
        entityId={expense.expense_number}
        title={`${expense.category} — ${expense.expense_number}`}
        status={expense.paid ? "Paid" : "Unpaid"}
        subtitle={`Expense · ${expense.expense_date}`}
        data={expense}
        meta={[
          { label: "Category", value: expenseCategoryLabels[expense.category] || expense.category },
          { label: "Date", value: expense.expense_date },
          { label: "Currency", value: "USD" },
        ]}
        summary={[
          { label: "Amount", value: amount, tone: "info", isCurrency: true },
          { label: "Status", value: expense.paid ? "Paid" : "Unpaid", tone: expense.paid ? "success" : "warning" },
          {
            label: "Payment Date",
            value: expense.payment_date || "—",
            isCurrency: false,
          },
        ]}
        tabs={tabs}
        sidebar={
          <StandardSidebar
            metadata={[
              ["Created", new Date(expense.created_at).toLocaleString()],
              ["Created by", String(expense.created_by || "-")],
              ["Modified", new Date(expense.updated_at).toLocaleString()],
              ["Source", "Manual"],
            ]}
          />
        }
        onPrimaryAction={expense.paid ? undefined : handleRecordPayment}
        primaryActionLabel="Record Payment"
        onEdit={handleEdit}
        permissions={{ edit: permissions.update, submit: permissions.create }}
        currencyFormatter={formatCurrency}
      />
      <ExpenseFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingExpense(null);
        }}
        initialData={editingExpense}
        onSuccess={handleUpdateSuccess}
      />
    </>
  );
}