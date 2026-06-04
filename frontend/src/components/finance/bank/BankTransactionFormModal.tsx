"use client";

import { useEffect, useState } from "react";
import { useCreateBankTransaction, useUpdateBankTransaction, useBankAccounts, transactionTypeOptions } from "@/hooks/finance/useBank";
import { Modal, ModalContent, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BankTransactionFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: any | null;
  onSuccess?: () => void;
}

export default function BankTransactionFormModal({ open, onClose, initialData, onSuccess }: BankTransactionFormModalProps) {
  const [bankAccountId, setBankAccountId] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [transactionType, setTransactionType] = useState<"DEPOSIT" | "WITHDRAWAL" | "FEE" | "INTEREST">("DEPOSIT");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");

  const { data: bankAccounts } = useBankAccounts();
  const createTransaction = useCreateBankTransaction();
  const updateTransaction = useUpdateBankTransaction();

  useEffect(() => {
    if (initialData) {
      setBankAccountId(initialData.bank_account);
      setTransactionDate(initialData.transaction_date);
      setAmount(String(initialData.amount));
      setTransactionType(initialData.transaction_type);
      setDescription(initialData.description || "");
      setReference(initialData.reference || "");
    } else {
      reset();
    }
  }, [initialData]);

  const reset = () => {
    setBankAccountId("");
    setTransactionDate(new Date().toISOString().split("T")[0]);
    setAmount("");
    setTransactionType("DEPOSIT");
    setDescription("");
    setReference("");
  };

  const handleSubmit = async () => {
    const data = {
      bank_account: bankAccountId,
      transaction_date: transactionDate,
      amount: parseFloat(amount),
      transaction_type: transactionType,
      description,
      reference,
    };

    if (initialData) {
      await updateTransaction.mutateAsync({ id: initialData.id, data });
    } else {
      await createTransaction.mutateAsync(data);
    }
    onSuccess?.();
    onClose();
  };

  return (
    <Modal open={open} onOpenChange={onClose}>
      <ModalContent>
        <ModalHeader>{initialData ? "Edit Bank Transaction" : "New Bank Transaction"}</ModalHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Bank Account</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.account_name} ({acc.bank_name}) - {acc.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Transaction Date</Label>
            <Input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
          </div>

          <div>
            <Label>Transaction Type</Label>
            <Select value={transactionType} onValueChange={(v: any) => setTransactionType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {transactionTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Amount</Label>
            <Input 
              type="number" 
              step="0.01" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              placeholder="0.00"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Transaction description" />
          </div>

          <div>
            <Label>Reference Number (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check #, transfer ID, etc." />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createTransaction.isPending || updateTransaction.isPending}>
            {initialData ? "Update" : "Create"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}