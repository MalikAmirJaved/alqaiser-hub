// src/components/inventory/BrandFormModal.tsx
"use client";
import { useState, useEffect } from "react";
import { X, Tag, Check, Loader2, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ls, uid } from "@/services/localStorageService";
import { CountrySelect } from "@/components/reuseable/LocationSelectors";

interface Brand {
  id: string;
  name: string;
  code: string;
  description: string;
  country_of_origin: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Brand | null;
  onSuccess?: () => void;
}

export default function BrandFormModal({ isOpen, onClose, initialData, onSuccess }: Props) {
  const [form, setForm] = useState({ name: "", code: "", description: "", country_of_origin: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) setForm({ name: initialData.name, code: initialData.code, description: initialData.description, country_of_origin: initialData.country_of_origin || "" });
    else setForm({ name: "", code: "", description: "", country_of_origin: "" });
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) return alert("Name and Code are required");
    setSaving(true);

    const brands = ls.get<any[]>("brands", []) as Brand[];
    if (initialData) {
      const updated = brands.map(b => b.id === initialData.id ? { ...b, ...form, updated_at: new Date().toISOString() } : b);
      ls.set("brands", updated);
    } else {
      const newBrand = { id: uid("br"), ...form, created_at: new Date().toISOString() };
      ls.set("brands", [newBrand, ...brands]);
    }
    setTimeout(() => { setSaving(false); onSuccess?.(); onClose(); }, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Tag className="w-5 h-5" /></div>
                <div><h2 className="font-semibold text-lg">{initialData ? "Edit Brand" : "New Brand"}</h2><p className="text-xs text-muted-foreground">Manage manufacturer details</p></div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <label className="text-sm flex flex-col gap-1.5"><span className="text-muted-foreground text-xs">Brand Name *</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-10 px-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 transition" /></label>
              <label className="text-sm flex flex-col gap-1.5"><span className="text-muted-foreground text-xs">Brand Code *</span><input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="h-10 px-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 font-mono text-sm transition" /></label>
              <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">Country of Origin</span><CountrySelect value={form.country_of_origin} onChange={(val) => setForm({ ...form, country_of_origin: val })} /></div>
              <label className="text-sm flex flex-col gap-1.5"><span className="text-muted-foreground text-xs">Description</span><textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="p-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 resize-none transition" /></label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-5 h-10 rounded-xl border border-border text-sm hover:bg-muted transition">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 h-10 rounded-xl bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saving ? "Saving..." : "Save Brand"}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}