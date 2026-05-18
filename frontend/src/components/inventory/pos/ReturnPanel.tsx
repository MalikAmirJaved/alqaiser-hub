// src/components/inventory/pos/ReturnPanel.tsx
"use client";
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import type { UseQueryClient } from "@tanstack/react-query";
import type { Warehouse } from "@/hooks/useWarehouses";

interface ReturnPanelProps {
  api: ReturnType<typeof useApi>;
  queryClient: ReturnType<UseQueryClient>;
  warehouses: Warehouse[];
}

export function ReturnPanel({ api, queryClient, warehouses }: ReturnPanelProps) {
  const [orderNum, setOrderNum] = useState("");
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [returnWarehouse, setReturnWarehouse] = useState(warehouses[0]?.id ?? "");
  const [lines, setLines] = useState<
    {
      sol_id: string;
      qty: number;
      maxQty: number;
      restock: boolean;
      unit_cost: number;
      reason: string;
      name: string;
    }[]
  >([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchOrder = async () => {
    if (!orderNum.trim()) return;
    setLoading(true);
    try {
      const res = await api(`/api/inventory/sales-orders/?order_number=${encodeURIComponent(orderNum)}`);
      const order = res?.results?.[0];
      if (!order) {
        alert("Order not found");
        return;
      }
      setOrderData(order);
      setLines(
        (order.lines || []).map((l: any) => ({
          sol_id: l.id,
          qty: 0,
          maxQty: l.quantity_shipped,
          restock: true,
          unit_cost: Number(l.unit_price),
          reason: "",
          name: l.variant_name || l.variant_sku || l.variant?.sku || "Product",
        }))
      );
    } catch (err) {
      alert("Error fetching order");
    } finally {
      setLoading(false);
    }
  };

  const submitReturn = async () => {
    if (!orderData) return;
    const payload = {
      sales_order: orderData._id ?? orderData.id,
      warehouse: returnWarehouse,
      return_date: new Date().toISOString(),
      reason: "Customer return",
      return_lines: lines
        .filter((l) => l.qty > 0)
        .map((l) => ({
          sales_order_line_id: l.sol_id,
          quantity_returned: l.qty,
          restock: l.restock,
          unit_cost: l.unit_cost,
          reason: l.reason,
        })),
    };
    if (payload.return_lines.length === 0) {
      alert("No items selected for return");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await api("/api/inventory/sales-returns/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
      alert(`✓ Return ${resp?.data?.return_number ?? ""} processed!`);
      // reset form
      setOrderData(null);
      setOrderNum("");
      setLines([]);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ReturnIcon size={16} /> Process Return
        </h3>
        <div className="flex gap-2">
          <input
            value={orderNum}
            onChange={(e) => setOrderNum(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchOrder()}
            placeholder="Enter order number (SO-…)"
            className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary"
          />
          <button
            onClick={fetchOrder}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "…" : "Find"}
          </button>
        </div>

        {orderData && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Order: <span className="font-medium text-foreground">{orderData.order_number}</span> · Customer:{" "}
              <span className="font-medium text-foreground">{orderData.customer_name}</span>
            </div>

            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={l.sol_id} className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">{l.name}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                      Max: {l.maxQty}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-0.5">
                      <span className="text-xs text-muted-foreground">Return qty</span>
                      <input
                        type="number"
                        min={0}
                        max={l.maxQty}
                        value={l.qty}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, qty: Math.min(Number(e.target.value), l.maxQty) } : x
                            )
                          )
                        }
                        className="w-full bg-background rounded-md px-2 py-1 text-sm outline-none focus:ring-1 ring-primary"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-xs text-muted-foreground">Unit cost</span>
                      <input
                        type="number"
                        step="0.01"
                        value={l.unit_cost}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, unit_cost: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-full bg-background rounded-md px-2 py-1 text-sm outline-none focus:ring-1 ring-primary"
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={l.restock}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, restock: e.target.checked } : x))
                          )
                        }
                        className="rounded"
                      />
                      Restock
                    </label>
                    <input
                      value={l.reason}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x))
                        )
                      }
                      placeholder="Reason…"
                      className="flex-1 bg-background rounded-md px-2 py-1 text-xs outline-none focus:ring-1 ring-primary"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Return to Warehouse</label>
              <select
                value={returnWarehouse}
                onChange={(e) => setReturnWarehouse(e.target.value)}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary text-foreground"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={submitReturn}
              disabled={submitting || lines.every((l) => l.qty === 0)}
              className="w-full py-2.5 bg-warning text-warning-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? "Processing…" : "Submit Return"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReturnIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.84" />
    </svg>
  );
}