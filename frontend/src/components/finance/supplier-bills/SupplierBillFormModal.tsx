"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { X, RotateCw } from "lucide-react";
import {
  useCreateSupplierBill,
  useUpdateSupplierBill,
  type SupplierBill,
} from "@/hooks/finance/useSupplierBills";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useAutoCode } from "@/hooks/useAutoCode";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

interface SupplierBillFormData {
  bill_number: string;
  supplier: string;
  purchase_order: string | null;
  bill_date: string;
  due_date: string;
  amount: number;
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: SupplierBill | null;
  onSuccess?: () => void;
}

const toNumber = (value: number | string | undefined): number => {
  if (value === undefined || value === null) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
};

export default function SupplierBillFormModal({ open, onClose, initialData, onSuccess }: Props) {
  const { register, handleSubmit, reset, setValue, watch } = useForm<SupplierBillFormData>({
    defaultValues: {
      bill_number: "",
      supplier: "",
      purchase_order: null,
      bill_date: new Date().toISOString().split("T")[0],
      due_date: "",
      amount: 0,
      notes: "",
    },
  });
  const createBill = useCreateSupplierBill();
  const updateBill = useUpdateSupplierBill();
  const { data: suppliers } = useSuppliers({
  status: "active",
});
  const { generateCode, validateCode } = useAutoCode("supplier_bill");

  useEffect(() => {
    if (initialData) {
      setValue("bill_number", initialData.bill_number);
      setValue("supplier", initialData.supplier);
      setValue("purchase_order", initialData.purchase_order);
      setValue("bill_date", initialData.bill_date);
      setValue("due_date", initialData.due_date);
      setValue("amount", toNumber(initialData.amount));
      setValue("notes", initialData.notes);
    } else {
      reset({
        bill_number: "",
        supplier: "",
        purchase_order: null,
        bill_date: new Date().toISOString().split("T")[0],
        due_date: "",
        amount: 0,
        notes: "",
      });
      generateCode().then(code => setValue("bill_number", code)).catch(() => {});
    }
  }, [initialData, setValue, reset]);

  const onSubmit = async (data: SupplierBillFormData) => {
    if (initialData) {
      await updateBill.mutateAsync({ id: initialData.id, data });
    } else {
      await createBill.mutateAsync(data);
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
            {initialData ? "Edit Supplier Bill" : "New Supplier Bill"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          {/* ... existing form fields ... */}
          <div>
            <label className="block text-sm font-medium mb-1">Bill Number *</label>
            <div className="flex gap-2">
              <input
                {...register("bill_number", { required: true })}
                onBlur={(e) => validateCode(e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-sm font-mono"
                placeholder="e.g., BILL-2024-001"
              />
              <button
                type="button"
                onClick={() => generateCode().then(code => setValue("bill_number", code)).catch(() => {})}
                className="h-9 w-9 flex items-center justify-center rounded-md border border-border hover:bg-muted transition flex-shrink-0"
                title="Generate new code"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Supplier *</label>
            <SearchableSelect
              value={watch("supplier") || ""}
              onChange={(val) => setValue("supplier", val)}
              options={(suppliers || []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
              placeholder="Select supplier"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Bill Date *</label>
            <input
              type="date"
              {...register("bill_date", { required: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Due Date *</label>
            <input
              type="date"
              {...register("due_date", { required: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              {...register("amount", { required: true, valueAsNumber: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              {...register("notes")}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createBill.isPending || updateBill.isPending}
              className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
            >
              {createBill.isPending || updateBill.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}