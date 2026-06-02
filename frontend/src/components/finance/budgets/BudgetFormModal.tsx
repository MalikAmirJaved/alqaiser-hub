"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import { useCreateBudget, useUpdateBudget } from "@/hooks/finance/useBudgets";
import { useAccounts } from "@/hooks/finance/useAccounts";

interface BudgetFormData {
  account: string;
  period_type: "MONTHLY" | "QUARTERLY" | "YEARLY";
  year: number;
  month: number | null;
  quarter: number | null;
  amount: number;
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: any;
}

// Acceptable account types for budgeting
const ACCEPTABLE_ACCOUNT_TYPES = ["EXPENSE", "INCOME"];

export default function BudgetFormModal({ open, onClose, initialData }: Props) {
  const { register, handleSubmit, reset, setValue, watch } = useForm<BudgetFormData>({
    defaultValues: {
      account: "",
      period_type: "MONTHLY",
      year: new Date().getFullYear(),
      month: null,
      quarter: null,
      amount: 0,
      notes: "",
    },
  });
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  
  // Fetch both expense and income accounts
  const { data: expenseAccounts } = useAccounts({ account_type: "EXPENSE" });
  const { data: incomeAccounts } = useAccounts({ account_type: "INCOME" });
  
  // Combine and filter only acceptable account types
  const accounts = useMemo(() => {
    const all = [...(expenseAccounts || []), ...(incomeAccounts || [])];
    // Filter to only include EXPENSE or INCOME accounts
    const filtered = all.filter(acc => ACCEPTABLE_ACCOUNT_TYPES.includes(acc.account_type));
    // Deduplicate by id
    const unique = new Map();
    filtered.forEach(acc => {
      if (!unique.has(acc.id)) {
        unique.set(acc.id, acc);
      }
    });
    return Array.from(unique.values());
  }, [expenseAccounts, incomeAccounts]);
  
  const periodType = watch("period_type");

  useEffect(() => {
    if (initialData) {
      setValue("account", initialData.account);
      setValue("period_type", initialData.period_type);
      setValue("year", initialData.year);
      setValue("month", initialData.month);
      setValue("quarter", initialData.quarter);
      setValue("amount", initialData.amount);
      setValue("notes", initialData.notes);
    } else {
      reset();
    }
  }, [initialData, setValue, reset]);

  const onSubmit = async (data: BudgetFormData) => {
    // Double-check validation before submitting
    const selectedAccount = accounts.find(acc => acc.id === data.account);
    if (!selectedAccount) {
      alert("Please select a valid account");
      return;
    }
    if (!ACCEPTABLE_ACCOUNT_TYPES.includes(selectedAccount.account_type)) {
      alert(`Account "${selectedAccount.name}" is type "${selectedAccount.account_type}". Budgets can only be set for Expense or Income accounts.`);
      return;
    }

    const submitData = {
      account: data.account,
      period_type: data.period_type,
      year: data.year,
      month: data.month === null ? undefined : data.month,
      quarter: data.quarter === null ? undefined : data.quarter,
      amount: data.amount,
      notes: data.notes,
    };
    
    try {
      if (initialData) {
        await updateBudget.mutateAsync({ id: initialData.id, data: submitData });
      } else {
        await createBudget.mutateAsync(submitData);
      }
      onClose();
    } catch (err: any) {
      console.error("Budget save error:", err);
      alert(err?.response?.data?.detail || err?.message || "Failed to save budget");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="relative max-w-lg w-full bg-card border border-border rounded-2xl shadow-2xl">
        <div className="flex justify-between items-center border-b p-4">
          <h2 className="text-lg font-semibold">{initialData ? "Edit Budget" : "New Budget"}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm mb-1">Account *</label>
            <select {...register("account", { required: true })} className="w-full p-2 border rounded-md bg-background">
              <option value="">Select account</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name} ({acc.account_type})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Only Expense and Income accounts can have budgets</p>
          </div>

          <div>
            <label className="block text-sm mb-1">Period Type *</label>
            <select {...register("period_type")} className="w-full p-2 border rounded-md bg-background">
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Year *</label>
            <input
              type="number"
              {...register("year", { required: true, valueAsNumber: true })}
              className="w-full p-2 border rounded-md bg-background"
            />
          </div>

          {periodType === "MONTHLY" && (
            <div>
              <label className="block text-sm mb-1">Month *</label>
              <input
                type="number"
                min="1"
                max="12"
                {...register("month", { required: true, valueAsNumber: true })}
                className="w-full p-2 border rounded-md bg-background"
              />
            </div>
          )}

          {periodType === "QUARTERLY" && (
            <div>
              <label className="block text-sm mb-1">Quarter *</label>
              <input
                type="number"
                min="1"
                max="4"
                {...register("quarter", { required: true, valueAsNumber: true })}
                className="w-full p-2 border rounded-md bg-background"
              />
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              {...register("amount", { required: true, valueAsNumber: true })}
              className="w-full p-2 border rounded-md bg-background"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Notes</label>
            <textarea {...register("notes")} rows={2} className="w-full p-2 border rounded-md bg-background" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md hover:bg-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createBudget.isPending || updateBudget.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {createBudget.isPending || updateBudget.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}