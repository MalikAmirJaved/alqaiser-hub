// frontend/src/app/(app)/inventory/warehouses/[id]/page.tsx

"use client";

import { useParams } from "next/navigation";
import { useWarehouse } from "@/hooks/useWarehouses";
import { useCurrentStock, useStockHistory } from "@/hooks/useStockManagement";
import { useState } from "react";
import { format } from "date-fns";
import PageHeader from "@/components/PageHeader";

export default function WarehouseDetailPage() {
  const params = useParams<{ id: string }>();
  const warehouseId = params.id;

  const { data: warehouse, isLoading: warehouseLoading } = useWarehouse(warehouseId);

  const [stockPage, setStockPage] = useState(1);
  const { data: stockData, isLoading: stockLoading } = useCurrentStock({
    warehouse_id: warehouseId,
    page: stockPage,
    page_size: 20,
  });

  const [historyPage, setHistoryPage] = useState(1);
  const { data: historyData, isLoading: historyLoading } = useStockHistory({
    warehouse_id: warehouseId,
    page: historyPage,
    page_size: 20,
  });

  if (warehouseLoading) {
    return <div className="p-8 text-center">Loading warehouse...</div>;
  }

  if (!warehouse) {
    return <div className="p-8 text-center text-destructive">Warehouse not found</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={warehouse.warehouse_name} subtitle={`${warehouse.code} · ${warehouse.city}, ${warehouse.country}`} />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Responsible Employee</p>
          <p className="text-lg font-semibold">{warehouse.employee_name || "—"}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Landline Number</p>
          <p className="text-lg font-semibold">{warehouse.landline_number || "—"}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Status</p>
          <p className={`text-lg font-semibold ${warehouse.is_active ? "text-success" : "text-destructive"}`}>
            {warehouse.is_active ? "Active" : "Inactive"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-6">
          <button className="pb-2 text-sm font-medium border-b-2 border-primary">Stock Items</button>
          <button className="pb-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            Transaction History
          </button>
        </div>
      </div>

      {/* Stock Items Table */}
      <div>
        {stockLoading ? (
          <div className="text-center py-8">Loading stock...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Variant</th>
                    <th className="text-left p-3">SKU</th>
                    <th className="text-right p-3">On Hand</th>
                    <th className="text-right p-3">Reserved</th>
                    <th className="text-right p-3">Available</th>
                    <th className="text-left p-3">Bin Location</th>
                    <th className="text-left p-3">Last Updated</th>
                    <th className="text-left p-3">Updated By</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData?.results?.map((item: any) => (
                    <tr key={item.id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3 font-medium">{item.variant_name}</td>
                      <td className="p-3 font-mono text-xs">{item.variant_sku}</td>
                      <td className="p-3 text-right">{item.quantity_on_hand}</td>
                      <td className="p-3 text-right">{item.quantity_reserved}</td>
                      <td className="p-3 text-right font-semibold text-primary">{item.quantity_available}</td>
                      <td className="p-3">{item.bin_location || "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {format(new Date(item.updated_at), "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="p-3 text-xs">{item.updated_by_name || item.updated_by_email || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stockData && (
              <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
                <span>Page {stockData.page} of {Math.ceil(stockData.count / stockData.page_size)}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStockPage((p) => Math.max(1, p - 1))}
                    disabled={stockData.page === 1}
                    className="px-3 py-1 rounded bg-muted disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setStockPage((p) => p + 1)}
                    disabled={stockData.page * stockData.page_size >= stockData.count}
                    className="px-3 py-1 rounded bg-muted disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Transaction History Table */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Stock Transaction History</h2>
        {historyLoading ? (
          <div className="text-center py-8">Loading history...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Variant</th>
                    <th className="text-right p-3">Change</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-left p-3">Reason</th>
                    <th className="text-left p-3">Before → After</th>
                    <th className="text-left p-3">Performed By</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData?.results?.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3 text-xs whitespace-nowrap">
                        {format(new Date(tx.created_at), "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{tx.variant_name || tx.variant_sku}</div>
                        <div className="text-xs text-muted-foreground font-mono">{tx.variant_sku}</div>
                      </td>
                      <td className={`p-3 text-right font-medium ${tx.quantity_change > 0 ? "text-success" : "text-destructive"}`}>
                        {tx.quantity_change > 0 ? `+${tx.quantity_change}` : tx.quantity_change}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs bg-muted">
                          {tx.transaction_type_display}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{tx.reason_text || "—"}</td>
                      <td className="p-3 text-xs font-mono">{tx.quantity_before} → {tx.quantity_after}</td>
                      <td className="p-3 text-xs">{tx.created_by_name || tx.created_by_email || "System"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historyData && (
              <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
                <span>Page {historyData.page} of {Math.ceil(historyData.count / historyData.page_size)}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyData.page === 1}
                    className="px-3 py-1 rounded bg-muted disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setHistoryPage((p) => p + 1)}
                    disabled={historyData.page * historyData.page_size >= historyData.count}
                    className="px-3 py-1 rounded bg-muted disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}