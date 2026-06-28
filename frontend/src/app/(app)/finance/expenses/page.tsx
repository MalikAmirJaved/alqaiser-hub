"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import {
  useExpenses,
  useDeleteExpense,
  expenseCategoryLabels,
  expenseCategoryOptions,
  useRecordExpensePayment,
} from "@/hooks/finance/useExpenses";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { Trash2 } from "lucide-react";
import ExpenseFormModal from "@/components/finance/expenses/ExpenseFormModal";
import PayAmountModal from "@/components/finance/PayAmountModal";
import { StatusBadge } from "@/components/finance/ui";
import { usePagination } from "@/hooks/usePagination";

export default function ExpensesPage() {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [expenseToPay, setExpenseToPay] = useState<any>(null);
  const pagination = usePagination();

  const filtersWithPage = useMemo(() => ({
    page: pagination.page,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.paid !== undefined ? { paid: filters.paid === "true" } : {}),
  }), [filters, pagination.page]);

  const recordPayment = useRecordExpensePayment();
  const { data: expenses, isLoading, totalCount } = useExpenses(filtersWithPage);
  const deleteExpense = useDeleteExpense();

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    { name: "category", label: "Category", type: "select", searchable: true, options: expenseCategoryOptions },
    { name: "paid", label: "Payment", type: "boolean" },
  ];

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
    if (expense.supplier_bill_id) return;
    setEditingExpense(expense);
    setModalOpen(true);
  };

  const handleDelete = (expense: any) => {
    if (expense.supplier_bill_id) return;
    deleteExpense.mutate(expense.id);
  };

  const handleRecordPayment = (expense: any) => {
    if (
      !expense.supplier_bill_id &&
      expense.payment_status !== "PAID" &&
      Number(expense.outstanding ?? expense.amount) > 0
    ) {
      setExpenseToPay(expense);
      setPayModalOpen(true);
    }
  };

  const handleBulkDelete = () => {
    const idsToDelete = selectedIds.filter(
      (id) => !(expenses || []).find((e: any) => e.id === id && e.supplier_bill_id)
    );
    idsToDelete.forEach((id) => deleteExpense.mutate(id));
    setSelectedIds([]);
  };

  const computeKPIs = (data: any[]) => {
    const parseAmount = (val: any): number =>
      typeof val === "string" ? parseFloat(val) : (val as number);

    const totalUnpaid = data
      .filter((e) => !e.supplier_bill_id && e.payment_status !== "PAID")
      .reduce((sum, e) => sum + parseAmount(e.outstanding ?? e.amount), 0);
    const totalPaid = data
      .filter((e) => e.payment_status === "PAID" || e.paid)
      .reduce((sum, e) => sum + parseAmount(e.paid_amount ?? e.amount), 0);
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
        sub: `${data.filter((e) => !e.supplier_bill_id && e.payment_status !== "PAID").length} open`,
        tone: "destructive" as const,
        isCurrency: true,
      },
      {
        label: "Paid",
        value: totalPaid,
        sub: `${data.filter((e) => e.payment_status === "PAID" || e.paid).length} settled`,
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
      sortable: true,
      render: (val: number) => formatCurrency(val),
    },
    {
      key: "paid_amount",
      label: "Paid",
      render: (val: number, row: any) =>
        row.supplier_bill_id ? "—" : formatCurrency(Number(val || 0)),
    },
    {
      key: "outstanding",
      label: "Due",
      render: (val: number, row: any) =>
        row.supplier_bill_id ? "—" : formatCurrency(Number(val ?? row.amount ?? 0)),
    },
    {
      key: "payment_status",
      label: "Status",
      sortable: true,
      render: (val: string, row: any) => {
        if (row.supplier_bill_id) {
          return <span className="text-xs text-muted-foreground">Via bill</span>;
        }
        return <StatusBadge status={val || (row.paid ? "PAID" : "UNPAID")} />;
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
        totalCount={totalCount}
        currentPage={pagination.page}
        onPageChange={pagination.setPage}
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
          onPost: handleRecordPayment,
          canEdit: (expense: any) => !expense.supplier_bill_id,
          canDelete: (expense: any) => !expense.supplier_bill_id,
          canPost: (expense: any) =>
            !expense.supplier_bill_id &&
            expense.payment_status !== "PAID" &&
            Number(expense.outstanding ?? expense.amount) > 0,
          postLabel: "Pay",
        }}
        onRowClick={handleRowClick}
        exportEnabled={permissions.export}
        onRowSelect={setSelectedIds}
        filterBar={
          <FilterBar
            fields={filterFields}
            filters={filters}
            onChange={(f) => { setFilters(f); pagination.resetPage(); }}
          />
        }
        batchActions={
          <button
            onClick={handleBulkDelete}
            className="inline-flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected (manual only)
          </button>
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
      {expenseToPay && (
        <PayAmountModal
          open={payModalOpen}
          onClose={() => {
            setPayModalOpen(false);
            setExpenseToPay(null);
          }}
          title="Pay Expense"
          documentLabel="Expense"
          documentNumber={expenseToPay.expense_number}
          subtitle={expenseToPay.description}
          totalAmount={Number(expenseToPay.amount)}
          paidAmount={Number(expenseToPay.paid_amount || 0)}
          outstanding={Number(expenseToPay.outstanding ?? expenseToPay.amount)}
          paymentStatus={expenseToPay.payment_status || (expenseToPay.paid ? "PAID" : "UNPAID")}
          isPending={recordPayment.isPending}
          onSubmit={async (data) => {
            await recordPayment.mutateAsync({
              id: expenseToPay.id,
              data: {
                amount: data.amount,
                payment_date: data.payment_date,
                payment_method: data.payment_method,
                reference_number: data.reference_number,
              },
            });
            setPayModalOpen(false);
            setExpenseToPay(null);
          }}
        />
      )}
    </>
  );
}
