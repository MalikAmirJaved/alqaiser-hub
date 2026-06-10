"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import { useCreateDesignation, useUpdateDesignation, type Designation } from "@/hooks/useDesignations";

interface DesignationFormData {
  name: string;
  department: string;
  description: string;
  isActive: boolean;
}

export default function DesignationFormModal({
  open,
  onClose,
  initialData,
  onSuccess,
  departmentOptions,
}: {
  open: boolean;
  onClose: () => void;
  initialData?: Designation | null;
  onSuccess?: () => void;
  departmentOptions: { value: string; label: string }[];
}) {
  const { register, handleSubmit, reset, setValue } = useForm<DesignationFormData>({
    defaultValues: {
      name: "",
      department: "",
      description: "",
      isActive: true,
    },
  });
  const createDesignation = useCreateDesignation();
  const updateDesignation = useUpdateDesignation();

  useEffect(() => {
    if (initialData) {
      setValue("name", initialData.name);
      setValue("department", initialData.department || "");
      setValue("description", initialData.description || "");
      setValue("isActive", initialData.isActive);
    } else {
      reset({
        name: "",
        department: "",
        description: "",
        isActive: true,
      });
    }
  }, [initialData, setValue, reset, open]);

  const onSubmit = async (data: DesignationFormData) => {
    if (initialData) {
      // ✅ Fix: Merge id with data fields, not nested "data" object
      await updateDesignation.mutateAsync({ id: initialData.id, ...data });
    } else {
      await createDesignation.mutateAsync(data);
    }
    onSuccess?.();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">{initialData ? "Edit Designation" : "New Designation"}</h2>
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
              placeholder="e.g., Software Engineer"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Department</label>
            <select
              {...register("department")}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            >
              <option value="">Select Department</option>
              <option value="ALL">All Departments</option>
              {departmentOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
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
            <input type="checkbox" {...register("isActive")} className="rounded border-border" />
            <label className="text-sm">Active</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createDesignation.isPending || updateDesignation.isPending}
              className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
            >
              {createDesignation.isPending || updateDesignation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}