// src/app/(app)/inventory/brands/page.tsx
"use client";
import { useState, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { Plus, Trash2, Pencil, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import BrandFormModal from "@/components/inventory/brand/BrandFormModal";
import FilterBar, { FilterField } from "@/components/reuseable/FilterBar";
import { useBrands, useDeleteBrand, Brand } from "@/hooks/useBrands";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { usePagination } from "@/hooks/usePagination";

export default function BrandsPage() {
  const permissions = useFeaturePermissions("INVENTORY", "brand");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
  ];

  const pagination = usePagination();

  const filtersWithPage = useMemo(() => ({ ...filters, page: String(pagination.page) }), [filters, pagination.page]);

  const { data: items = [], isLoading, totalCount } = useBrands(filtersWithPage);
  const deleteBrand = useDeleteBrand();

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete brand "${name}"?`)) {
      deleteBrand.mutate(id);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader 
        title="Brand Management" 
        subtitle="Manage manufacturers & origins"
        actions={
          permissions.create && (
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" /> Add Brand
            </button>
          )
        }
      />
      <FilterBar fields={filterFields} filters={filters} onChange={(f) => { setFilters(f); pagination.resetPage(); }} />

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Country</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    No brands found.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border hover:bg-muted/10 transition">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.code}</td>
                  <td className="px-4 py-3 flex items-center gap-1.5 text-muted-foreground">
                    <Globe className="w-3 h-3" />
                    {item.country_of_origin || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{item.description || "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap flex justify-end gap-2">
                    {permissions.update && (
                      <button
                        onClick={() => {
                          setEditing(item);
                          setModalOpen(true);
                        }}
                        className="p-2 hover:bg-primary/10 text-primary rounded-lg transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {permissions.delete && (
                      <button
                        onClick={() => handleDelete(item.id, item.name)}
                        className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {(totalCount ?? 0) > 20 && (
        <div className="flex items-center justify-between px-4 py-3 border border-border rounded-2xl text-xs text-muted-foreground bg-card">
          <span>{(pagination.page - 1) * 20 + 1}–{Math.min(pagination.page * 20, totalCount ?? 0)} of {totalCount ?? 0}</span>
          <div className="flex items-center gap-2">
            <span>Page {pagination.page} of {Math.max(1, Math.ceil((totalCount ?? 0) / 20))}</span>
            <button onClick={pagination.prevPage} disabled={pagination.page <= 1} className="p-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={pagination.nextPage} disabled={pagination.page >= Math.ceil((totalCount ?? 0) / 20)} className="p-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {(modalOpen && (editing ? permissions.update : permissions.create)) && (
        <BrandFormModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          initialData={editing}
        />
      )}
    </div>
  );
}