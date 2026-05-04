// src/components/inventory/ProductFormModal.tsx
"use client";
import { useState, useEffect } from "react";
import { X, Package, Check, Loader2, DollarSign, Hash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ls, uid } from "@/services/localStorageService";
import FormSelectWithCreate from "@/components/reuseable/FormSelectWithCreate";
import CategoryFormModal from "./CategoryFormModal";
import BrandFormModal from "./BrandFormModal";

interface Product {
  id: string;
  sku: string;
  name: string;
  category_id: string;
  brand_id: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  description: string;
  status: "active" | "draft" | "archived";
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Product | null;
  onSuccess?: () => void;
}

export default function ProductFormModal({ isOpen, onClose, initialData, onSuccess }: Props) {
  const [form, setForm] = useState<Omit<Product, "id">>({
    sku: "", name: "", category_id: "", brand_id: "", cost_price: 0, selling_price: 0, stock_quantity: 0, description: "", status: "active"
  });
  const [categories, setCategories] = useState<{value:string, label:string}[]>([]);
  const [brands, setBrands] = useState<{value:string, label:string}[]>([]);
  const [saving, setSaving] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadOptions();
      if (initialData) setForm({
        sku: initialData.sku, name: initialData.name, category_id: initialData.category_id || "",
        brand_id: initialData.brand_id || "", cost_price: initialData.cost_price || 0,
        selling_price: initialData.selling_price || 0, stock_quantity: initialData.stock_quantity || 0,
        description: initialData.description || "", status: initialData.status || "active"
      });
      else setForm({ sku: "", name: "", category_id: "", brand_id: "", cost_price: 0, selling_price: 0, stock_quantity: 0, description: "", status: "active" });
    }
  }, [isOpen, initialData]);

  const loadOptions = () => {
    const cats = (ls.get("categories") || []).map((c: any) => ({ value: c.id, label: `${c.name} (${c.code})` }));
    const brs = (ls.get("brands") || []).map((b: any) => ({ value: b.id, label: `${b.name} (${b.code})` }));
    setCategories(cats);
    setBrands(brs);
  };

  const handleNestedCreateSuccess = () => {
    loadOptions();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.sku) return alert("Name and SKU are required");
    setSaving(true);
    const products = ls.get("products", []) as Product[];
    if (initialData) {
      const updated = products.map(p => p.id === initialData.id ? { ...p, ...form, updated_at: new Date().toISOString() } : p);
      ls.set("products", updated);
    } else {
      const newProd = { id: uid("p"), ...form, created_at: new Date().toISOString() };
      ls.set("products", [newProd, ...products]);
    }
    setTimeout(() => { setSaving(false); onSuccess?.(); onClose(); }, 300);
  };

  return (
    <>
      <CategoryFormModal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSuccess={handleNestedCreateSuccess} />
      <BrandFormModal isOpen={showBrandModal} onClose={() => setShowBrandModal(false)} onSuccess={handleNestedCreateSuccess} />
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Package className="w-5 h-5" /></div>
                  <div><h2 className="font-semibold text-lg">{initialData ? "Edit Product" : "New Product"}</h2><p className="text-xs text-muted-foreground">Add inventory item details</p></div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm flex flex-col gap-1.5"><span className="text-muted-foreground text-xs">Product Name *</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-10 px-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 transition" /></label>
                  <label className="text-sm flex flex-col gap-1.5"><span className="text-muted-foreground text-xs">SKU *</span><input required value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value.toUpperCase() })} className="h-10 px-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 font-mono text-sm transition" /></label>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormSelectWithCreate label="Category" value={form.category_id} onChange={(v) => setForm({ ...form, category_id: v })} options={categories} onCreate={() => setShowCategoryModal(true)} />
                  <FormSelectWithCreate label="Brand" value={form.brand_id} onChange={(v) => setForm({ ...form, brand_id: v })} options={brands} onCreate={() => setShowBrandModal(true)} />
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <label className="text-sm flex flex-col gap-1.5"><span className="text-muted-foreground text-xs flex items-center gap-1"><DollarSign className="w-3 h-3" /> Cost Price</span><input type="number" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: Number(e.target.value) || 0 })} className="h-10 px-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 transition" /></label>
                  <label className="text-sm flex flex-col gap-1.5"><span className="text-muted-foreground text-xs flex items-center gap-1"><DollarSign className="w-3 h-3 text-success" /> Selling Price</span><input type="number" step="0.01" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: Number(e.target.value) || 0 })} className="h-10 px-3 rounded-xl border border-success/30 bg-success/5 outline-none focus:ring-2 focus:ring-success/30 transition" /></label>
                  <label className="text-sm flex flex-col gap-1.5"><span className="text-muted-foreground text-xs flex items-center gap-1"><Hash className="w-3 h-3" /> Stock Qty</span><input type="number" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: Number(e.target.value) || 0 })} className="h-10 px-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 transition" /></label>
                </div>
                <label className="text-sm flex flex-col gap-1.5"><span className="text-muted-foreground text-xs">Description</span><textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="p-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 resize-none transition" /></label>
                <label className="text-sm flex flex-col gap-1.5"><span className="text-muted-foreground text-xs">Status</span>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })} className="h-10 px-3 rounded-xl border border-border bg-muted/20 outline-none focus:ring-2 focus:ring-primary/30 transition">
                    <option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option>
                  </select>
                </label>
                <div className="flex justify-end gap-3 pt-2 border-t border-border mt-4 shrink-0">
                  <button type="button" onClick={onClose} className="px-5 h-10 rounded-xl border border-border text-sm hover:bg-muted transition">Cancel</button>
                  <button type="submit" disabled={saving} className="px-5 h-10 rounded-xl bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saving ? "Saving..." : "Save Product"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}