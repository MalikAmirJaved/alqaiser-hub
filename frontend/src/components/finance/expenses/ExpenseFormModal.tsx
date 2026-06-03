"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import { useCreateExpense, useUpdateExpense, expenseCategoryOptions } from "@/hooks/finance/useExpenses";

interface ExpenseFormData {
  expense_number: string;
  category: string;
  expense_date: string;
  amount: number;
  description: string;
  notes: string;
  journal_entry: string | null;  
}

export default function ExpenseFormModal({ open, onClose, initialData, onSuccess }: { open: boolean; onClose: () => void; initialData?: any; onSuccess?: () => void; }) {
  const { register, handleSubmit, reset, setValue } = useForm<ExpenseFormData>({
    defaultValues: {
      expense_number: "",
      category: "OTHER",
      expense_date: new Date().toISOString().split("T")[0],
      amount: 0,
      description: "",
      notes: "",
    },
  });
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();

  useEffect(() => {
    if (initialData) {
      setValue("expense_number", initialData.expense_number);
      setValue("category", initialData.category);
      setValue("expense_date", initialData.expense_date);
      setValue("amount", initialData.amount);
      setValue("description", initialData.description);
      setValue("notes", initialData.notes);
    } else {
      reset();
    }
  }, [initialData, setValue, reset]);

  const onSubmit = async (data: ExpenseFormData) => {
    if (initialData) {
      await updateExpense.mutateAsync({ id: initialData.id, data });
    } else {
      await createExpense.mutateAsync(data);
    }
    onSuccess?.();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative max-w-lg w-full rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex justify-between items-center border-b border-border p-4">
          <h2 className="text-lg font-semibold">{initialData ? "Edit Expense" : "New Expense"}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div><label className="block text-sm mb-1">Expense Number *</label><input {...register("expense_number", { required: true })} className="w-full px-3 py-2 border border-border rounded-md bg-background" /></div>
          <div><label className="block text-sm mb-1">Category *</label><select {...register("category", { required: true })} className="w-full px-3 py-2 border border-border rounded-md bg-background">{expenseCategoryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
          <div><label className="block text-sm mb-1">Date *</label><input type="date" {...register("expense_date", { required: true })} className="w-full px-3 py-2 border border-border rounded-md bg-background" /></div>
          <div><label className="block text-sm mb-1">Amount *</label><input type="number" step="0.01" {...register("amount", { required: true, valueAsNumber: true })} className="w-full px-3 py-2 border border-border rounded-md bg-background" /></div>
          <div><label className="block text-sm mb-1">Description</label><textarea {...register("description")} rows={2} className="w-full px-3 py-2 border border-border rounded-md bg-background" /></div>
          <div><label className="block text-sm mb-1">Notes</label><textarea {...register("notes")} rows={2} className="w-full px-3 py-2 border border-border rounded-md bg-background" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 h-9 rounded-md border border-border">Cancel</button>
            <button type="submit" disabled={createExpense.isPending || updateExpense.isPending} className="px-4 h-9 rounded-md bg-primary text-primary-foreground">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}