// frontend/src/app/(app)/finance/bank-accounts/page.tsx
"use client";

import { useState, useMemo } from "react";
import { DynamicModulePage, type ModulePermissions, type Kpi } from "@/components/reuseable/final/DynamicModulePage";
import { useBankAccounts, useDeleteBankAccount } from "@/hooks/finance/useBank";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import BankAccountFormModal from "@/components/finance/bank/BankAccountFormModal";
import { usePagination } from "@/hooks/usePagination";

const toNumber = (value: number | string | undefined): number => {
  if (value === undefined || value === null) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
};

export default function BankAccountsPage() {
    const formatCurrency = useFormatCurrency();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const pagination = usePagination();

  const filtersWithPage = useMemo(() => ({ page: pagination.page }), [pagination.page]);

  const { data: accounts, isLoading, totalCount } = useBankAccounts(filtersWithPage);
  const deleteAccount = useDeleteBankAccount();
  const permissions = useFeaturePermissions("FINANCE", "bank_account");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: permissions.export,
  };

  const computeKPIs = (data: any[]): Kpi[] => {
    const totalBookBalance = data.reduce((sum, acc) => sum + toNumber(acc.book_balance), 0);
    const totalClearedBalance = data.reduce((sum, acc) => sum + toNumber(acc.cleared_balance), 0);
    const totalPending = totalBookBalance - totalClearedBalance;

    return [
      { label: "Total Book Balance", value: totalBookBalance, isCurrency: true, tone: "info" as const },
      { label: "Cleared Balance", value: totalClearedBalance, isCurrency: true, tone: "success" as const },
      { label: "Pending Transactions", value: totalPending, isCurrency: true, tone: "warning" as const },
      { label: "Active Accounts", value: data.filter((a) => a.is_active).length, isCurrency: false, tone: "info" as const },
    ];
  };

  const columns = [
    { key: "account_name", label: "Account Name", sortable: true },
    { key: "bank_name", label: "Bank", sortable: true },
    { key: "account_number", label: "Account Number" },
    { key: "currency", label: "Currency" },
    {
      key: "book_balance",
      label: "Book Balance",
      align: "right" as const,
      render: (val: number | string) => formatCurrency(toNumber(val)),
      sortable: true,
    },
    {
      key: "cleared_balance",
      label: "Cleared Balance",
      align: "right" as const,
      render: (val: number | string) => formatCurrency(toNumber(val)),
      sortable: true,
    },
    {
      key: "pending_balance",
      label: "Pending",
      align: "right" as const,
      render: (val: number | string) => formatCurrency(toNumber(val)),
    },
    { key: "is_active", label: "Status", render: (val: boolean) => (val ? "Active" : "Inactive") },
  ];

  const handleEdit = (account: any) => {
    setEditingAccount(account);
    setModalOpen(true);
  };

  const handleDelete = (account: any) => {
    deleteAccount.mutate(account.id);
  };

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Banking & Cash", "Bank Accounts"]}
        title="Bank Accounts"
        description="Manage company bank accounts with dual balance tracking (book vs cleared)"
        data={accounts || []}
        isLoading={isLoading}
        totalCount={totalCount}
        currentPage={pagination.page}
        onPageChange={pagination.setPage}
        columns={columns}
        kpis={computeKPIs}
        getRowId={(a) => a.id}
        permissions={modulePermissions}
        primaryActionLabel="New Account"
        onCreate={() => {
          setEditingAccount(null);
          setModalOpen(true);
        }}
        actions={{
          onEdit: handleEdit,
          onDelete: handleDelete,
        }}
        exportEnabled={permissions.export}
        onRowSelect={setSelectedIds}
        batchActions={
          selectedIds.length > 0 && (
            <button
              onClick={() => {
                selectedIds.forEach((id) => deleteAccount.mutate(id));
                setSelectedIds([]);
              }}
              className="text-sm text-destructive hover:text-destructive/80"
            >
              Delete Selected ({selectedIds.length})
            </button>
          )
        }
      />
      <BankAccountFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAccount(null);
        }}
        initialData={editingAccount}
        onSuccess={() => {
          setModalOpen(false);
          setEditingAccount(null);
        }}
      />
    </>
  );
}