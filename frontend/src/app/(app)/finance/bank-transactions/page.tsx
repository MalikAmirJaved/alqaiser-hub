// frontend/src/app/(app)/finance/bank-transactions/page.tsx
"use client";

import { useState } from "react";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useBankTransactions, useCreateBankTransaction, useDeleteBankTransaction, useReconcileBankTransaction, transactionTypeLabels } from "@/hooks/finance/useBank";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";
import { StatusBadge } from "@/components/finance/ui";
import BankTransactionFormModal from "@/components/finance/bank/BankTransactionFormModal";
import { toast } from "sonner";

export default function BankTransactionsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  
  const { data: transactions, isLoading, refetch } = useBankTransactions();
  const createTransaction = useCreateBankTransaction();
  const deleteTransaction = useDeleteBankTransaction();
  const reconcileTransaction = useReconcileBankTransaction();
  const permissions = useFeaturePermissions("FINANCE", "bank_transaction");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: permissions.export,
  };

  // Handle reconcile - this opens a modal to select the matching payment
  const handleReconcile = (transaction: any) => {
    if (transaction.reconciled) {
      toast.error("Transaction already reconciled");
      return;
    }
    setSelectedTransaction(transaction);
    setReconcileModalOpen(true);
  };

  const handleConfirmReconcile = async () => {
    if (!selectedTransaction || !selectedPaymentId) {
      toast.error("Please select a payment to reconcile");
      return;
    }
    
    try {
      await reconcileTransaction.mutateAsync({
        id: selectedTransaction.id,
        paymentId: selectedPaymentId,
      });
      toast.success("Transaction reconciled successfully");
      refetch();
      setReconcileModalOpen(false);
      setSelectedTransaction(null);
      setSelectedPaymentId("");
    } catch (error: any) {
      toast.error(error.message || "Failed to reconcile");
    }
  };

  const columns = [
    { key: "transaction_date", label: "Date", sortable: true },
    { key: "description", label: "Description" },
    { key: "bank_account_name", label: "Account", render: (val: any, row: any) => row.bank_account_name || "-" },
    { key: "transaction_type", label: "Type", render: (val: string) => transactionTypeLabels[val] },
    { key: "amount", label: "Amount", align: "right" as const, render: (val: number) => formatCurrency(val), sortable: true },
    { key: "reference", label: "Reference" },
    { key: "reconciled", label: "Status", render: (val: boolean) => (val ? <StatusBadge status="Cleared" /> : <StatusBadge status="Pending" />) },
  ];

  const computeKPIs = (data: any[]) => {
    const totalDeposits = data
      .filter((t) => t.transaction_type === "DEPOSIT")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalWithdrawals = data
      .filter((t) => t.transaction_type === "WITHDRAWAL")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return [
      { label: "Total Deposits", value: totalDeposits, tone: "success" as const, isCurrency: true },
      { label: "Total Withdrawals", value: totalWithdrawals, tone: "destructive" as const, isCurrency: true },
      { label: "Net Flow", value: totalDeposits - totalWithdrawals, tone: "info" as const, isCurrency: true },
      { label: "Transactions", value: data.length, isCurrency: false, tone: "info" as const },
    ];
  };

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Banking & Cash", "Bank Transactions"]}
        title="Bank Transactions"
        description="View, create, and reconcile bank transactions"
        data={transactions || []}
        isLoading={isLoading}
        columns={columns}
        kpis={computeKPIs}
        getRowId={(t) => t.id}
        permissions={modulePermissions}
        primaryActionLabel="New Transaction"
        onCreate={() => {
          setEditingTransaction(null);
          setModalOpen(true);
        }}
        actions={{
          onDelete: (txn) => deleteTransaction.mutate(txn.id),
          onPost: (txn) => !txn.reconciled && handleReconcile(txn),
          canPost: (txn) => !txn.reconciled,
        }}
        exportEnabled
      />
      <BankTransactionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editingTransaction}
        onSuccess={() => setModalOpen(false)}
      />
      
      {/* Reconcile Modal */}
      {reconcileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Reconcile Transaction</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Transaction</p>
                <p className="font-medium">{selectedTransaction?.description}</p>
                <p className="text-sm">Amount: {formatCurrency(selectedTransaction?.amount)}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Select Payment to reconcile with</label>
                <select
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2"
                  value={selectedPaymentId}
                  onChange={(e) => setSelectedPaymentId(e.target.value)}
                >
                  <option value="">Select a payment...</option>
                  {/* This would need to fetch payments that are not yet reconciled */}
                  <option value="temp">Payment #123 - $2,400</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Note: You need to fetch available payments from the backend
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setReconcileModalOpen(false)}
                className="px-4 py-2 rounded-md border border-border hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReconcile}
                disabled={!selectedPaymentId || reconcileTransaction.isPending}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {reconcileTransaction.isPending ? "Reconciling..." : "Reconcile"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}