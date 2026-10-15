"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DetailLayout, StandardSidebar, RelatedRecords, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { useExpense, useUpdateExpense, expenseCategoryLabels } from "@/hooks/finance/useExpenses";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import ExpenseFormModal from "@/components/finance/expenses/ExpenseFormModal";
import { usePaySupplierBill } from "@/hooks/finance/useSupplierBills";
import { BASE_URL } from "@/lib/api";
import ImageLightbox from "@/components/reuseable/ImageLightbox";

const toNumber = (value: number | string): number => {
  return typeof value === "string" ? parseFloat(value) : value;
};

export default function ExpenseDetailPage() {
    const formatCurrency = useFormatCurrency();
  const { id } = useParams();
  const router = useRouter();
  const { data: expense, isLoading, refetch } = useExpense(id as string);
  const updateExpense = useUpdateExpense();
  const paySupplierBill = usePaySupplierBill();
  const permissions = useFeaturePermissions("FINANCE", "expense");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [receiptPreview, setReceiptPreview] = useState("");

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!expense) return <div className="p-8 text-center">Expense not found</div>;

  const amount = toNumber(expense.amount);
  const isLinkedToBill = !!expense.supplier_bill_id;
  const canEdit = !isLinkedToBill && permissions.update;
  const canPay = !expense.paid && !isLinkedToBill;

  const handleEdit = () => {
    if (canEdit) {
      setEditingExpense(expense);
      setModalOpen(true);
    }
  };

  const handleUpdateSuccess = () => {
    refetch();
    setModalOpen(false);
    setEditingExpense(null);
  };

  const handlePayBill = () => {
    if (!expense.supplier_bill_id) return;
    if (isLinkedToBill) {
      paySupplierBill.mutate({ id: expense.supplier_bill_id });
    }
  };

  const expensePayments = expense.payments || [];

  const relatedItems: { id: string; type: string; title: string; amount?: string; status?: string }[] = [];
  if (expense.supplier_bill_id && expense.supplier_bill_number) {
    relatedItems.push({
      id: expense.supplier_bill_id,
      type: "Supplier Bill",
      title: `Bill ${expense.supplier_bill_number}`,
      status: expense.paid ? "Paid" : "Unpaid",
    });
  }
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
            [
              "Supplier Bill",
              expense.supplier_bill_number ? (
                <a
                  href={`/finance/supplier-bills/${expense.supplier_bill_id}`}
                  className="text-primary hover:underline"
                >
                  {expense.supplier_bill_number}
                </a>
              ) : (
                "—"
              ),
            ],
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
      render: () => {
        if (expensePayments.length > 0) {
          return (
            <div className="space-y-3">
              {expensePayments.map((pmt) => (
                <div
                  key={pmt.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-surface-1/50 p-3 text-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold num">
                        {formatCurrency(toNumber(pmt.amount))}
                      </span>
                      <span
                        className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                          pmt.status === "CONFIRMED"
                            ? "bg-success/15 text-success border-success/30"
                            : pmt.status === "CANCELLED"
                            ? "bg-destructive/15 text-destructive border-destructive/30"
                            : "bg-warning/15 text-warning border-warning/30"
                        }`}
                      >
                        {pmt.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pmt.payment_date}
                      {" · "}
                      {(pmt.payment_method || "").replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Transaction Number:{" "}
                      <span className="font-mono text-primary">
                        {pmt.reference_number || "—"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {pmt.receipt_image ? (
                      <button
                        type="button"
                        onClick={() =>
                          setReceiptPreview(`${BASE_URL}${pmt.receipt_image}`)
                        }
                        title="View receipt"
                        className="block"
                      >
                        <img
                          src={`${BASE_URL}${pmt.receipt_image}`}
                          alt="Receipt"
                          className="h-14 w-14 rounded-lg border border-border object-cover transition-opacity hover:opacity-80"
                        />
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No receipt
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        if (expense.paid) {
          return (
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
          );
        }

        if (isLinkedToBill) {
          return (
            <button
              onClick={handlePayBill}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
            >
              Pay Linked Supplier Bill
            </button>
          );
        }

        return (
          <div className="text-sm text-muted-foreground">
            This expense is not linked to a supplier bill. To record payment, use the "Edit" button and mark as paid.
          </div>
        );
      },
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
        status={expense.paid ? "Paid" : isLinkedToBill ? "Linked to Bill" : "Unpaid"}
        subtitle={`Expense · ${expense.expense_date}`}
        data={expense}
        meta={[
          { label: "Category", value: expenseCategoryLabels[expense.category] || expense.category },
          { label: "Date", value: expense.expense_date },
          { label: "Supplier Bill", value: expense.supplier_bill_number || "—" },
          { label: "Currency", value: "USD" },
        ]}
        summary={[
          { label: "Amount", value: amount, tone: "info", isCurrency: true },
          {
            label: "Status",
            value: expense.paid ? "Paid" : isLinkedToBill ? "Awaiting Bill Payment" : "Unpaid",
            tone: expense.paid ? "success" : isLinkedToBill ? "warning" : "destructive",
          },
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
              ["Source", isLinkedToBill ? "Purchase Order" : "Manual"],
            ]}
          />
        }
        onPrimaryAction={canPay ? undefined : undefined} // no direct payment for manual expenses (can be done via edit)
        primaryActionLabel={undefined}
        onEdit={canEdit ? handleEdit : undefined}
        permissions={{ edit: canEdit, submit: permissions.create }}
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

      {receiptPreview && (
        <ImageLightbox
          src={receiptPreview}
          onClose={() => setReceiptPreview("")}
        />
      )}
    </>
  );
}