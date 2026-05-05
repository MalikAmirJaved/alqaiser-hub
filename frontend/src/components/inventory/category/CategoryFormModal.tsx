// src/components/inventory/CategoryFormModal.tsx
"use client";
import { useState, useEffect } from "react";
import { X, Layers, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ls, uid } from "@/services/localStorageService";

interface Category {
  id: string;
  name: string;
  code: string;
  description: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Category | null;
  onSuccess?: () => void;
}

export default function CategoryFormModal({ isOpen, onClose, initialData, onSuccess }: Props) {
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) setForm({ name: initialData.name, code: initialData.code, description: initialData.description });
    else setForm({ name: "", code: "", description: "" });
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) return alert("Name and Code are required");
    setSaving(true);

    const categories = ls.get("categories", []) as Category[];
    if (initialData) {
      const updated = categories.map(c => c.id === initialData.id ? { ...c, ...form, updated_at: new Date().toISOString() } : c);
      ls.set("categories", updated);
    } else {
      const newCat = { id: uid("cat"), ...form, created_at: new Date().toISOString() };
      ls.set("categories", [newCat, ...categories]);
    }
    setTimeout(() => {
      setSaving(false);
      onSuccess?.();
      onClose();
    }, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
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
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <label className="text-sm flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs">Category Name *</span>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-10 px-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 transition" />
              </label>
              <label className="text-sm flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs">Category Code *</span>
                <input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="h-10 px-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 font-mono text-sm transition" />
              </label>
              <label className="text-sm flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs">Description</span>
                <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="p-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 resize-none transition" />
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-5 h-10 rounded-xl border border-border text-sm hover:bg-muted transition">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 h-10 rounded-xl bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}