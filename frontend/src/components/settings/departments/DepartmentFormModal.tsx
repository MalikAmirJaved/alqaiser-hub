// frontend/src/components/settings/departments/DepartmentFormModal.tsx

"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { X, RotateCw } from "lucide-react";
import { useCreateDepartment, useUpdateDepartment, type Department } from "@/hooks/useDepartments";
import { useAutoCode } from "@/hooks/useAutoCode";

interface DepartmentFormData {
  name: string;
  code: string;
  description: string;
  is_active: boolean;
}

export default function DepartmentFormModal({
  open,
  onClose,
  initialData,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  initialData?: Department | null;
  onSuccess?: () => void;
}) {
  const { register, handleSubmit, reset, setValue } = useForm<DepartmentFormData>({
    defaultValues: {
      name: "",
      code: "",
      description: "",
      is_active: true,
    },
  });
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const { generateCode, validateCode } = useAutoCode("department");

  useEffect(() => {
    if (initialData) {
      setValue("name", initialData.name);
      setValue("code", initialData.code);
      setValue("description", initialData.description);
      setValue("is_active", initialData.is_active);
    } else {
      reset({
        name: "",
        code: "",
        description: "",
        is_active: true,
      });
      generateCode().then(code => setValue("code", code)).catch(() => {});
    }
  }, [initialData, setValue, reset, open]);

  const onSubmit = async (data: DepartmentFormData) => {
    if (initialData) {
      await updateDepartment.mutateAsync({ id: initialData.id, data });
    } else {
      await createDepartment.mutateAsync(data);
    }
    onSuccess?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">
            {initialData ? "Edit Department" : "New Department"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              {...register("name", { required: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              placeholder="e.g., Human Resources"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Code *</label>
            <div className="flex gap-2">
              <input
                {...register("code", { required: true })}
                onBlur={(e) => validateCode(e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-sm font-mono"
                placeholder="e.g., HR"
              />
              <button
                type="button"
                onClick={() => generateCode().then(code => setValue("code", code)).catch(() => {})}
                className="h-9 w-9 flex items-center justify-center rounded-md border border-border hover:bg-muted transition flex-shrink-0"
                title="Generate new code"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              {...register("description")}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" {...register("is_active")} className="rounded border-border" />
            <label className="text-sm">Active</label>
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
              disabled={createDepartment.isPending || updateDepartment.isPending}
              className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
            >
              {createDepartment.isPending || updateDepartment.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}