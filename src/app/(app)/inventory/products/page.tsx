// src/app/(app)/inventory/products/page.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import { ls } from "@/services/localStorageService";
import PageHeader  from "@/components/PageHeader";
import { Search, Plus, Package, Trash2, Pencil, DollarSign, Tag, Layers } from "lucide-react";
import ProductFormModal from "@/components/inventory/ProductFormModal";

export default function ProductsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => load(), []);
  const load = () => setItems(ls.get("products", []));

  const filtered = useMemo(() => items.filter(i => i.name?.toLowerCase().includes(query.toLowerCase()) || i.sku?.toLowerCase().includes(query.toLowerCase())), [items, query]);

  const handleDelete = (id: string) => {
    if (confirm("Delete this product?")) {
      setItems(prev => prev.filter(i => i.id !== id));
      ls.set("products", filtered);
    }
  };

  const getCategoryName = (id: string) => (ls.get("categories") || []).find((c: any) => c.id === id)?.name || "—";
  const getBrandName = (id: string) => (ls.get("brands") || []).find((b: any) => b.id === id)?.name || "—";

  return (
    <div className="space-y-5">
      <PageHeader title="Product Management" subtitle="Manage inventory, pricing & stock" actions={
        <button onClick={() => { setEditing(null); setModalOpen(true); }} className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm hover:opacity-90 transition">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      } />
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or SKU..." className="w-full bg-muted/20 pl-9 pr-3 h-10 rounded-xl outline-none focus:ring-2 focus:ring-primary/30 transition" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-3">Product</th><th className="text-left px-4 py-3">SKU</th><th className="text-left px-4 py-3">Category</th><th className="text-left px-4 py-3">Brand</th><th className="text-left px-4 py-3">Price</th><th className="text-left px-4 py-3">Stock</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No products found.</td></tr>}
              {filtered.map(item => (
                <tr key={item.id} className="border-t border-border hover:bg-muted/10 transition">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.sku}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 text-xs"><Layers className="w-3 h-3 text-primary" />{getCategoryName(item.category_id)}</span></td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 text-xs"><Tag className="w-3 h-3 text-info" />{getBrandName(item.brand_id)}</span></td>
                  <td className="px-4 py-3 font-semibold text-success flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{item.selling_price?.toFixed(2)}</td>
                  <td className="px-4 py-3">{item.stock_quantity || 0}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap flex justify-end gap-2">
                    <button onClick={() => { setEditing(item); setModalOpen(true); }} className="p-2 hover:bg-primary/10 text-primary rounded-lg transition"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ProductFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} initialData={editing} onSuccess={load} />
    </div>
  );
}