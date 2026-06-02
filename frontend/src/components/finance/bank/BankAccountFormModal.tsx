"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import {
  useCreateBankAccount,
  useUpdateBankAccount,
  type BankAccount,
} from "@/hooks/finance/useBank";

interface BankAccountFormData {
  account_name: string;
  account_number: string;
  bank_name: string;
  opening_balance: number;
  currency: string;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: BankAccount | null;
}

export default function BankAccountFormModal({ open, onClose, initialData }: Props) {
  const { register, handleSubmit, reset, setValue } = useForm<BankAccountFormData>({
    defaultValues: {
      account_name: "",
      account_number: "",
      bank_name: "",
      opening_balance: 0,
      currency: "USD",
      is_active: true,
    },
  });
  const createAccount = useCreateBankAccount();
  const updateAccount = useUpdateBankAccount();

  useEffect(() => {
    if (initialData) {
      setValue("account_name", initialData.account_name);
      setValue("account_number", initialData.account_number);
      setValue("bank_name", initialData.bank_name);
      setValue("opening_balance", initialData.opening_balance);
      setValue("currency", initialData.currency);
      setValue("is_active", initialData.is_active);
    } else {
      reset({
        account_name: "",
        account_number: "",
        bank_name: "",
        opening_balance: 0,
        currency: "USD",
        is_active: true,
      });
    }
  }, [initialData, setValue, reset]);

  const onSubmit = async (data: BankAccountFormData) => {
    if (initialData) {
      await updateAccount.mutateAsync({ id: initialData.id, data });
    } else {
      await createAccount.mutateAsync(data);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">
            {initialData ? "Edit Bank Account" : "New Bank Account"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Bank Name *</label>
            <input
              {...register("bank_name", { required: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Account Name *</label>
            <input
              {...register("account_name", { required: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Account Number *</label>
            <input
              {...register("account_number", { required: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Opening Balance</label>
            <input
              type="number"
              step="0.01"
              {...register("opening_balance", { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <select
              {...register("currency")}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="PKR">PKR</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("is_active")} />
              Active
            </label>
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
              disabled={createAccount.isPending || updateAccount.isPending}
              className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
            >
              {createAccount.isPending || updateAccount.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}