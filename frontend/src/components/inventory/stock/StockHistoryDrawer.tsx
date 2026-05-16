// src/components/inventory/StockHistoryDrawer.tsx
"use client";

import { useStockHistory } from "@/hooks/useStockManagement";
import { TableView } from "@/components/reuseable/TableGridView";
import { Drawer } from "@/components/ui/drawer"; // or custom
import { Loader2 } from "lucide-react";

export function StockHistoryDrawer({
  variantId,
  open,
  onClose,
}: {
  variantId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useStockHistory(
    variantId ? { variant_id: variantId, page_size: 50 } : undefined,
  );

  const columns = [
  {
    key: "created_at",
    label: "Date",
    render: (v: unknown) =>
      new Date(v as string).toLocaleString(),
  },
  {
    key: "transaction_type_display",
    label: "Type",
  },
  {
    key: "quantity_change",
    label: "Change",
    render: (v: unknown) => {
      const num = v as number;
      return num > 0 ? `+${num}` : num;
    },
  },
  {
    key: "quantity_before",
    label: "Before",
  },
  {
    key: "quantity_after",
    label: "After",
  },
  {
    key: "reason_text",
    label: "Reason",
  },
  {
    key: "warehouse_name",
    label: "Warehouse",
  },
];

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <div className="fixed inset-y-0 right-0 w-[700px] max-w-full bg-card border-l border-border shadow-xl z-50 flex flex-col">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="text-lg font-semibold">Stock History</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin w-6 h-6" />
            </div>
          ) : (
            <TableView columns={columns} data={(data?.results || []) as unknown as Record<string, unknown>[]} />
          )}
        </div>
      </div>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
    </Drawer>
  );
}