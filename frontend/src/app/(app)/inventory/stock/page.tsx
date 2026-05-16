// src/app/inventory/stock/page.tsx
"use client";

import { useState } from "react";
import { TableView, Column } from "@/components/reuseable/TableGridView";
import { Button } from "@/components/ui/button";
import { Eye, PackageOpen, TrendingDown, TrendingUp } from "lucide-react";
import { useCurrentStock, StockItem } from "@/hooks/useStockManagement";
import { StockAdjustModal } from "@/components/inventory/stock/StockAdjustModal";
import { StockHistoryDrawer } from "@/components/inventory/stock/StockHistoryDrawer";

export default function StockManagementPage() {
  const [page, setPage] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<{
    id: string;
    name: string;
    currentStock: number;
  } | null>(null);
  const [historyVariantId, setHistoryVariantId] = useState<string | null>(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);

  const { data, isLoading } = useCurrentStock({ page, page_size: 20 });

const columns = [
  { key: "variant_sku", label: "SKU", sortable: true },
  { key: "variant_name", label: "Product", sortable: true },
  { key: "warehouse_name", label: "Warehouse", sortable: true },

  {
    key: "quantity_on_hand",
    label: "On Hand",
    sortable: true,
    render: (val: unknown) => (
      <span className="font-mono">{val as number}</span>
    ),
  },

  {
    key: "quantity_reserved",
    label: "Reserved",
    sortable: true,
    render: (val: unknown) => (
      <span className="font-mono text-muted-foreground">
        {val as number}
      </span>
    ),
  },

  {
    key: "quantity_available",
    label: "Available",
    sortable: true,
    render: (val: unknown, row: Record<string, unknown>) => {
      const value = val as number;
      const stock = row as unknown as StockItem;

      return (
        <span
          className={`font-mono font-medium ${
            stock.quantity_available <= 0
              ? "text-destructive"
              : stock.quantity_available <= 10
              ? "text-warning"
              : "text-success"
          }`}
        >
          {value}
        </span>
      );
    },
  },

  {
    key: "updated_at",
    label: "Last Updated",
    sortable: true,
    render: (val: unknown) => (
      <span>
        {new Date(val as string).toLocaleDateString()}
      </span>
    ),
  },
] as Column<Record<string, unknown>>[];

const actions = (row: Record<string, unknown>) => {
  const r = row as unknown as StockItem;

  return (
    <div className="flex items-center gap-1 justify-end">
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setHistoryVariantId(r.variant_id);
        }}
      >
        <Eye className="w-4 h-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedVariant({
            id: r.variant_id,
            name: r.variant_name,
            currentStock: r.quantity_on_hand,
          });
          setAdjustModalOpen(true);
        }}
      >
        <TrendingUp className="w-4 h-4" />
      </Button>
    </div>
  );
};

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Stock Management</h1>
          <p className="text-muted-foreground text-sm">Monitor and adjust inventory levels</p>
        </div>
      </div>

      <TableView
  columns={columns}
  data={(data?.results || []) as unknown as Record<string, unknown>[]}
  loading={isLoading}
  actions={actions}
  emptyMessage="No stock records found"
/>

      {/* Pagination */}
      {data && data.count > data.page_size && (
        <div className="flex justify-between items-center pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {data.results.length} of {data.count} items
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
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

      {/* Stock Adjust Modal */}
      {selectedVariant && (
        <StockAdjustModal
          open={adjustModalOpen}
          onClose={() => {
            setAdjustModalOpen(false);
            setSelectedVariant(null);
          }}
          variantId={selectedVariant.id}
          variantName={selectedVariant.name}
          currentStock={selectedVariant.currentStock}
        />
      )}

      {/* Stock History Drawer (implement as side panel) */}
     {historyVariantId && (
  <StockHistoryDrawer
    variantId={historyVariantId}
    open={!!historyVariantId}
    onClose={() => setHistoryVariantId(null)}
  />
)}
    </div>
  );
}