// src/app/(app)/inventory/pos/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWarehouses } from "@/hooks/useWarehouses";
import {
  useCreateSalesOrder,
  useCompleteSalesOrder,
  useCancelSalesOrder,
  useDraftSalesOrders,
  cartToLineItems, CartLine
} from "@/hooks/useSalesOrder";
import { useAllVariantsSimple } from "@/hooks/useAllVariants";
import { ProductSearchPanel } from "@/components/inventory/pos/ProductSearchPanel";
import { CartPanel } from "@/components/inventory/pos/CartPanel";
import { ReturnPanel } from "@/components/inventory/pos/ReturnPanel";
import { SalesListPanel } from "@/components/inventory/pos/SalesListPanel";

type ActivePanel = "search" | "held" | "return" | "sales";

export default function SalesPage() {
  const queryClient = useQueryClient();
  const { data: warehouses = [] } = useWarehouses({ is_active: true });
  const { data: draftOrders = [], refetch: refetchDrafts } = useDraftSalesOrders();
  const { mutateAsync: createSalesOrder, isPending: isCreatingOrder } = useCreateSalesOrder();
  const { mutateAsync: completeOrder, isPending: isCompleting } = useCompleteSalesOrder();
  const { mutateAsync: cancelOrder, isPending: isCancelling } = useCancelSalesOrder();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>("search");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState("");

  // Prefetch product list on mount for faster initial load
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ["allVariantsSimple", { active_only: true }],
      queryFn: () => useAllVariantsSimple({ active_only: true }),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  useEffect(() => {
    if (!selectedWarehouse && warehouses.length > 0) setSelectedWarehouse(warehouses[0]);
  }, [warehouses, selectedWarehouse]);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedCustomer(null);
    setActiveDraftId(null);
    setOrderNotes("");
  }, []);

  const loadDraftOrder = useCallback((order: any) => {
    const loadedCart: CartLine[] = (order.lines || []).map((line: any) => ({
      variant: {
        id: line.variant,
        sku: line.variant_sku,
        product_name: line.variant_name,
        selling_price: line.unit_price,
      } as any,
      qty: line.quantity_ordered,
      unitPrice: parseFloat(line.unit_price),
      taxRate: parseFloat(line.tax_rate || 0),
      discountPct: 0,
      discountFixed: 0,
      notes: "",
      salesOrderLineId: line.id,
    }));
    setCart(loadedCart);
    setSelectedCustomer(order.customer ? { id: order.customer.id, name: order.customer_name } : null);
    setOrderNotes(order.notes || "");
    setActiveDraftId(order.id);
    setActivePanel("search");
  }, []);

  const handleCompleteSale = useCallback(async (notes: string, payments: any[]) => {
    if (cart.length === 0) return;
    const notesWithPayments = notes + (payments.length ? ` | Payments: ${payments.map(p => `${p.method}:${p.amount}`).join(", ")}` : "");

    try {
      if (activeDraftId) {
        const updatedLineItems = cartToLineItems(cart);
        await completeOrder({ orderId: activeDraftId, line_items: updatedLineItems });
      } else {
        const order = await createSalesOrder({
          customer: selectedCustomer?.id ?? null,
          warehouse: selectedWarehouse.id,
          order_date: new Date().toISOString().split("T")[0],
          notes: notesWithPayments,
          line_items: cartToLineItems(cart),
          status: "COMPLETE",
        });
      }
      clearCart();
      refetchDrafts();
      queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
      queryClient.invalidateQueries({ queryKey: ["batchStock"] });
    } catch (err: any) {
    }
  }, [cart, activeDraftId, selectedCustomer, selectedWarehouse, createSalesOrder, completeOrder, clearCart, refetchDrafts, queryClient]);

  const handleSaveDraft = useCallback(async (notes: string) => {
    if (cart.length === 0) return;
    try {
      if (activeDraftId) {
        return;
      }
      await createSalesOrder({
        customer: selectedCustomer?.id ?? null,
        warehouse: selectedWarehouse.id,
        order_date: new Date().toISOString().split("T")[0],
        notes,
        line_items: cartToLineItems(cart),
        status: "DRAFT",
      });
      clearCart();
      refetchDrafts();
    } catch (err: any) {
    }
  }, [cart, activeDraftId, selectedCustomer, selectedWarehouse, createSalesOrder, clearCart, refetchDrafts]);

  const handleCancelDraft = useCallback(async (orderId: string) => {
    if (!window.confirm("Cancel this draft order? Stock reservations will be released.")) return;
    try {
      await cancelOrder(orderId);
      refetchDrafts();
      if (activeDraftId === orderId) clearCart();
    } catch (err: any) {
    }
  }, [cancelOrder, refetchDrafts, activeDraftId, clearCart]);

  const panelLabels: Record<ActivePanel, string> = {
    search: "Products",
    held: `On Hold (${draftOrders.length})`,
    return: "Returns",
    sales: "Sales History",
  };

  const panelIcons: Record<ActivePanel, React.ReactNode> = {
    search: <SearchIcon />,
    held: <PauseIcon />,
    return: <ReturnIcon />,
    sales: <ListIcon />,
  };

  return (
    <div className="flex h-full overflow-hidden relative">   

      {/* Left — product + panels */}
      <div className="flex flex-col overflow-hidden h-full flex-1 min-w-0 border-r border-border">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card/80 backdrop-blur-sm">
          <nav className="flex gap-0.5 bg-muted/70 rounded-xl p-1 flex-1">
            {(["search", "held", "return", "sales"] as ActivePanel[]).map(p => (
              <button
                key={p}
                onClick={() => setActivePanel(p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                  ${activePanel === p
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
              >
                <span className="opacity-70">{panelIcons[p]}</span>
                {panelLabels[p]}
                {p === "held" && draftOrders.length > 0 && (
                  <span className="ml-0.5 min-w-[18px] h-[18px] rounded-full bg-warning text-warning-foreground text-[10px] font-semibold flex items-center justify-center px-1">
                    {draftOrders.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-1.5 border border-border/50">
            <WarehouseIcon />
            <select
              value={selectedWarehouse?.id ?? ""}
              onChange={(e) => setSelectedWarehouse(warehouses.find(w => String(w.id) === e.target.value) ?? null)}
              className="bg-transparent text-xs font-medium outline-none text-foreground max-w-[140px] cursor-pointer"
            >
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
            </select>
          </div>
        </div>

        {/* Panel content */}
        <div className="flex-1 h-full overflow-y-auto">
          {activePanel === "search" && (
            <ProductSearchPanel
              onAddToCart={(v) => {
                setCart(prev => {
                  const idx = prev.findIndex(l => l.variant.id === v.id);
                  if (idx >= 0) {
                    const newCart = [...prev];
                    newCart[idx] = { ...newCart[idx], qty: newCart[idx].qty + 1 };
                    return newCart;
                  }
                  return [...prev, {
                    variant: v,
                    qty: 1,
                    unitPrice: Number(v.selling_price),
                    discountPct: 0,
                    discountFixed: 0,
                    taxRate: 0,
                    notes: "",
                    salesOrderLineId: undefined
                  }];
                });
              }}
              warehouseId={selectedWarehouse?.id}
            />
          )}

          {activePanel === "held" && (
            <div className="p-4 space-y-2">
              {draftOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <PauseIcon size={22} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">No held orders</p>
                    <p className="text-xs text-muted-foreground mt-1">Save a draft to hold an order for later</p>
                  </div>
                </div>
              ) : (
                draftOrders.map(order => (
                  <div key={order.id} className="bg-card border border-border rounded-xl p-4 hover:border-border/80 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-warning/15 text-warning text-xs font-medium">
                            DRAFT
                          </span>
                          <p className="text-sm font-semibold text-foreground">{order.order_number}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {order.customer_name || "Walk-in Customer"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.lines?.length || 0} item{(order.lines?.length || 0) !== 1 ? "s" : ""} · {new Date(order.order_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => loadDraftOrder(order)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                        >
                          <PlayIcon size={12} /> Resume
                        </button>
                        <button
                          onClick={() => handleCancelDraft(order.id)}
                          disabled={isCancelling}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg text-xs font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
                        >
                          <XIcon size={12} /> Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activePanel === "return" && <ReturnPanel warehouses={warehouses} />}
          {activePanel === "sales" && <SalesListPanel />}
        </div>
      </div>

      {/* Right — cart */}
      <div className="w-[360px] flex-shrink-0 flex flex-col">
        <CartPanel
          cart={cart}
          onUpdateCart={setCart}
          onClearCart={clearCart}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={setSelectedCustomer}
          selectedWarehouse={selectedWarehouse}
          onSelectWarehouse={setSelectedWarehouse}
          warehouses={warehouses}
          onSaveDraft={handleSaveDraft}
          onCompleteSale={handleCompleteSale}
          isSubmitting={isCreatingOrder || isCompleting}
          activeDraftId={activeDraftId}
        />
      </div>
    </div>
  );
}

// Icons
function SearchIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>; }
function PauseIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>; }
function ReturnIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.84" /></svg>; }
function ListIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>; }
function WarehouseIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>; }
function PlayIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>; }
function XIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>; }