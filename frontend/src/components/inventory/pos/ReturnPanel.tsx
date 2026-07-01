"use client";
import { useState, useEffect, useMemo } from "react";
import { useFetchSalesOrderByNumber, useCreateSalesReturn, useSalesReturns, type SalesReturnListItem } from "@/hooks/useSalesOrder";
import type { Warehouse } from "@/hooks/useWarehouses";
import { fmt } from "@/hooks/useSalesOrder";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { printThermalReceipt, type ThermalReceiptData } from "@/components/inventory/pos/ThermalReceiptModal";
import { usePagination } from "@/hooks/usePagination";
import { useCompanySettingsQuery } from "@/hooks/useCompanySettings";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Search, Package, CalendarDays, User, Store, Receipt, Undo2 } from "lucide-react";

interface ReturnPanelProps {
  warehouses: Warehouse[];
  initialOrderNumber?: string;
}

type ReturnTab = "return" | "return-list";

export function ReturnPanel({ warehouses, initialOrderNumber }: ReturnPanelProps) {
  const formatCurrency = useFormatCurrency();
  const { data: companySettings } = useCompanySettingsQuery();
  const [activeTab, setActiveTab] = useState<ReturnTab>("return");
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
      refundAmount: number;
      reason: string;
      name: string;
      unitValue: number;      // price per item after discount
      remainingTotal: number; // total value of remaining items
    }[]
  >([]);
  const [shouldFetch, setShouldFetch] = useState(false);

  const { data: fetchedOrderData, isLoading, isFetching } = useFetchSalesOrderByNumber(shouldFetch ? orderNum : "");
  const { mutateAsync: createReturn, isPending: isSubmitting } = useCreateSalesReturn();

  useEffect(() => {
    if (initialOrderNumber && initialOrderNumber !== orderNum) {
      setOrderNum(initialOrderNumber);
      setShouldFetch(true);
      setActiveTab("return");
    }
  }, [initialOrderNumber]);

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
        (fetchedOrderData.lines || [])
          .filter((l: any) => l.status !== "CANCELLED" && (l.max_returnable ?? 0) > 0)
          .map((l: any) => {
            const quantityOrdered = l.quantity_ordered;
            const lineTotal = Number(l.line_total) || 0;
            const unitValue = lineTotal / quantityOrdered;
            const maxQty = l.max_returnable;
            const remainingTotal = unitValue * maxQty;
            return {
              sol_id: l.id,
              qty: 0,
              maxQty: maxQty,
              restock: true,
              unit_cost: Number(l.unit_price) || 0,
              refundAmount: 0,
              reason: "",
              name: l.variant_name || l.variant_sku || l.variant?.sku || "Product",
              unitValue: unitValue,
              remainingTotal: remainingTotal,
            };
          })
      );
    }
  }, [fetchedOrderData]);

  const totalRefund = lines.reduce((sum, l) => sum + (l.qty > 0 ? l.refundAmount : 0), 0);

  const handleSubmitReturn = async () => {
    if (!orderData) return;

    const selectedLines = lines.filter((l) => l.qty > 0);
    if (selectedLines.length === 0) {
      alert("No items selected for return");
      return;
    }

    const missingReason = selectedLines.some((l) => !l.reason.trim());
    if (missingReason) {
      alert("Please provide a reason for each returned item.");
      return;
    }

    const payload = {
      sales_order: orderData.id,
      warehouse: selectedWarehouse,
      return_date: new Date().toISOString(),
      reason: "Customer return",
      return_lines: selectedLines.map((l) => ({
        sales_order_line_id: l.sol_id,
        quantity_returned: l.qty,
        refund_amount: l.refundAmount,
        restock: l.restock,
        unit_cost: l.unit_cost,
        reason: l.reason,
      })),
    };

    try {
      const resp = await createReturn(payload);
      const returnNumber = resp?.return_number ?? "";
      const totalReturned = resp?.total_returned ?? 0;

      // Show thermal receipt for the return
      const receiptData: ThermalReceiptData = {
        orderNumber: returnNumber,
        date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        customerName: orderData?.customer_name || "Walk-in Customer",
        lines: selectedLines.map((l) => ({
          variant_name: l.name,
          variant_sku: "",
          quantity: l.qty,
          unit_price: l.refundAmount / l.qty,
          total: l.refundAmount,
        })),
        totalAmount: totalRefund,
        isReturn: true,
      };
      printThermalReceipt(receiptData, companySettings?.companyName || "Store", formatCurrency);

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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab Navigation */}
      <div className="px-4 pt-4 pb-2 border-b border-border/60 bg-card/30">
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("return")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "return"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Undo2 size={14} />
            Process Return
          </button>
          <button
            onClick={() => setActiveTab("return-list")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "return-list"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Receipt size={14} />
            Return List
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "return" ? (
          <ReturnForm
            orderNum={orderNum}
            setOrderNum={setOrderNum}
            selectedWarehouse={selectedWarehouse}
            setSelectedWarehouse={setSelectedWarehouse}
            warehouses={warehouses}
            isFetching={isFetching}
            isLoading={isLoading}
            handleFetchOrder={handleFetchOrder}
            orderData={orderData}
            lines={lines}
            setLines={setLines}
            totalRefund={totalRefund}
            formatCurrency={formatCurrency}
            handleSubmitReturn={handleSubmitReturn}
            isSubmitting={isSubmitting}
            handleReset={handleReset}
            shouldFetch={shouldFetch}
          />
        ) : (
          <ReturnList warehouses={warehouses} formatCurrency={formatCurrency} />
        )}
      </div>
    </div>
  );
}

