"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { DetailLayout, StandardSidebar, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { useStockItem, useStockHistory, useVariantSummary } from "@/hooks/useStockManagement";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { StockAdjustModal } from "@/components/inventory/stock/StockAdjustModal";
import { TableView, Column } from "@/components/reuseable/TableGridView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

export default function StockDetailPage() {
  const { id } = useParams();
  const { data: stock, isLoading } = useStockItem(id as string);
  const permissions = useFeaturePermissions("INVENTORY", "stock");
  const { data: variantSummary } = useVariantSummary(stock?.variant_id ?? null);

  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [historyTxnType, setHistoryTxnType] = useState("all");

  const { data: historyData, isLoading: historyLoading } = useStockHistory(
    stock?.variant_id
      ? {
          variant_id: stock.variant_id,
          warehouse_id: stock.warehouse_id,
          start_date: historyStartDate || undefined,
          end_date: historyEndDate || undefined,
          transaction_type: historyTxnType === "all" ? undefined : historyTxnType,
          page_size: 100,
        }
      : undefined
  );

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!stock) return <div className="p-8 text-center">Stock record not found</div>;

  const available = stock.quantity_available;
  let stockStatus = "In Stock";
  let stockStatusTone: "success" | "warning" | "destructive" = "success";
  if (available <= 0) {
    stockStatus = "Out of Stock";
    stockStatusTone = "destructive";
  } else if (available <= 10) {
    stockStatus = "Low Stock";
    stockStatusTone = "warning";
  }

  const netChange = historyData?.results.reduce((sum, e) => sum + e.quantity_change, 0) || 0;

  const historyColumns: Column<any>[] = [
    { key: "created_at", label: "Date", render: (v) => new Date(v as string).toLocaleString() },
    { key: "transaction_type_display", label: "Type" },
    {
      key: "quantity_change",
      label: "Change",
      render: (v) => {
        const num = v as number;
        return <span className={`font-mono ${num > 0 ? "text-success" : "text-destructive"}`}>{num > 0 ? `+${num}` : num}</span>;
      },
    },
    { key: "quantity_before", label: "Before", render: (v) => <span className="font-mono">{v as number}</span> },
    { key: "quantity_after", label: "After", render: (v) => <span className="font-mono">{v as number}</span> },
    { key: "reason_text", label: "Reason" },
    { key: "warehouse_name", label: "Warehouse" },
    {
      key: "created_by",
      label: "Adjusted By",
      render: (_, record) => {
        const name = record.created_by_name;
        const email = record.created_by_email;
        if (name && email) return `${name} (${email})`;
        if (name) return name;
        if (email) return email;
        return "—";
      },
    },
    { key: "unit_cost", label: "Unit Cost", render: (v) => `$${parseFloat(v as string || "0")}` },
    { key: "transaction_id", label: "Txn ID", render: (v) => (v as string)?.slice(0, 8) + "…" },
  ];

  const tabs: DetailTab[] = [
    {
      id: "overview",
      label: "Overview",
      render: () => (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Variant SKU", stock.variant_sku],
            ["Product", stock.variant_name],
            ["Warehouse", stock.warehouse_name],
            ["Bin Location", stock.bin_location || "—"],
            ["On Hand", stock.quantity_on_hand],
            ["Reserved", stock.quantity_reserved],
            ["Available", stock.quantity_available],
            ["Version", stock.version],
          ].map(([l, v]) => (
            <div key={l as string} className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">{l}</span>
              <span className="font-medium">{String(v)}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "history",
      label: "Transaction History",
      count: historyData?.count,
      render: () => (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-40">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} className="h-8" />
            </div>
            <div className="w-40">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} className="h-8" />
            </div>
            <div className="w-44">
              <Label className="text-xs">Type</Label>
              <SearchableSelect
                value={historyTxnType}
                onChange={setHistoryTxnType}
                options={[
                  { value: "all", label: "All" },
                  { value: "PURCHASE_RECEIPT", label: "Purchase Receipt" },
                  { value: "SALE_SHIPMENT", label: "Sale Shipment" },
                  { value: "RETURN_IN", label: "Return In" },
                  { value: "ADJUSTMENT", label: "Adjustment" },
                  { value: "DAMAGE", label: "Damage" },
                  { value: "TRANSFER_IN", label: "Transfer In" },
                  { value: "TRANSFER_OUT", label: "Transfer Out" },
                ]}
                placeholder="All"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setHistoryStartDate(""); setHistoryEndDate(""); setHistoryTxnType("all"); }}
              className="h-8"
            >
              Clear
            </Button>
          </div>
          {historyData && (
            <div className="text-sm flex justify-between items-center">
              <span className="text-muted-foreground">Total transactions: {historyData.count}</span>
              <span className={`font-mono ${netChange >= 0 ? "text-success" : "text-destructive"}`}>
                Net change: {netChange >= 0 ? `+${netChange}` : netChange}
              </span>
            </div>
          )}
          {historyLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading history...</div>
          ) : (
            <TableView columns={historyColumns} data={historyData?.results || []} emptyMessage="No transaction history" />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <DetailLayout
        breadcrumbs={["Inventory", "Stock", stock.variant_sku]}
        entityId={stock.variant_sku}
        title={`${stock.variant_name} — ${stock.warehouse_name}`}
        status={stockStatus}
        subtitle={`Stock record · Last updated ${new Date(stock.updated_at).toLocaleDateString()}`}
        data={stock}
        meta={[
          { label: "Warehouse", value: stock.warehouse_name },
          { label: "SKU", value: stock.variant_sku },
          { label: "Bin Location", value: stock.bin_location || "—" },
          { label: "Last Updated", value: new Date(stock.updated_at).toLocaleDateString() },
        ]}
        summary={[
          { label: "On Hand", value: stock.quantity_on_hand, tone: "info" },
          { label: "Reserved", value: stock.quantity_reserved, tone: stock.quantity_reserved > 0 ? "warning" : "success" },
          { label: "Available", value: stock.quantity_available, tone: stockStatusTone },
          { label: "Warehouses", value: variantSummary?.warehouses?.length || 1, tone: "info" },
        ]}
        tabs={tabs}
        sidebar={
          <StandardSidebar
            riskIndicators={[
              { label: "Stock Level", value: stockStatus, tone: stockStatusTone },
              { label: "Reserved units", value: stock.quantity_reserved > 0 ? `${stock.quantity_reserved} reserved` : "None", tone: stock.quantity_reserved > 0 ? "warning" : "success" },
              { label: "Version", value: `v${stock.version}`, tone: "info" },
            ]}
            metadata={[
              ["Record ID", stock.id],
              ["Variant ID", stock.variant_id?.slice(0, 8) + "…"],
              ["Warehouse", stock.warehouse_name],
              ["Last Updated", new Date(stock.updated_at).toLocaleString()],
            ]}
          />
        }
        onPrimaryAction={permissions.adjust ? () => setAdjustModalOpen(true) : undefined}
        primaryActionLabel="Adjust Stock"
        permissions={{ edit: permissions.adjust, view: true }}
      />
      {permissions.adjust && (
        <StockAdjustModal
          open={adjustModalOpen}
          onClose={() => setAdjustModalOpen(false)}
          variantId={stock.variant_id}
          variantName={stock.variant_name}
          currentStock={stock.quantity_on_hand}
          warehouseId={stock.warehouse_id}
        />
      )}
    </>
  );
}
