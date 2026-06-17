"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Layers, Check, Loader2, RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateCategory, useUpdateCategory, Category } from "@/hooks/useCategories";
import { useAutoCode } from "@/hooks/useAutoCode";


interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Category | null;
}

export default function CategoryFormModal({ isOpen, onClose, initialData }: Props) {
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const { generateCode, validateCode } = useAutoCode("category");

  const isSubmitting = createCategory.isPending || updateCategory.isPending;

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name,
        code: initialData.code,
        description: initialData.description,
      });
    } else {
      setForm({ name: "", code: "", description: "" });
      generateCode().then(code => setForm(prev => ({ ...prev, code }))).catch(() => {});
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) {
      alert("Name and Code are required");
      return;
    }

    try {
      if (initialData) {
        await updateCategory.mutateAsync({
          id: initialData.id,
          data: { name: form.name, code: form.code, description: form.description },
        });
      } else {
        await createCategory.mutateAsync(form);
      }
      onClose();
    } catch (err) {
      // Error is already toasted in the mutation
      console.error(err);
    }
  };

  return typeof document !== "undefined" ? createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">{initialData ? "Edit Category" : "New Category"}</h2>
                  <p className="text-xs text-muted-foreground">Organize your product inventory</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <label className="text-sm flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs">Category Name *</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 px-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
              </label>
              <label className="text-sm flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs">Category Code *</span>
                <div className="flex gap-2">
                  <input
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    onBlur={() => validateCode(form.code)}
                    className="flex-1 h-10 px-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 font-mono text-sm transition"
                  />
                  <button
                    type="button"
                    onClick={() => generateCode().then(code => setForm(prev => ({ ...prev, code }))).catch(() => {})}
                    className="h-10 w-10 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition"
                    title="Generate new code"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>
              </label>
              <label className="text-sm flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs">Description</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="p-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 resize-none transition"
                />
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-5 h-10 rounded-xl border border-border text-sm hover:bg-muted transition">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 h-10 rounded-xl bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isSubmitting ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  ) : null;
}