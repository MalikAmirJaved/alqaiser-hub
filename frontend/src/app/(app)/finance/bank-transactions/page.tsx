"use client";

import { useState } from "react";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useBankTransactions, useReconcileBankTransaction, transactionTypeLabels } from "@/hooks/finance/useBank";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";
import { StatusBadge } from "@/components/finance/ui";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Modal, ModalContent, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { useState as useStateLocal } from "react";
import { Label } from "recharts";

export default function BankTransactionsPage() {
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const { data: transactions, isLoading } = useBankTransactions();
  const reconcile = useReconcileBankTransaction();
  const permissions = useFeaturePermissions("FINANCE", "banktransaction");

  const modulePermissions: ModulePermissions = {
    create: false, // transactions are usually imported
    update: false,
    delete: false,
    view: permissions.view,
    export: true,
  };

  const handleReconcile = (txn: any) => {
    setSelectedTransaction(txn);
    setReconcileModalOpen(true);
  };

  const submitReconcile = async () => {
    if (selectedTransaction && paymentId) {
      await reconcile.mutateAsync({ id: selectedTransaction.id, paymentId });
      setReconcileModalOpen(false);
      setPaymentId("");
      setSelectedTransaction(null);
    }
  };

  const columns = [
    { key: "transaction_date", label: "Date", sortable: true },
    { key: "description", label: "Description" },
    { key: "transaction_type", label: "Type", render: (val: string) => transactionTypeLabels[val] },
    { key: "amount", label: "Amount", align: "right" as const, render: (val: number) => formatCurrency(val), sortable: true },
    { key: "reference", label: "Reference" },
    { key: "reconciled", label: "Status", render: (val: boolean) => (val ? <StatusBadge status="Cleared" /> : <StatusBadge status="Pending" />) },
  ];

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Banking & Cash", "Bank Transactions"]}
        title="Bank Transactions"
        description="View and reconcile bank transactions"
        data={transactions || []}
        isLoading={isLoading}
        columns={columns}
        getRowId={(t) => t.id}
        permissions={modulePermissions}
        exportEnabled
        actions={{
          onPost: (txn) => !txn.reconciled && handleReconcile(txn),
          canPost: (txn) => !txn.reconciled,
        }}
      />
      <Modal open={reconcileModalOpen} onOpenChange={setReconcileModalOpen}>
        <ModalContent>
          <ModalHeader>Reconcile Transaction</ModalHeader>
          <div className="py-4">
            <Label>Select Payment</Label>
            <Select value={paymentId} onValueChange={setPaymentId}>
              <SelectTrigger><SelectValue placeholder="Choose a payment" /></SelectTrigger>
              <SelectContent>
                {/* You'd need to fetch unreconciled payments here */}
                <SelectItem value="1">Payment #123</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setReconcileModalOpen(false)}>Cancel</Button>
            <Button onClick={submitReconcile}>Reconcile</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}