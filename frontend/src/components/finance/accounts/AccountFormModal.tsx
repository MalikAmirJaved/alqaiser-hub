// @/components/finance/accounts/AccountFormModal
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import { useCreateAccount, useUpdateAccount, type Account } from "@/hooks/finance/useAccounts";

interface AccountFormData {
  code: string;
  name: string;
  account_type: Account["account_type"];
  parent: string | null;  // This is the parent UUID
  parent_uuid: string | null;
  is_active: boolean;
  description: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: Account | null;
  onSuccess?: () => void;
}

const accountTypeOptions = [
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expense" },
];

export default function AccountFormModal({ open, onClose, initialData, onSuccess }: Props) {
  const { register, handleSubmit, reset, setValue } = useForm<AccountFormData>({
    defaultValues: {
      code: "",
      name: "",
      account_type: "ASSET",
      parent: null,
      is_active: true,
      description: "",
    }
  });
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  useEffect(() => {
    if (initialData) {
      setValue("code", initialData.code);
      setValue("name", initialData.name);
      setValue("account_type", initialData.account_type);
      setValue("parent", initialData.parent ?? null);
      setValue("is_active", initialData.is_active);
      setValue("description", initialData.description);
    } else {
      reset({
        code: "",
        name: "",
        account_type: "ASSET",
        parent: null,
        is_active: true,
        description: "",
      });
    }
  }, [initialData, setValue, reset]);

  const onSubmit = async (data: AccountFormData) => {
    // The backend expects 'parent' field (UUID), not 'parent_uuid'
    const submitData = {
      code: data.code,
      name: data.name,
      account_type: data.account_type,
      parent: data.parent,  // This is the UUID of the parent account
      is_active: data.is_active,
      description: data.description,
    };
    
    if (initialData) {
      await updateAccount.mutateAsync({ id: initialData.id, data: submitData });
    } else {
      await createAccount.mutateAsync(submitData);
    }
    onSuccess?.();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">
            {initialData ? "Edit Account" : "New Account"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Code *</label>
            <input
              {...register("code", { required: "Code is required" })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              placeholder="e.g., 1010"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              {...register("name", { required: "Name is required" })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              placeholder="e.g., Cash"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <select
              {...register("account_type", { required: "Type is required" })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            >
              {accountTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Parent Account</label>
            <input
              {...register("parent")}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              placeholder="Parent account UUID (optional)"
            />
            <p className="text-xs text-muted-foreground mt-1">Enter parent account UUID to create hierarchy</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              {...register("description")}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register("is_active")} className="rounded" />
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