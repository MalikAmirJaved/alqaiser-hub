// ============================================
// FILE: src/components/inventory/ProductManagement.jsx
// ============================================

"use client";

import { useState, useEffect } from "react";
import DataTable from "@/components/reuseable/DataTable";
import ProductForm from "./ProductForm";
import { ls, uid } from "@/services/localStorageService";
import { permissionService } from "@/services/permissionService";
import PageHeader from "@/components/PageHeader";
import { Plus, Shield } from "lucide-react";

export default function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
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
      loadData();
    }
  }, []);

  const loadData = () => {
    setProducts(ls.get("products", []));
    setCategories(ls.get("categories", []));
    setBrands(ls.get("brands", []));
  };

  const saveProducts = (newProducts) => {
    setProducts(newProducts);
    ls.set("products", newProducts);
  };

  const handleAdd = () => {
    if (!permissions.canCreate) {
      alert("You don't have permission to create products.");
      return;
    }
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleEdit = (product) => {
    if (!permissions.canUpdate) {
      alert("You don't have permission to edit products.");
      return;
    }
    setEditingProduct(product);
    setModalOpen(true);
  };

  const handleDelete = (product) => {
    if (!permissions.canDelete) {
      alert("You don't have permission to delete products.");
      return;
    }
    if (!confirm(`Delete product "${product.name}"?`)) return;
    const newProducts = products.filter(p => p.id !== product.id);
    saveProducts(newProducts);
  };

  const handleSubmit = (formData) => {
    if (editingProduct) {
      const updated = products.map(p => 
        p.id === editingProduct.id 
          ? { ...p, ...formData, updated_at: new Date().toISOString() }
          : p
      );
      saveProducts(updated);
    } else {
      const newProduct = {
        id: uid("p"),
        ...formData,
        available_quantity: formData.stock_quantity || 0,
        reserved_quantity: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveProducts([newProduct, ...products]);
    }
    setModalOpen(false);
    setEditingProduct(null);
  };

  // Helper functions for display
  const getCategoryName = (categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || "—";
  };

  const getBrandName = (brandId) => {
    const brand = brands.find(b => b.id === brandId);
    return brand?.name || "—";
  };

  const columns = [
    { key: "sku", label: "SKU", sortable: true },
    { key: "name", label: "Product Name", sortable: true },
    { 
      key: "category_id", 
      label: "Category", 
      render: (_, row) => getCategoryName(row.category_id),
      sortable: true,
    },
    { 
      key: "brand_id", 
      label: "Brand", 
      render: (_, row) => getBrandName(row.brand_id),
      sortable: true,
    },
    { key: "selling_price", label: "Price", render: (val) => `$${Number(val).toLocaleString()}` },
    { key: "stock_quantity", label: "Stock", sortable: true },
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
            You don't have permission to view products.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Product Management"
        subtitle="Manage products, variants, pricing, inventory, and media"
        actions={
          permissions.canCreate && (
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          )
        }
      />

      <DataTable
        data={products}
        columns={columns}
        onEdit={permissions.canUpdate ? handleEdit : null}
        onDelete={permissions.canDelete ? handleDelete : null}
        title=""
        searchFields={["sku", "name", "description"]}
      />

      {modalOpen && (
        <ProductForm
          initialData={editingProduct || {}}
          categories={categories}
          brands={brands}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setEditingProduct(null);
          }}
          isEditing={!!editingProduct}
        />
      )}
    </div>
  );
}