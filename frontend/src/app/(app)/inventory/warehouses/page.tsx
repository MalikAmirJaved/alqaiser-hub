// frontend/src/app/(app)/inventory/warehouses/page.tsx

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, List, Grid, MapPin, Phone, Building2, User, LocateFixed } from "lucide-react";
import { TableView, GridView } from "@/components/reuseable/TableGridView";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import FilterBar, { FilterField } from "@/components/reuseable/FilterBar";
import { WarehouseForm } from "@/components/inventory/warehouse/WarehouseForm";
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
import { usePagination } from "@/hooks/usePagination";
import { useServerSearch } from "@/hooks/useServerSearch";
import { LocationGroup } from "@/components/reuseable/LocationSelectors";

type ViewMode = "table" | "grid";

export default function WarehousesPage() {
  const router = useRouter();
  const permissions = useFeaturePermissions("INVENTORY", "warehouse");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const pagination = usePagination();

  const fetchEmployees = useServerSearch("/api/hr/employees/", {
    extraParams: { employment_status: "ACTIVE" },
    transformOption: (e: any) => ({
      value: e.id,
      label: `${e.first_name} ${e.last_name || ""} (${e.department_name || "N/A"})`,
    }),
  });

  const { data: warehouses = [], isLoading, refetch, totalCount } = useWarehouses({
    search: filters.search || undefined,
    is_active: filters.is_active ? filters.is_active === 'true' : undefined,
    country: filters.country || undefined,
    state: filters.state || undefined,
    city: filters.city || undefined,
    page: String(pagination.page),
  });
  const { data: stats, isLoading: statsLoading } = useWarehouseStats();
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const deleteWarehouse = useDeleteWarehouse();
  const deleteConfirm = useConfirmationModal();

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    { name: "is_active", label: "Status", type: "boolean" },
  ];

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
  };

  const handleDelete = async (warehouse: Warehouse) => {
    deleteConfirm.confirm({
      title: "Delete Warehouse",
      message: `Are you sure you want to delete "${warehouse.warehouse_name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteWarehouse.mutateAsync(warehouse.id);
          refetch();
        } catch (error: any) {
        }
      },
    });
  };

  const handleSubmitForm = async (formData: any) => {
    try {
      if (editingWarehouse) {
        await updateWarehouse.mutateAsync({ id: editingWarehouse.id, ...formData });
      } else {
        await createWarehouse.mutateAsync(formData);
      }
      setIsFormOpen(false);
      setEditingWarehouse(null);
      refetch();
    } catch (error: any) {
    }
  };

  const handleRowClick = (row: Warehouse) => {
    router.push(`/inventory/warehouses/${row.id}`);
  };

  // ── Enhanced columns with icons ──
  const columns = [
    { key: "code", label: "Code", sortable: true, width: "100px",
      render: (val: unknown) => <span className="font-mono text-xs font-medium">{val as string}</span>,
    },
    {
      key: "warehouse_name", label: "Warehouse", sortable: true,
      render: (val: unknown, row: Warehouse) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">{val as string}</p>
            <p className="text-[11px] text-muted-foreground">{row.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: "employee_name", label: "Responsible", sortable: true,
      render: (val: unknown) => val ? (
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{val as string}</span>
        </div>
      ) : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: "landline_number", label: "Landline", sortable: false,
      render: (val: unknown) => val ? (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Phone className="w-3.5 h-3.5" />
          <span>{val as string}</span>
        </div>
      ) : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: "location",
      label: "Location",
      sortable: true,
      render: (_val: unknown, row: Warehouse) => (
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{row.city ? `${row.city}${row.country ? `, ${row.country}` : ''}` : '—'}</span>
        </div>
      ),
      sortAccessor: (row: Warehouse) => `${row.city} ${row.country}`,
    },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      render: (value: unknown) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
            value
              ? "bg-success/10 text-success border-success/20"
              : "bg-muted text-muted-foreground border-border/50"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-success' : 'bg-muted-foreground'}`} />
          {value ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  // ── Enhanced grid cards ──
  const renderCard = (warehouse: Warehouse) => (
    <div
      onClick={() => handleRowClick(warehouse)}
      className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
    >
      {/* Card header */}
      <div className="p-4 pb-3 border-b border-border/60">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                {warehouse.warehouse_name}
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono">{warehouse.code}</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 border ${
              warehouse.is_active
                ? "bg-success/10 text-success border-success/20"
                : "bg-muted text-muted-foreground border-border/50"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${warehouse.is_active ? 'bg-success' : 'bg-muted-foreground'}`} />
            {warehouse.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-2.5">
        {warehouse.employee_name && (
          <div className="flex items-center gap-2 text-sm">
            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-xs">Responsible:</span>
            <span className="text-foreground text-sm font-medium">{warehouse.employee_name}</span>
          </div>
        )}
        {warehouse.landline_number && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-xs">Landline:</span>
            <span className="text-foreground text-sm">{warehouse.landline_number}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground text-xs">Location:</span>
          <span className="text-foreground text-sm truncate">
            {warehouse.city ? `${warehouse.city}${warehouse.country ? `, ${warehouse.country}` : ''}` : '—'}
          </span>
        </div>
        {warehouse.address_line && (
          <p className="text-xs text-muted-foreground/70 pl-[22px] truncate">{warehouse.address_line}</p>
        )}
      </div>

      {/* Card actions */}
      <div className="flex border-t border-border/60">
        {permissions.update && (
          <button
            onClick={(e) => { e.stopPropagation(); handleEdit(warehouse); }}
            className="flex-1 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-r border-border/60"
          >
            Edit
          </button>
        )}
        {permissions.delete && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(warehouse); }}
            className="flex-1 py-2.5 text-xs font-medium text-destructive/70 hover:text-destructive hover:bg-destructive/5 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );

  // ── Icon-only action buttons ──
  const actions = (row: Warehouse) => (
    <div className="flex items-center justify-end gap-1">
      {permissions.update && (
        <button
          onClick={() => handleEdit(row)}
          title="Edit warehouse"
          className="flex items-center justify-center w-7 h-7 rounded-md border border-border/40 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border/60 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}
      {permissions.delete && (
        <button
          onClick={() => handleDelete(row)}
          title="Delete warehouse"
          className="flex items-center justify-center w-7 h-7 rounded-md border border-border/40 text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Warehouses"
        subtitle="Manage your warehouse locations and responsible employees"
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle segment */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background">
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 transition-colors ${
                  viewMode === "table"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${
                  viewMode === "grid"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                title="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
            {permissions.create && (
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" /> Add Warehouse
              </Button>
            )}
          </div>
        }
      />

      {/* Stats */}
      {!statsLoading && statsData.length > 0 && <StatsCards stats={statsData} />}

      {/* Enhanced FilterBar */}
      <FilterBar fields={filterFields} filters={filters} onChange={(f) => { setFilters(f); pagination.resetPage(); }} />

      {/* Location Filters */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <LocateFixed className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Location Filters</span>
        </div>
        <LocationGroup
          country={filters.country || ""}
          setCountry={(val) => { setFilters(f => ({ ...f, country: val, state: "", city: "" })); pagination.resetPage(); }}
          state={filters.state || ""}
          setState={(val) => { setFilters(f => ({ ...f, state: val, city: "" })); pagination.resetPage(); }}
          city={filters.city || ""}
          setCity={(val) => { setFilters(f => ({ ...f, city: val })); pagination.resetPage(); }}
        />
      </div>

      {/* Table / Grid */}
      {viewMode === "table" ? (
        <TableView
          columns={columns as any}
          data={warehouses as any}
          loading={isLoading}
          onRowClick={handleRowClick as any}
          actions={actions as any}
          emptyMessage="No warehouses found"
          totalCount={totalCount}
          currentPage={pagination.page}
          onPageChange={pagination.setPage}
        />
      ) : (
        <GridView
          data={warehouses as any}
          renderCard={renderCard as any}
          loading={isLoading}
          emptyMessage="No warehouses found"
          emptyAction={permissions.create ? { label: "Add Warehouse", onClick: handleCreate } : undefined}
          columns={3}
        />
      )}

      {/* Form modal */}
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
                fetchEmployeeOptions={fetchEmployees}
                employeeDisplayLabel={editingWarehouse?.employee_name || ""}
              />
            </div>
          </div>
        </div>
      )}

      <deleteConfirm.Modal />
    </div>
  );
}
