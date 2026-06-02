"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import {
  useBankTransactions,
  useDeleteBankTransaction,
  useReconcileBankTransaction,
  transactionTypeLabels,
  type BankTransaction,
} from "@/hooks/finance/useBank";
import { useBankAccounts } from "@/hooks/finance/useBank";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { Plus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import BankTransactionFormModal from "@/components/finance/bank/BankTransactionFormModal";
import ReconcileModal from "@/components/finance/bank/ReconcileModal";
import { formatCurrency } from "@/lib/currency";
import type { ReactNode } from "react";

const columns: Column[] = [
  { key: "transaction_date", label: "Date", sortable: true },
  {
    key: "transaction_type",
    label: "Type",
    render: (val: unknown): ReactNode =>
    transactionTypeLabels[val as keyof typeof transactionTypeLabels] ?? String(val),
  },
  { key: "description", label: "Description" },
  { key: "reference", label: "Reference" },
  {
    key: "amount",
    label: "Amount",
    sortable: true,
    render: (val: unknown, row: Record<string, unknown>) => {
      const amount = Number(val);
      const isWithdrawal = row.transaction_type === "WITHDRAWAL" || row.transaction_type === "FEE";
      return (
        <span className={isWithdrawal ? "text-destructive" : "text-success"}>
          {isWithdrawal ? "-" : "+"}
          {formatCurrency(Math.abs(amount))}
        </span>
      );
    },
  },
  {
    key: "reconciled",
    label: "Reconciled",
    render: (val: unknown) =>
      val ? (
        <span className="inline-flex items-center gap-1 text-success">
          <CheckCircle className="w-3 h-3" /> Yes
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <XCircle className="w-3 h-3" /> No
        </span>
      ),
  },
];

export default function BankTransactionsPage() {
  const permissions = useFeaturePermissions("FINANCE", "banktransaction");
  const { data: bankAccounts } = useBankAccounts({ is_active: true });
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>(undefined);
  const [showUnreconciledOnly, setShowUnreconciledOnly] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: transactions, isLoading } = useBankTransactions({
    bank_account: selectedAccount,
    reconciled: showUnreconciledOnly ? false : undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  });

  const deleteTransaction = useDeleteBankTransaction();
  const reconcile = useReconcileBankTransaction();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BankTransaction | null>(null);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);

  const handleDelete = (txn: BankTransaction) => {
    confirm({
      title: "Delete Transaction",
      message: `Are you sure you want to delete this transaction?`,
      onConfirm: () => deleteTransaction.mutate(txn.id),
    });
  };

  const handleReconcile = (txn: BankTransaction) => {
    setSelectedTransaction(txn);
    setReconcileModalOpen(true);
  };

  const tableData = (transactions || []).map((t) => ({ ...t })) as Record<string, unknown>[];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Bank Transactions"
        subtitle="Manage and reconcile bank transactions"
        actions={
          <div className="flex flex-wrap gap-2">
            {permissions.create && (
              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                Add Transaction
              </button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
  value={selectedAccount || ""}
  onChange={(e) => setSelectedAccount(e.target.value || undefined)}
  className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
>
  {bankAccounts?.map((acc) => (
    <option key={acc.id} value={acc.id}>
      {acc.bank_name} - {acc.account_name}
    </option>
  ))}
</select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showUnreconciledOnly}
            onChange={(e) => setShowUnreconciledOnly(e.target.checked)}
          />
          Unreconciled only
        </label>
      </div>

      <TableView
        columns={columns}
        data={tableData}
        loading={isLoading}
        actions={(row: Record<string, unknown>) => {
          const txn = transactions?.find((t) => t.id === row.id);
          if (!txn) return null;
          return (
            <div className="flex items-center justify-end gap-1">
              {!txn.reconciled && permissions.update && (
                <button
                  onClick={() => handleReconcile(txn)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                  title="Reconcile"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
              {permissions.update && (
                <button
                  onClick={() => {
                    setEditingTransaction(txn);
                    setModalOpen(true);
                  }}
                  className="p-1.5 rounded-md hover:bg-muted"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {permissions.delete && (
                <button
                  onClick={() => handleDelete(txn)}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        }}
      />

      <BankTransactionFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTransaction(null);
        }}
        initialData={editingTransaction}
      />

      <ReconcileModal
        open={reconcileModalOpen}
        onClose={() => {
          setReconcileModalOpen(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
        onReconcile={async (paymentId) => {
          if (selectedTransaction) {
            await reconcile.mutateAsync({ id: selectedTransaction.id, paymentId });
          }
        }}
      />

      <ConfirmModal />
    </div>
  );
}