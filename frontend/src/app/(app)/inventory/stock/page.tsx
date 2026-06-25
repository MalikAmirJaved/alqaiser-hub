// src/app/inventory/stock/page.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TableView, Column } from "@/components/reuseable/TableGridView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/reuseable/Checkbox";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { Eye, TrendingUp } from "lucide-react";
import { useCurrentStock, StockItem } from "@/hooks/useStockManagement";
import { useWarehouses } from "@/hooks/useWarehouses";
import { StockAdjustModal } from "@/components/inventory/stock/StockAdjustModal";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import PageHeader from "@/components/PageHeader";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { usePagination } from "@/hooks/usePagination";
import debounce from "lodash/debounce";

export default function StockManagementPage() {
  const router = useRouter();
  const permissions = useFeaturePermissions("INVENTORY", "stock");
  const pagination = usePagination();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<{
    id: string;
    name: string;
    currentStock: number;
    warehouseId: string;
  } | null>(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);

  // Debounced search handler
  const debouncedSetSearch = useCallback(
    debounce((value: string) => setDebouncedSearch(value), 300),
    []
  );

  useEffect(() => {
    return () => { debouncedSetSearch.cancel(); };
  }, [debouncedSetSearch]);

  // Reset page when filters change
  useEffect(() => {
    pagination.resetPage();
  }, [debouncedSearch, selectedWarehouseId, lowStockOnly]);

  // Fetch warehouses for filter dropdown
  const { data: warehouses } = useWarehouses({ is_active: true });

  // Fetch stock data with filters
  const { data, isLoading } = useCurrentStock({
    page: pagination.page,
    page_size: 20,
    warehouse_id: selectedWarehouseId !== "all" ? selectedWarehouseId : undefined,
    low_stock: lowStockOnly,
    search: debouncedSearch || undefined,
  });

  const stockResults = data?.results || [];
  const totalCount = data?.count || 0;

  // Compute totals from current page for stats cards
  const totalOnHand = stockResults.reduce((sum, item) => sum + item.quantity_on_hand, 0);
  const totalReserved = stockResults.reduce((sum, item) => sum + item.quantity_reserved, 0);
  const lowStockCount = stockResults.filter((item) => item.quantity_available <= 5).length;

  const stats = [
    { id: "total_on_hand", label: "Total Units On Hand", value: totalOnHand },
    { id: "total_reserved", label: "Reserved Units", value: totalReserved },
    { id: "low_stock", label: "Low Stock Items", value: lowStockCount, valueClassName: lowStockCount > 0 ? "text-warning" : "" },
    { id: "warehouses", label: "Active Warehouses", value: warehouses?.length || 0 },
  ];

  const columns: Column<StockItem>[] = [
    { key: "variant_sku", label: "SKU", sortable: true },
    { key: "variant_name", label: "Product", sortable: true },
    { key: "warehouse_name", label: "Warehouse", sortable: true },
    {
      key: "quantity_on_hand",
      label: "On Hand",
      sortable: true,
      render: (val) => <span className="font-mono">{val as number}</span>,
    },
    {
      key: "quantity_reserved",
      label: "Reserved",
      sortable: true,
      render: (val) => <span className="font-mono text-muted-foreground">{val as number}</span>,
    },
    {
      key: "quantity_available",
      label: "Available",
      sortable: true,
      render: (val, row) => {
        const available = val as number;
        let colorClass = "text-success";
        if (available <= 0) colorClass = "text-destructive";
        else if (available <= 10) colorClass = "text-warning";
        return <span className={`font-mono font-medium ${colorClass}`}>{available}</span>;
      },
    },
    {
      key: "updated_at",
      label: "Last Updated",
      sortable: true,
      render: (val) => new Date(val as string).toLocaleDateString(),
    },
  ];

  const actions = (row: StockItem) => (
    <div className="flex items-center gap-1 justify-end">
      <Button variant="ghost" size="sm" onClick={() => router.push(`/inventory/stock/${row.id}`)}>
        <Eye className="w-4 h-4" />
      </Button>
      {permissions.adjust && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedVariant({
              id: row.variant_id,
              name: row.variant_name,
              currentStock: row.quantity_on_hand,
              warehouseId: row.warehouse_id,
            });
            setAdjustModalOpen(true);
          }}
        >
          <TrendingUp className="w-4 h-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Stock Management"
        subtitle="Monitor and adjust inventory levels across warehouses"
      />
      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-4 items-end bg-card border border-border rounded-xl p-4">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="search" className="text-xs">Search Product / SKU</Label>
          <Input
            id="search"
            placeholder="Type to filter..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); debouncedSetSearch(e.target.value); }}
            className="h-9"
          />
        </div>
        <div className="w-48">
          <Label htmlFor="warehouse" className="text-xs">Warehouse</Label>
          <SearchableSelect
            value={selectedWarehouseId}
            onChange={setSelectedWarehouseId}
            options={[
              { value: "all", label: "All" },
              ...(warehouses || []).map((wh) => ({ value: String(wh.id), label: wh.warehouse_name })),
            ]}
            placeholder="All warehouses"
          />
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Checkbox checked={lowStockOnly} onChange={setLowStockOnly} />
          <span className="text-sm">Low stock only (≤10 available)</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          setSearchTerm("");
          setDebouncedSearch("");
          setSelectedWarehouseId("all");
          setLowStockOnly(false);
          pagination.resetPage();
        }} className="h-9">
          Clear filters
        </Button>
      </div>

      {/* Stock Table — with server-side pagination */}
      <TableView<StockItem>
        columns={columns}
        data={stockResults}
        loading={isLoading}
        actions={actions}
        emptyMessage="No stock records found"
        totalCount={totalCount}
        currentPage={pagination.page}
        onPageChange={pagination.setPage}
      />

      {/* Modals */}
      {selectedVariant && permissions.adjust && (
        <StockAdjustModal
          open={adjustModalOpen}
          onClose={() => {
            setAdjustModalOpen(false);
            setSelectedVariant(null);
          }}
          variantId={selectedVariant.id}
          variantName={selectedVariant.name}
          currentStock={selectedVariant.currentStock}
          warehouseId={selectedVariant.warehouseId}
        />
      )}
    </div>
  );
}
