// ============================================
// FILE: src/components/inventory/BrandManagement.jsx
// ============================================

"use client";

import { useState, useEffect } from "react";
import DataTable from "@/components/reuseable/DataTable";
import BrandForm from "./BrandForm";
import { ls, uid } from "@/services/localStorageService";
import { permissionService } from "@/services/permissionService";
import PageHeader from "@/components/PageHeader";
import { Plus, Shield } from "lucide-react";

export default function BrandManagement() {
  const [brands, setBrands] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
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
      loadBrands();
    }
  }, []);

  const loadBrands = () => {
    const data = ls.get("brands", []);
    setBrands(data);
  };

  const saveBrands = (newBrands) => {
    setBrands(newBrands);
    ls.set("brands", newBrands);
  };

  const handleAdd = () => {
    if (!permissions.canCreate) {
      alert("You don't have permission to create brands.");
      return;
    }
    setEditingBrand(null);
    setModalOpen(true);
  };

  const handleEdit = (brand) => {
    if (!permissions.canUpdate) {
      alert("You don't have permission to edit brands.");
      return;
    }
    setEditingBrand(brand);
    setModalOpen(true);
  };

  const handleDelete = (brand) => {
    if (!permissions.canDelete) {
      alert("You don't have permission to delete brands.");
      return;
    }
    if (!confirm(`Delete brand "${brand.name}"?`)) return;
    const newBrands = brands.filter(b => b.id !== brand.id);
    saveBrands(newBrands);
  };

  const handleSubmit = (formData) => {
    if (editingBrand) {
      const updated = brands.map(b => 
        b.id === editingBrand.id ? { ...b, ...formData, updated_at: new Date().toISOString() } : b
      );
      saveBrands(updated);
    } else {
      const newBrand = {
        id: uid("br"),
        ...formData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveBrands([newBrand, ...brands]);
    }
    setModalOpen(false);
    setEditingBrand(null);
  };

  const columns = [
    { key: "code", label: "Code", sortable: true },
    { key: "name", label: "Brand Name", sortable: true },
    { key: "country_of_origin", label: "Country", sortable: true },
    { key: "website", label: "Website", render: (value) => value ? (
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
        {value.replace(/^https?:\/\//, '')}
      </a>
    ) : "—" },
    { key: "status", label: "Status", badge: true },
    { key: "is_featured", label: "Featured", badge: true, render: (value) => value === "true" ? "Yes" : "No" },
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
            You don't have permission to view brands.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Brand Management"
        subtitle="Manage product brands, manufacturers, and suppliers"
        actions={
          permissions.canCreate && (
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Add Brand
            </button>
          )
        }
      />

      <DataTable
        data={brands}
        columns={columns}
        onEdit={permissions.canUpdate ? handleEdit : null}
        onDelete={permissions.canDelete ? handleDelete : null}
        title=""
        searchFields={["name", "code", "country_of_origin"]}
      />

      {modalOpen && (
        <BrandForm
          initialData={editingBrand || {}}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setEditingBrand(null);
          }}
          isEditing={!!editingBrand}
        />
      )}
    </div>
  );
}