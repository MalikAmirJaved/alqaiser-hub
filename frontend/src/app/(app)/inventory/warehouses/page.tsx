// frontend/src/app/(app)/inventory/warehouses/page.tsx

"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Search, X } from "lucide-react";
import { TableView, GridView } from "@/components/reuseable/TableGridView";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { ConfirmationModal, useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { WarehouseForm } from "@/components/inventory/warehouse/WarehouseForm";
import { WarehouseDetail } from "@/components/inventory/warehouse/WarehouseDetail";
import {
  useWarehouses,
  useWarehouseStats,
  useCreateWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
  Warehouse,
} from "@/hooks/useWarehouses";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

type ViewMode = "table" | "grid";

export default function WarehousesPage() {
  const permissions = useFeaturePermissions("INVENTORY", "warehouse");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);

  const { data: warehouses = [], isLoading, refetch } = useWarehouses({ search: searchTerm });
  const { data: stats, isLoading: statsLoading } = useWarehouseStats();
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const deleteWarehouse = useDeleteWarehouse();
  const deleteConfirm = useConfirmationModal();

  const filteredWarehouses = useMemo(() => {
    if (!searchTerm) return warehouses;
    const term = searchTerm.toLowerCase();
    return warehouses.filter(
      (w) =>
        w.warehouse_name.toLowerCase().includes(term) ||
        w.code.toLowerCase().includes(term) ||
        w.city.toLowerCase().includes(term) ||
        w.employee_name?.toLowerCase().includes(term)
    );
  }, [warehouses, searchTerm]);

  const statsData = stats
    ? [
        { id: "total", label: "Total Warehouses", value: stats.total_warehouses },
        { id: "active", label: "Active", value: stats.active_warehouses, valueClassName: "text-success" },
        { id: "inactive", label: "Inactive", value: stats.inactive_warehouses, valueClassName: "text-warning" },
      ]
    : [];

  const handleCreate = () => {
    setEditingWarehouse(null);
    setIsFormOpen(true);
  };

  const handleEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setIsFormOpen(true);
    setSelectedWarehouse(null);
  };

  const handleDelete = async (warehouse: Warehouse) => {
    deleteConfirm.confirm({
      title: "Delete Warehouse",
      message: `Are you sure you want to delete "${warehouse.warehouse_name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteWarehouse.mutateAsync(warehouse.id);
          toast.success(`Warehouse "${warehouse.warehouse_name}" deleted successfully`);
          setSelectedWarehouse(null);
          refetch();
        } catch (error: any) {
          toast.error(error.message || "Failed to delete warehouse");
        }
      },
    });
  };

  const handleSubmitForm = async (formData: any) => {
    try {
      if (editingWarehouse) {
        await updateWarehouse.mutateAsync({ id: editingWarehouse.id, ...formData });
        toast.success(`Warehouse "${formData.warehouse_name}" updated successfully`);
      } else {
        await createWarehouse.mutateAsync(formData);
        toast.success(`Warehouse "${formData.warehouse_name}" created successfully`);
      }
      setIsFormOpen(false);
      setEditingWarehouse(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${editingWarehouse ? "update" : "create"} warehouse`);
    }
  };

  const handleRowClick = (row: Warehouse) => {
    setSelectedWarehouse(row);
  };

  const columns = [
    { key: "code", label: "Code", sortable: true, width: "100px" },
    { key: "warehouse_name", label: "Warehouse Name", sortable: true },
    { key: "employee_name", label: "Responsible", sortable: true },
    { key: "landline_number", label: "Landline", sortable: false },
    {
      key: "location",
      label: "Location",
      sortable: true,
      render: (value: unknown, row: Warehouse) => `${row.city}, ${row.country}`,
      sortAccessor: (row: Warehouse) => `${row.city} ${row.country}`,
    },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      render: (value: unknown) => (
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            value ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          {value ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const renderCard = (warehouse: Warehouse) => (
    <div
      onClick={() => handleRowClick(warehouse)}
      className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all cursor-pointer group"
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {warehouse.warehouse_name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{warehouse.code}</p>
          </div>
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              warehouse.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
            }`}
          >
            {warehouse.is_active ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          {warehouse.employee_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs">Responsible:</span>
              <span className="text-foreground">{warehouse.employee_name}</span>
            </div>
          )}
          {warehouse.landline_number && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs">Landline:</span>
              <span className="text-foreground">{warehouse.landline_number}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-xs">Location:</span>
            <span className="text-foreground">{warehouse.city}, {warehouse.country}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          {permissions.update && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(warehouse);
              }}
              className="px-3 py-1 text-xs rounded-md border border-border hover:bg-muted transition-colors"
            >
              Edit
            </button>
          )}
          {permissions.delete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(warehouse);
              }}
              className="px-3 py-1 text-xs rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const actions = (row: Warehouse) => (
    <>
      {permissions.update && (
        <button
          onClick={() => handleEdit(row)}
          className="px-2 py-1 text-xs rounded-md border border-border hover:bg-muted transition-colors"
        >
          Edit
        </button>
      )}
      {permissions.delete && (
        <button
          onClick={() => handleDelete(row)}
          className="px-2 py-1 text-xs rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
        >
          Delete
        </button>
      )}
    </>
  );

  return (
    <div className="">
      <PageHeader
        title="Warehouses"
        subtitle="Manage your warehouse locations and responsible employees"
        actions={
          permissions.create && (
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" /> Add Warehouse
            </Button>
          )
        }
      />

      {!statsLoading && statsData.length > 0 && <StatsCards stats={statsData} />}

      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search warehouses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 h-9 rounded-md border border-border bg-muted/40 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("table")}
            className={`p-2 rounded-md transition-colors ${
              viewMode === "table" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-md transition-colors ${
              viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {viewMode === "table" ? (
        <TableView
          columns={columns as any}
          data={filteredWarehouses as any}
          loading={isLoading}
          onRowClick={handleRowClick as any}
          actions={actions as any}
          emptyMessage="No warehouses found"
        />
      ) : (
        <GridView
          data={filteredWarehouses as any}
          renderCard={renderCard as any}
          loading={isLoading}
          emptyMessage="No warehouses found"
          emptyAction={permissions.create ? { label: "Add Warehouse", onClick: handleCreate } : undefined}
          columns={3}
        />
      )}

      <WarehouseDetail
        warehouse={selectedWarehouse}
        isOpen={!!selectedWarehouse}
        onClose={() => setSelectedWarehouse(null)}
        onEdit={permissions.update ? handleEdit : undefined}
        onDelete={permissions.delete ? handleDelete : undefined}
      />

      {(isFormOpen && (editingWarehouse ? permissions.update : permissions.create)) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">{editingWarehouse ? "Edit Warehouse" : "Create New Warehouse"}</h2>
            </div>
            <div className="p-6">
              <WarehouseForm
                initialData={editingWarehouse || undefined}
                onSubmit={handleSubmitForm}
                onCancel={() => {
                  setIsFormOpen(false);
                  setEditingWarehouse(null);
                }}
                isLoading={createWarehouse.isPending || updateWarehouse.isPending}
              />
            </div>
          </div>
        </div>
      )}

      <deleteConfirm.Modal />
    </div>
  );
}