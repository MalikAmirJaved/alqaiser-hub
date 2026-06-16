"use client";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Plus, Trash2, Pencil } from "lucide-react";
import CategoryFormModal from "@/components/inventory/category/CategoryFormModal";
import FilterBar, { FilterField } from "@/components/reuseable/FilterBar";
import { useCategories, useDeleteCategory, Category } from "@/hooks/useCategories";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

export default function CategoriesPage() {
  const permissions = useFeaturePermissions("INVENTORY", "category");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
  ];

  const { data: items = [], isLoading } = useCategories(filters);
  const deleteCategory = useDeleteCategory();

  const handleDelete = (id: string) => {
    if (confirm("Delete this category?")) {
      deleteCategory.mutate(id);
    }
  };


  return (
    <div className="space-y-5">
      <PageHeader
        title="Category Management"
        subtitle="Organize products with hierarchical categories"
        actions={
          permissions.create && (
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Category
            </button>
          )
        }
      />
      <FilterBar fields={filterFields} filters={filters} onChange={setFilters} />

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground">
                    No categories found.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border hover:bg-muted/10 transition">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.code}</td>
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
                        onClick={() => handleDelete(item.id)}
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
      {(modalOpen && (editing ? permissions.update : permissions.create)) && (
        <CategoryFormModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          initialData={editing}
        />
      )}
    </div>
  );
}