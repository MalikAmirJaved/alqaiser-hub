// src/components/inventory/StockHistoryDrawer.tsx
"use client";

import { useState } from "react";
import { useStockHistory } from "@/hooks/useStockManagement";
import { TableView, Column } from "@/components/reuseable/TableGridView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X } from "lucide-react";

interface StockHistoryDrawerProps {
  variantId: string | null;
  open: boolean;
  onClose: () => void;
}

export function StockHistoryDrawer({ variantId, open, onClose }: StockHistoryDrawerProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [txnType, setTxnType] = useState("all");

  const { data, isLoading } = useStockHistory(
  variantId
    ? {
        variant_id: variantId,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        transaction_type: txnType === "all" ? undefined : txnType, // Handle "all" as undefined
        page_size: 100,
      }
    : undefined,
);
console.log("data:: ", data)
const columns: Column<any>[] = [
  { key: "created_at", label: "Date", render: (v) => new Date(v as string).toLocaleString() },
  { key: "transaction_type_display", label: "Type" },
  {
    key: "quantity_change",
    label: "Change",
    render: (v) => {
      const num = v as number;
      return <span className={num > 0 ? "text-success" : "text-destructive"}>{num > 0 ? `+${num}` : num}</span>;
    },
  },
  { key: "quantity_before", label: "Before" },
  { key: "quantity_after", label: "After" },
  { key: "reason_text", label: "Reason" },
  { key: "warehouse_name", label: "Warehouse" },
  // 👇 new columns
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
  { key: "unit_cost", label: "Unit Cost", render: (v) => `$${parseFloat(v as string).toFixed(2)}` },
  { key: "transaction_id", label: "Transaction ID", render: (v) => (v as string).slice(0, 8) + "…" },
];

  // Compute net change for the filtered history
  const netChange = data?.results.reduce((sum, entry) => sum + entry.quantity_change, 0) || 0;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 w-[800px] max-w-full bg-card border-l border-border shadow-xl z-50 flex flex-col">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="text-lg font-semibold">Stock History</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-border bg-muted/20">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-40">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8" />
            </div>
            <div className="w-40">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8" />
            </div>
            <div className="w-44">
              <Label className="text-xs">Transaction Type</Label>
              <Select value={txnType} onValueChange={setTxnType}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="PURCHASE_RECEIPT">Purchase Receipt</SelectItem>
                  <SelectItem value="SALE_SHIPMENT">Sale Shipment</SelectItem>
                  <SelectItem value="RETURN_IN">Return In</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                  <SelectItem value="DAMAGE">Damage</SelectItem>
                  <SelectItem value="TRANSFER_IN">Transfer In</SelectItem>
                  <SelectItem value="TRANSFER_OUT">Transfer Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); setTxnType("all"); }} className="h-8">
              Clear
            </Button>
          </div>
          {data && (
            <div className="mt-3 text-sm flex justify-between items-center">
              <span className="text-muted-foreground">Total transactions: {data.count}</span>
              <span className={`font-mono ${netChange >= 0 ? "text-success" : "text-destructive"}`}>
                Net change: {netChange >= 0 ? `+${netChange}` : netChange}
              </span>
            </div>
          )}
        </div>

        {/* History table */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin w-6 h-6" />
            </div>
          ) : (
            <TableView columns={columns} data={data?.results || []} emptyMessage="No history records" />
          )}
        </div>
      </div>
    </>
  );
}