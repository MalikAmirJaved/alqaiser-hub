// src/app/inventory/stock/page.tsx
"use client";

import { useState } from "react";
import { TableView, Column } from "@/components/reuseable/TableGridView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/reuseable/Checkbox";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { Eye, TrendingUp, Package, AlertTriangle, Layers } from "lucide-react";
import { useCurrentStock, StockItem, useVariantSummary } from "@/hooks/useStockManagement";
import { useWarehouses } from "@/hooks/useWarehouses";
import { StockAdjustModal } from "@/components/inventory/stock/StockAdjustModal";
import { StockHistoryDrawer } from "@/components/inventory/stock/StockHistoryDrawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

export default function StockManagementPage() {
  const permissions = useFeaturePermissions("INVENTORY", "stock");
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<{
    id: string;
    name: string;
    currentStock: number;
    warehouseId: string;
  } | null>(null);
  const [historyVariantId, setHistoryVariantId] = useState<string | null>(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);

  // Fetch warehouses for filter dropdown
  const { data: warehouses } = useWarehouses({ is_active: true });

  // Fetch stock data with filters
  const { data, isLoading } = useCurrentStock({
    page,
    page_size: 20,
    warehouse_id: selectedWarehouseId !== "all" ? selectedWarehouseId : undefined,
    low_stock: lowStockOnly,
  });

  // Optional: compute total stock value / low stock count from data
  const totalOnHand = data?.results.reduce((sum, item) => sum + item.quantity_on_hand, 0) || 0;
  const totalReserved = data?.results.reduce((sum, item) => sum + item.quantity_reserved, 0) || 0;
  const lowStockCount = data?.results.filter((item) => item.quantity_available <= 5).length || 0;

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
      <Button variant="ghost" size="sm" onClick={() => setHistoryVariantId(row.variant_id)}>
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
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="w-48">
          <Label htmlFor="warehouse" className="text-xs">Warehouse</Label>
          <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
            <SelectTrigger id="warehouse" className="h-9">
              <SelectValue placeholder="All warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {warehouses?.map((wh) => (
                <SelectItem key={wh.id} value={String(wh.id)}>{wh.warehouse_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Checkbox checked={lowStockOnly} onChange={setLowStockOnly} />
          <span className="text-sm">Low stock only (≤10 available)</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          setSearchTerm("");
          setSelectedWarehouseId("");
          setLowStockOnly(false);
          setPage(1);
        }} className="h-9">
          Clear filters
        </Button>
      </div>

      {/* Stock Table */}
      <TableView<StockItem>
        columns={columns}
        data={data?.results || []}
        loading={isLoading}
        actions={actions}
        emptyMessage="No stock records found"
      />
      {/* Pagination */}
      {data && data.count > data.page_size && (
        <div className="flex justify-between items-center pt-2">
          <div className="text-sm text-muted-foreground">
            Showing {data.results.length} of {data.count} items
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.results.length || data.results.length < data.page_size}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
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
      {historyVariantId && (
        <StockHistoryDrawer variantId={historyVariantId} open={!!historyVariantId} onClose={() => setHistoryVariantId(null)} />
      )}
    </div>
  );
}