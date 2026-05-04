// ============================================
// FILE: src/components/inventory/CategoryManagement.jsx
// ============================================

"use client";

import { useState, useEffect } from "react";
import CategoryTree from "./CategoryTree";
import CategoryForm from "./CategoryForm";
import DataTable from "@/components/reuseable/DataTable";
import { ls, uid } from "@/services/localStorageService";
import { permissionService } from "@/services/permissionService";
import PageHeader from "@/components/PageHeader";
import { Plus, LayoutList, Table as TableIcon, Shield } from "lucide-react";

export default function CategoryManagement() {
  const [categories, setCategories] = useState([]);
  const [viewMode, setViewMode] = useState("tree"); // "tree" or "table"
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [parentCategory, setParentCategory] = useState(null);
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canView: true,
    loading: true,
  });

  useEffect(() => {
    permissionService.init();
    const canCreate = permissionService.hasPermission("INVENTORY", "Products", "create");
    const canUpdate = permissionService.hasPermission("INVENTORY", "Products", "update");
    const canDelete = permissionService.hasPermission("INVENTORY", "Products", "delete");
    const canView = permissionService.hasPermission("INVENTORY", "Products", "view");

    setPermissions({
      canCreate,
      canUpdate,
      canDelete,
      canView,
      loading: false,
    });

    if (canView) {
      loadCategories();
    }
  }, []);

  const loadCategories = () => {
    const data = ls.get("categories", []);
    setCategories(data);
  };

  const saveCategories = (newCategories) => {
    setCategories(newCategories);
    ls.set("categories", newCategories);
  };

  const handleAdd = (parent = null) => {
    if (!permissions.canCreate) {
      alert("You don't have permission to create categories.");
      return;
    }
    setEditingCategory(null);
    setParentCategory(parent);
    setModalOpen(true);
  };

  const handleEdit = (category) => {
    if (!permissions.canUpdate) {
      alert("You don't have permission to edit categories.");
      return;
    }
    setEditingCategory(category);
    setParentCategory(null);
    setModalOpen(true);
  };

  const handleDelete = (category) => {
    if (!permissions.canDelete) {
      alert("You don't have permission to delete categories.");
      return;
    }
    
    // Check for child categories
    const hasChildren = categories.some(c => c.parent_id === category.id);
    if (hasChildren) {
      alert("Cannot delete category with subcategories. Delete or reassign child categories first.");
      return;
    }
    
    if (!confirm(`Delete category "${category.name}"?`)) return;
    const newCategories = categories.filter(c => c.id !== category.id);
    saveCategories(newCategories);
  };

  const handleSubmit = (formData) => {
    if (editingCategory) {
      const updated = categories.map(c => 
        c.id === editingCategory.id 
          ? { ...c, ...formData, updated_at: new Date().toISOString() }
          : c
      );
      saveCategories(updated);
    } else {
      const newCategory = {
        id: uid("cat"),
        ...formData,
        parent_id: parentCategory?.id || formData.parent_id || null,
        level: calculateLevel(formData.parent_id),
        path: calculatePath(formData.parent_id),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveCategories([newCategory, ...categories]);
    }
    setModalOpen(false);
    setEditingCategory(null);
    setParentCategory(null);
  };

  const calculateLevel = (parentId) => {
    if (!parentId) return 0;
    const parent = categories.find(c => c.id === parentId);
    return parent ? parent.level + 1 : 0;
  };

  const calculatePath = (parentId) => {
    if (!parentId) return "";
    const parent = categories.find(c => c.id === parentId);
    return parent ? `${parent.path}/${parent.id}` : parentId;
  };

  // Get parent category name for display
  const getParentName = (parentId) => {
    if (!parentId) return "—";
    const parent = categories.find(c => c.id === parentId);
    return parent?.name || "—";
  };

  const tableColumns = [
    { key: "code", label: "Code", sortable: true },
    { key: "name", label: "Category Name", sortable: true },
    { key: "parent_name", label: "Parent", render: (_, row) => getParentName(row.parent_id) },
    { key: "display_order", label: "Order", sortable: true },
    { key: "show_in_menu", label: "In Menu", badge: true, render: (val) => val === "true" ? "Yes" : "No" },
    { key: "status", label: "Status", badge: true },
  ];

  if (permissions.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!permissions.canView) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/15 flex items-center justify-center">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You don't have permission to view categories.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Category Management"
        subtitle="Organize products with hierarchical categories and attributes"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
              <button
                onClick={() => setViewMode("tree")}
                className={`p-1.5 rounded-md transition ${viewMode === "tree" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                title="Tree View"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition ${viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                title="Table View"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
            {permissions.canCreate && (
              <button
                onClick={() => handleAdd()}
                className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
              >
                <Plus className="w-4 h-4" /> Add Category
              </button>
            )}
          </div>
        }
      />

      {viewMode === "tree" ? (
        <div className="bg-card border border-border rounded-2xl p-4">
          <CategoryTree
            categories={categories}
            onSelect={(cat) => console.log("Selected:", cat)}
            onEdit={permissions.canUpdate ? handleEdit : null}
            onDelete={permissions.canDelete ? handleDelete : null}
            onAddChild={permissions.canCreate ? (parent) => handleAdd(parent) : null}
          />
        </div>
      ) : (
        <DataTable
          data={categories}
          columns={tableColumns}
          onEdit={permissions.canUpdate ? handleEdit : null}
          onDelete={permissions.canDelete ? handleDelete : null}
          title=""
          searchFields={["name", "code", "description"]}
        />
      )}

      {modalOpen && (
        <CategoryForm
          initialData={editingCategory || {}}
          categories={categories}
          parentCategory={parentCategory}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setEditingCategory(null);
            setParentCategory(null);
          }}
          isEditing={!!editingCategory}
        />
      )}
    </div>
  );
}