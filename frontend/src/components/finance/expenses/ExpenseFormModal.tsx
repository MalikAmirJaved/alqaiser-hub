"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { X, RotateCw } from "lucide-react";
import { useCreateExpense, useUpdateExpense, expenseCategoryOptions } from "@/hooks/finance/useExpenses";
import { useSuppliers, useCreateSupplier } from "@/hooks/useSuppliers";
import { useAutoCode } from "@/hooks/useAutoCode";
import { useQueryClient } from "@tanstack/react-query";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { FormModal } from "@/components/inventory/supplier/FormModal";

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
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const queryClient = useQueryClient();
  const createSupplier = useCreateSupplier();
  const { generateCode: genSupplierCode } = useAutoCode("supplier");

  const supplierFormFields = [
    { name: "code", label: "Code", type: "code" as const, required: true, placeholder: "e.g., SUP-001" },
    { name: "name", label: "Name", type: "text" as const, required: true, placeholder: "Company name" },
    { name: "contact_person", label: "Contact Person", type: "text" as const, placeholder: "Full name" },
    { name: "email", label: "Email", type: "email" as const, placeholder: "contact@company.com" },
    { name: "phone", label: "Phone", type: "tel" as const, placeholder: "+1 234 567 8900" },
    { name: "address_line", label: "Address Line", type: "textarea" as const, placeholder: "Street address" },
    { name: "country", label: "Country", type: "text" as const, placeholder: "Country" },
    { name: "state", label: "State", type: "text" as const, placeholder: "State/Province" },
    { name: "city", label: "City", type: "text" as const, placeholder: "City" },
    { name: "postal_code", label: "Postal Code", type: "text" as const, placeholder: "Postal code" },
    {
      name: "status", label: "Status", type: "select" as const,
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "suspended", label: "Suspended" },
      ],
    },
  ];

  const handleCreateSupplier = async (data: any) => {
    const result: any = await createSupplier.mutateAsync(data);
    setShowSupplierForm(false);
    await queryClient.invalidateQueries({ queryKey: ["inventory_supplier"] });
    const supplierId = result?.id || result?.data?.id || result?._id;
    if (supplierId) {
      setValue("supplier", supplierId);
    }
  };

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
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers({
  status: "active",
});
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
    if (!data.supplier) {
      return;
    }
    const payload = {
      ...data,
      amount: Number(data.amount),
      pay_immediately: data.pay_immediately,
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
            <SearchableSelect
              value={watch("category") || "OTHER"}
              onChange={(val) => setValue("category", val)}
              options={expenseCategoryOptions}
              placeholder="Select category"
            />
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
            <label className="block text-sm mb-1">Vendor (Supplier) *</label>
            <SearchableSelect
              value={watch("supplier") || ""}
              onChange={(val) => setValue("supplier", val)}
              required
              options={(suppliers || []).map((s: any) => ({ value: s.id, label: s.name }))}
              placeholder="Select a vendor…"
              onAddNew={() => setShowSupplierForm(true)}
              addNewLabel="+ Create New Vendor"
            />
            <p className="text-xs text-muted-foreground mt-1">
              A Supplier Bill will be auto‑created and linked to this expense.
            </p>
          </div>

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

      <FormModal
        open={showSupplierForm}
        onClose={() => setShowSupplierForm(false)}
        title="Add New Supplier"
        fields={supplierFormFields}
        initialData={{}}
        onSubmit={handleCreateSupplier}
        isSubmitting={createSupplier.isPending}
        onGenerateCode={genSupplierCode}
      />
    </div>
  );
}