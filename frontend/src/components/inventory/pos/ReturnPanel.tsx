// src/components/inventory/pos/ReturnPanel.tsx
"use client";
import { useState, useEffect } from "react";
import { useFetchSalesOrderByNumber, useCreateSalesReturn } from "@/hooks/useSalesOrder";
import type { Warehouse } from "@/hooks/useWarehouses";

interface ReturnPanelProps {
  warehouses: Warehouse[];
}

export function ReturnPanel({ warehouses }: ReturnPanelProps) {
  const [orderNum, setOrderNum] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(warehouses[0]?.id?.toString() ?? "");
  const [orderData, setOrderData] = useState<any>(null);
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
  const [shouldFetch, setShouldFetch] = useState(false);

  const { data: fetchedOrderData, isLoading, isFetching } = useFetchSalesOrderByNumber(shouldFetch ? orderNum : "");
  const { mutateAsync: createReturn, isPending: isSubmitting } = useCreateSalesReturn();

  const handleFetchOrder = () => {
    if (!orderNum.trim()) {
      alert("Please enter an order number");
      return;
    }
    setShouldFetch(true);
  };

  useEffect(() => {
    if (fetchedOrderData && fetchedOrderData.lines) {
      setOrderData(fetchedOrderData);
      setLines(
        (fetchedOrderData.lines || []).map((l: any) => ({
          sol_id: l.id,
          qty: 0,
          maxQty: l.quantity_ordered,   // removed quantity_shipped – use ordered quantity
          restock: true,
          unit_cost: Number(l.unit_price) || 0,
          reason: "",
          name: l.variant_name || l.variant_sku || l.variant?.sku || "Product",
        }))
      );
    }
  }, [fetchedOrderData]);

  const handleSubmitReturn = async () => {
    if (!orderData) return;

    const selectedLines = lines.filter((l) => l.qty > 0);
    if (selectedLines.length === 0) {
      alert("No items selected for return");
      return;
    }

    const payload = {
      sales_order: orderData.id ?? orderData.id,
      warehouse: selectedWarehouse,
      return_date: new Date().toISOString(),
      reason: "Customer return",
      return_lines: selectedLines.map((l) => ({
        sales_order_line_id: l.sol_id,
        quantity_returned: l.qty,
        restock: l.restock,
        unit_cost: l.unit_cost,
        reason: l.reason,
      })),
    };

    try {
      const resp = await createReturn(payload);
      const returnNumber = resp?.return_number ?? "";
      alert(`✓ Return ${returnNumber} processed successfully!`);
      
      setOrderNum("");
      setOrderData(null);
      setLines([]);
      setShouldFetch(false);
      setSelectedWarehouse(warehouses[0]?.id?.toString() ?? "");
    } catch (err: any) {
      alert(`Error processing return: ${err.message}`);
    }
  };

  const handleReset = () => {
    setOrderNum("");
    setOrderData(null);
    setLines([]);
    setShouldFetch(false);
    setSelectedWarehouse(warehouses[0]?.id?.toString() ?? "");
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ReturnIcon size={16} /> Process Customer Return
        </h3>

        <div className="flex gap-2">
          <input
            value={orderNum}
            onChange={(e) => setOrderNum(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFetchOrder()}
            placeholder="Enter order number (e.g., SO-1234567890-1234)"
            className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary"
            disabled={isFetching || isLoading}
          />
          <button
            onClick={handleFetchOrder}
            disabled={isFetching || isLoading || !orderNum.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isFetching || isLoading ? "Loading..." : "Find Order"}
          </button>
          {orderData && (
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80"
            >
              Clear
            </button>
          )}
        </div>

        {orderData && (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order Number:</span>
                <span className="font-medium text-foreground">{orderData.order_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium text-foreground">
                  {orderData.customer_name || "Walk-in Customer"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order Date:</span>
                <span className="text-foreground">
                  {new Date(orderData.order_date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/20 text-success">
                  {orderData.status}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Select Items to Return
              </h4>
              {lines.map((line, idx) => (
                <div key={line.sol_id} className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{line.name}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                      Max: {line.maxQty}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-xs text-muted-foreground">Quantity to Return</span>
                      <input
                        type="number"
                        min={0}
                        max={line.maxQty}
                        step={1}
                        value={line.qty}
                        onChange={(e) => {
                          const val = Math.min(Number(e.target.value), line.maxQty);
                          setLines((prev) =>
                            prev.map((x, j) =>
                              j === idx ? { ...x, qty: Math.max(0, val) } : x
                            )
                          );
                        }}
                        className="w-full bg-background rounded-md px-2 py-1.5 text-sm outline-none focus:ring-1 ring-primary"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-muted-foreground">Unit Cost (₦)</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={line.unit_cost}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x, j) =>
                              j === idx ? { ...x, unit_cost: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-full bg-background rounded-md px-2 py-1.5 text-sm outline-none focus:ring-1 ring-primary"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={line.restock}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x, j) =>
                              j === idx ? { ...x, restock: e.target.checked } : x
                            )
                          )
                        }
                        className="rounded border-border"
                      />
                      Restock to warehouse
                    </label>

                    <input
                      value={line.reason}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x, j) =>
                            j === idx ? { ...x, reason: e.target.value } : x
                          )
                        )
                      }
                      placeholder="Return reason (optional)"
                      className="flex-1 bg-background rounded-md px-2 py-1.5 text-xs outline-none focus:ring-1 ring-primary placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Return to Warehouse</label>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 ring-primary text-foreground"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id.toString()}>
                    {w.warehouse_name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSubmitReturn}
              disabled={isSubmitting || lines.every((l) => l.qty === 0)}
              className="w-full py-2.5 bg-warning text-warning-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isSubmitting ? "Processing Return..." : "Submit Return"}
            </button>
          </div>
        )}

        {shouldFetch && !isLoading && !orderData && !isFetching && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Order not found</p>
            <p className="text-xs mt-1">Please check the order number and try again</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReturnIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.84" />
    </svg>
  );
}