"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { X, RotateCw } from "lucide-react";
import { useCreateExpense, useUpdateExpense, expenseCategoryOptions } from "@/hooks/finance/useExpenses";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useAutoCode } from "@/hooks/useAutoCode";

interface ExpenseFormData {
  expense_number: string;
  category: string;
  expense_date: string;
  amount: number;
  description: string;
  notes: string;
  supplier: string;         // UUID of the supplier
  pay_immediately: boolean;
}

export default function ExpenseFormModal({ 
  open, 
  onClose, 
  initialData, 
  onSuccess 
}: { 
  open: boolean; 
  onClose: () => void; 
  initialData?: any; 
  onSuccess?: () => void;
}) {
  const { register, handleSubmit, reset, setValue, watch } = useForm<ExpenseFormData>({
    defaultValues: {
      expense_number: "",
      category: "OTHER",
      expense_date: new Date().toISOString().split("T")[0],
      amount: 0,
      description: "",
      notes: "",
      supplier: "",
      pay_immediately: false,
    },
  });
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers();
  const { generateCode, validateCode } = useAutoCode("expense");

  const supplierValue = watch("supplier");
  const payImmediately = watch("pay_immediately");

  useEffect(() => {
    if (initialData) {
      setValue("expense_number", initialData.expense_number);
      setValue("category", initialData.category);
      setValue("expense_date", initialData.expense_date);
      setValue("amount", initialData.amount);
      setValue("description", initialData.description);
      setValue("notes", initialData.notes);
      setValue("supplier", initialData.supplier || "");
      setValue("pay_immediately", false);
    } else {
      reset();
      generateCode().then(code => setValue("expense_number", code)).catch(() => {});
    }
  }, [initialData, setValue, reset, open]);

  const onSubmit = async (data: ExpenseFormData) => {
    const payload = {
      ...data,
      amount: Number(data.amount),
      // Only include pay_immediately if a supplier is selected
      pay_immediately: data.supplier ? data.pay_immediately : false,
    };
    if (initialData) {
      await updateExpense.mutateAsync({ id: initialData.id, data: payload });
    } else {
      await createExpense.mutateAsync(payload);
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
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm mb-1">Expense Number *</label>
            <div className="flex gap-2">
              <input {...register("expense_number", { required: true })} onBlur={(e) => validateCode(e.target.value)} className="flex-1 px-3 py-2 border border-border rounded-md bg-background font-mono" />
              <button
                type="button"
                onClick={() => generateCode().then(code => setValue("expense_number", code)).catch(() => {})}
                className="h-9 w-9 flex items-center justify-center rounded-md border border-border hover:bg-muted transition flex-shrink-0"
                title="Generate new code"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Category *</label>
            <select {...register("category", { required: true })} className="w-full px-3 py-2 border border-border rounded-md bg-background">
              {expenseCategoryOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Date *</label>
            <input type="date" {...register("expense_date", { required: true })} className="w-full px-3 py-2 border border-border rounded-md bg-background" />
          </div>
          <div>
            <label className="block text-sm mb-1">Amount *</label>
            <input type="number" step="0.01" {...register("amount", { required: true, valueAsNumber: true })} className="w-full px-3 py-2 border border-border rounded-md bg-background" />
          </div>
          <div>
            <label className="block text-sm mb-1">Description</label>
            <textarea {...register("description")} rows={2} className="w-full px-3 py-2 border border-border rounded-md bg-background" />
          </div>
          <div>
            <label className="block text-sm mb-1">Notes</label>
            <textarea {...register("notes")} rows={2} className="w-full px-3 py-2 border border-border rounded-md bg-background" />
          </div>

          {/* Supplier / Vendor field */}
          <div>
            <label className="block text-sm mb-1">Vendor (Supplier)</label>
            <select {...register("supplier")} className="w-full px-3 py-2 border border-border rounded-md bg-background" disabled={suppliersLoading}>
              <option value="">-- None (manual expense) --</option>
              {suppliers?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              If a vendor is selected, a Supplier Bill will be auto‑created and linked to this expense.
            </p>
          </div>

          {/* Pay immediately checkbox – only shown when a supplier is selected */}
          {supplierValue && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="pay_immediately"
                {...register("pay_immediately")}
                className="mr-2"
              />
              <label htmlFor="pay_immediately" className="text-sm">
                Pay this bill immediately (auto‑confirm payment)
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 h-9 rounded-md border border-border">Cancel</button>
            <button
              type="submit"
              disabled={createExpense.isPending || updateExpense.isPending}
              className="px-4 h-9 rounded-md bg-primary text-primary-foreground"
            >
              {createExpense.isPending || updateExpense.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}