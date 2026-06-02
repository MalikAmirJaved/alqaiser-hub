"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import {
  useCreateBankTransaction,
  useUpdateBankTransaction,
  transactionTypeOptions,
  type BankTransaction,
  type TransactionType,
  type CreateBankTransactionData,
} from "@/hooks/finance/useBank";
import { useBankAccounts } from "@/hooks/finance/useBank";

interface BankTransactionFormData {
  bank_account: string;          // UUID string
  transaction_date: string;
  amount: number;
  transaction_type: TransactionType;
  description: string;
  reference: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: BankTransaction | null;
}

export default function BankTransactionFormModal({ open, onClose, initialData }: Props) {
  const { register, handleSubmit, reset, setValue } = useForm<BankTransactionFormData>({
    defaultValues: {
      bank_account: "",
      transaction_date: new Date().toISOString().split("T")[0],
      amount: 0,
      transaction_type: "DEPOSIT",
      description: "",
      reference: "",
    },
  });
  const createTransaction = useCreateBankTransaction();
  const updateTransaction = useUpdateBankTransaction();
  const { data: bankAccounts } = useBankAccounts({ is_active: true });

  useEffect(() => {
    if (initialData) {
      setValue("bank_account", initialData.bank_account);
      setValue("transaction_date", initialData.transaction_date);
      setValue("amount", initialData.amount);
      setValue("transaction_type", initialData.transaction_type);
      setValue("description", initialData.description);
      setValue("reference", initialData.reference);
    } else if (bankAccounts && bankAccounts.length > 0) {
      setValue("bank_account", bankAccounts[0].id);
    }
  }, [initialData, setValue, bankAccounts]);

  const onSubmit = async (data: BankTransactionFormData) => {
    if (initialData) {
      await updateTransaction.mutateAsync({ id: initialData.id, data });
    } else {
      const submitData: CreateBankTransactionData = {
        bank_account: data.bank_account,   // string UUID
        transaction_date: data.transaction_date,
        amount: data.amount,
        transaction_type: data.transaction_type,
        description: data.description,
        reference: data.reference,
      };
      await createTransaction.mutateAsync(submitData);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">
            {initialData ? "Edit Transaction" : "Add Transaction"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Bank Account *</label>
            <select
              {...register("bank_account", { required: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            >
              <option value="">Select bank account</option>
              {bankAccounts?.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.bank_name} - {acc.account_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date *</label>
            <input
              type="date"
              {...register("transaction_date", { required: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <select
              {...register("transaction_type", { required: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            >
              {transactionTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              {...register("amount", { required: true, valueAsNumber: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              {...register("description")}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reference</label>
            <input
              {...register("reference")}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTransaction.isPending || updateTransaction.isPending}
              className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
            >
              {createTransaction.isPending || updateTransaction.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}