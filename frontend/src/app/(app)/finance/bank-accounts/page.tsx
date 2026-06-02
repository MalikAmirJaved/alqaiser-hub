"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import {
  useBankAccounts,
  useDeleteBankAccount,
  type BankAccount,
} from "@/hooks/finance/useBank";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { Plus, Pencil, Trash2 } from "lucide-react";
import BankAccountFormModal from "@/components/finance/bank/BankAccountFormModal";
import { formatCurrency } from "@/lib/currency";

const columns: Column[] = [
  { key: "bank_name", label: "Bank", sortable: true },
  { key: "account_name", label: "Account Name", sortable: true },
  { key: "account_number", label: "Account Number" },
  {
    key: "current_balance",
    label: "Balance",
    sortable: true,
    render: (val: unknown) => formatCurrency(Number(val)),
  },
  { key: "is_active", label: "Active", render: (val: unknown) => (val ? "Yes" : "No") },
];

export default function BankAccountsPage() {
  const permissions = useFeaturePermissions("FINANCE", "bankaccount");
  const [search, setSearch] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const { data: accounts, isLoading } = useBankAccounts({
    search,
    is_active: showActiveOnly ? true : undefined,
  });
  const deleteAccount = useDeleteBankAccount();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const handleDelete = (account: BankAccount) => {
    confirm({
      title: "Delete Bank Account",
      message: `Are you sure you want to delete "${account.bank_name} - ${account.account_name}"? This will also soft-delete all related transactions.`,
      onConfirm: () => deleteAccount.mutate(account.id),
    });
  };

  const tableData = (accounts || []).map((a) => ({ ...a })) as Record<string, unknown>[];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Bank Accounts"
        subtitle="Manage your company bank accounts"
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
                New Bank Account
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by bank or account name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background w-full sm:w-64"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={(e) => setShowActiveOnly(e.target.checked)}
          />
          Show active only
        </label>
      </div>

      <TableView
        columns={columns}
        data={tableData}
        loading={isLoading}
        actions={(row: Record<string, unknown>) => {
          const account = accounts?.find((a) => a.id === row.id);
          if (!account) return null;
          return (
            <div className="flex items-center justify-end gap-1">
              {permissions.update && (
                <button
                  onClick={() => {
                    setEditingAccount(account);
                    setModalOpen(true);
                  }}
                  className="p-1.5 rounded-md hover:bg-muted"
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

      <BankAccountFormModal
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