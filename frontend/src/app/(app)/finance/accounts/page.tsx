"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useAccounts, useDeleteAccount, type Account } from "@/hooks/finance/useAccounts";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { Plus, Pencil, Trash2 } from "lucide-react";
import AccountFormModal from "@/components/finance/accounts/AccountFormModal";
import type { ReactNode } from "react";

const accountTypeLabels: Record<Account["account_type"], string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expense",
};

// Define columns with proper typing - render must accept 2 parameters
const columns: Column[] = [
  { key: "code", label: "Code", sortable: true },
  { key: "name", label: "Name", sortable: true },
  {
    key: "account_type",
    label: "Type",
    sortable: true,
    render: (value: unknown, _row: Record<string, unknown>): ReactNode =>
  accountTypeLabels[value as keyof typeof accountTypeLabels] ?? String(value),
  },
  {
    key: "is_active",
    label: "Active",
    render: (value: unknown, _row: Record<string, unknown>) => (value ? "Yes" : "No"),
  },
  { key: "description", label: "Description" },
];

export default function AccountsPage() {
  const permissions = useFeaturePermissions("FINANCE", "account");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const { data: accounts, isLoading } = useAccounts({ search, account_type: typeFilter || undefined });
  const deleteAccount = useDeleteAccount();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const handleDelete = (account: Account) => {
    confirm({
      title: "Delete Account",
      message: `Are you sure you want to delete account "${account.code} - ${account.name}"? This action cannot be undone.`,
      onConfirm: () => deleteAccount.mutate(account.id),
    });
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setModalOpen(true);
  };

  // Convert Account[] to Record<string, unknown>[] for TableView
  const tableData = (accounts || []).map(account => ({
    ...account,
  })) as Record<string, unknown>[];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Chart of Accounts"
        subtitle="Manage your chart of accounts for financial reporting"
        actions={
          <div className="flex flex-wrap gap-2">
            {permissions.create && (
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                New Account
              </button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by code or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background w-full sm:w-64"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        >
          <option value="">All Types</option>
          <option value="ASSET">Asset</option>
          <option value="LIABILITY">Liability</option>
          <option value="EQUITY">Equity</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </select>
      </div>

      <TableView
        columns={columns}
        data={tableData}
        loading={isLoading}
        actions={(row: Record<string, unknown>, idx: number) => {
          const account = accounts?.find(a => a.id === row.id);
          if (!account) return null;
          return (
            <div className="flex items-center justify-end gap-1">
              {permissions.update && (
                <button
                  onClick={() => handleEdit(account)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {permissions.delete && (
                <button
                  onClick={() => handleDelete(account)}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        }}
      />

      <AccountFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAccount(null);
        }}
        initialData={editingAccount}
      />

      <ConfirmModal />
    </div>
  );
}