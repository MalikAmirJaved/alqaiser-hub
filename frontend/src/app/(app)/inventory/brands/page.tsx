// src/app/(app)/inventory/brands/page.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import { ls } from "@/services/localStorageService";
import PageHeader from "@/components/PageHeader";
import { Search, Plus, Tag, Trash2, Pencil, Globe } from "lucide-react";
import BrandFormModal from "@/components/inventory/brand/BrandFormModal";

export default function BrandsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => load(), []);
  const load = () => setItems(ls.get<any[]>("brands", []));

  const filtered = useMemo(() => items.filter(i => i.name?.toLowerCase().includes(query.toLowerCase()) || i.code?.toLowerCase().includes(query.toLowerCase())), [items, query]);

  const handleDelete = (id: string) => {
    if (confirm("Delete this brand?")) {
      setItems(prev => prev.filter(i => i.id !== id));
      ls.set("brands", filtered);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Brand Management" subtitle="Manage manufacturers & origins" actions={
        <button onClick={() => { setEditing(null); setModalOpen(true); }} className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm hover:opacity-90 transition">
          <Plus className="w-4 h-4" /> Add Brand
        </button>
      } />
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search brands..." className="w-full bg-muted/20 pl-9 pr-3 h-10 rounded-xl outline-none focus:ring-2 focus:ring-primary/30 transition" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Code</th><th className="text-left px-4 py-3">Country</th><th className="text-left px-4 py-3">Description</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No brands found.</td></tr>}
              {filtered.map(item => (
                <tr key={item.id} className="border-t border-border hover:bg-muted/10 transition">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.code}</td>
                  <td className="px-4 py-3 flex items-center gap-1.5 text-muted-foreground"><Globe className="w-3 h-3" />{item.country_of_origin || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{item.description || "—"}</td>
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
      <BrandFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} initialData={editing} onSuccess={load} />
    </div>
  );
}