// ── Return Form Sub-Component ─────────────────────────────────

function ReturnForm({
  orderNum,
  setOrderNum,
  selectedWarehouse,
  setSelectedWarehouse,
  warehouses,
  isFetching,
  isLoading,
  handleFetchOrder,
  orderData,
  lines,
  setLines,
  totalRefund,
  formatCurrency,
  handleSubmitReturn,
  isSubmitting,
  handleReset,
  shouldFetch,
}: {
  orderNum: string;
  setOrderNum: (v: string) => void;
  selectedWarehouse: string;
  setSelectedWarehouse: (v: string) => void;
  warehouses: Warehouse[];
  isFetching: boolean;
  isLoading: boolean;
  handleFetchOrder: () => void;
  orderData: any;
  lines: any[];
  setLines: any;
  totalRefund: number;
  formatCurrency: any;
  handleSubmitReturn: () => void;
  isSubmitting: boolean;
  handleReset: () => void;
  shouldFetch: boolean;
}) {
  return (
    <div className="flex-1 p-4 space-y-4">
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
                          const qty = Math.min(Number(e.target.value), line.maxQty);
                          // Calculate refund based on unit value * quantity
                          const autoRefund = line.unitValue * qty;
                          setLines((prev: any) =>
                            prev.map((x: any, j: number) =>
                              j === idx
                                ? { ...x, qty: Math.max(0, qty), refundAmount: autoRefund }
                                : x
                            )
                          );
                        }}
                        className="w-full bg-background rounded-md px-2 py-1.5 text-sm outline-none focus:ring-1 ring-primary"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-muted-foreground">Refund Amount (₦)</span>
                      <input
                        type="number"
                        min={0}
                        max={line.remainingTotal}
                        step={0.01}
                        value={line.refundAmount}
                        onChange={(e) => {
                          let val = Number(e.target.value);
                          if (val > line.remainingTotal) val = line.remainingTotal;
                          if (val < 0) val = 0;
                          setLines((prev: any) =>
                            prev.map((x: any, j: number) =>
                              j === idx ? { ...x, refundAmount: val } : x
                            )
                          );
                        }}
                        className="w-full bg-background rounded-md px-2 py-1.5 text-sm outline-none focus:ring-1 ring-primary"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={line.restock}
                        onChange={(e) =>
                          setLines((prev: any) =>
                            prev.map((x: any, j: number) =>
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
                        setLines((prev: any) =>
                          prev.map((x: any, j: number) =>
                            j === idx ? { ...x, reason: e.target.value } : x
                          )
                        )
                      }
                      placeholder="Return reason *"
                      required={line.qty > 0}
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

            <div className="flex justify-between text-sm font-semibold border-t border-border pt-2 mt-2">
              <span>Total Refund:</span>
              <span className="text-primary">{formatCurrency(totalRefund)}</span>
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

// ── Return List Sub-Component ─────────────────────────────────

function ReturnList({
  warehouses,
  formatCurrency,
}: {
  warehouses: Warehouse[];
  formatCurrency: any;
}) {
  const pagination = usePagination();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: returnsRes, isLoading } = useSalesReturns({
    search: searchQuery || undefined,
    page: pagination.page,
    page_size: pagination.pageSize,
  });
  const returns = returnsRes?.data ?? [];
  const totalCount = returnsRes?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pagination.pageSize));
  const safePage = Math.min(pagination.page, totalPages);

  useEffect(() => {
    pagination.resetPage();
  }, [searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* Search Header */}
      <div className="px-4 py-3 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by return # or order #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Returns List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))
        ) : returns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
              <Receipt className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {searchQuery ? "No matching returns" : "No returns yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              {searchQuery ? "Try a different search term" : "Returns will appear here"}
            </p>
          </div>
        ) : (
          returns.map((ret) => (
            <ReturnCard key={ret.id} returnItem={ret} formatCurrency={formatCurrency} />
          ))
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalCount > pagination.pageSize && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 bg-muted/10">
          <span className="text-xs text-muted-foreground font-medium">
            {(safePage - 1) * pagination.pageSize + 1}-
            {Math.min(safePage * pagination.pageSize, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={pagination.prevPage}
              disabled={safePage <= 1}
              className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={pagination.nextPage}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors text-muted-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReturnCard({
  returnItem,
  formatCurrency,
}: {
  returnItem: SalesReturnListItem;
  formatCurrency: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const returnDate = new Date(returnItem.return_date);
  const createdAt = new Date(returnItem.created_at);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-warning/30 hover:shadow-md transition-all">
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center text-warning shrink-0">
            <Undo2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-foreground truncate">{returnItem.return_number}</h4>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success border border-success/20">
                {returnItem.status || "COMPLETE"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {returnItem.sales_order_number || returnItem.sales_order}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-warning">
            {formatCurrency(returnItem.total_returned)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Refunded
          </div>
        </div>
      </div>

      <div className="px-4 pb-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {returnDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        {returnItem.warehouse?.warehouse_name && (
          <span className="flex items-center gap-1">
            <Store className="h-3 w-3" />
            {returnItem.warehouse.warehouse_name}
          </span>
        )}
      </div>

      {returnItem.reason && (
        <div className="px-4 pb-2">
          <p className="text-[10px] text-muted-foreground italic truncate">
            Reason: {returnItem.reason}
          </p>
        </div>
      )}

      {/* Expandable Lines */}
      {returnItem.lines && returnItem.lines.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/20 transition-colors border-t border-border/40"
          >
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {returnItem.lines.length} {returnItem.lines.length === 1 ? "Item" : "Items"} Returned
            </span>
            {expanded ? (
              <ChevronUpIcon className="h-3.5 w-3.5" />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5" />
            )}
          </button>
          {expanded && (
            <div className="border-t border-border/40 bg-muted/10 px-4 py-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="pb-1 text-left font-medium">Product</th>
                    <th className="pb-1 text-center font-medium">Qty</th>
                    <th className="pb-1 text-right font-medium">Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {returnItem.lines.map((line) => (
                    <tr key={line.id} className="border-b border-border/20">
                      <td className="py-1 pr-2">
                        <div className="font-medium text-foreground text-xs">
                          {line.variant_name || "Product"}
                        </div>
                        <div className="text-[9px] text-muted-foreground font-mono">
                          SKU: {line.variant_sku || "—"}
                        </div>
                      </td>
                      <td className="py-1 text-center">{line.quantity_returned}</td>
                      <td className="py-1 text-right font-medium text-warning">
                        {formatCurrency(line.refund_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────

function ReturnIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.84" />
    </svg>
  );
}

function ChevronDownIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronUpIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}