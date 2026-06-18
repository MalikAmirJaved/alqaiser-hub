// src/app/(app)/inventory/pos/page.tsx
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWarehouses } from "@/hooks/useWarehouses";
import {
  useCreateSalesOrder,
  useCompleteSalesOrder,
  useCancelSalesOrder,
  useUpdateSalesOrder,
  useDraftSalesOrders,
  cartToLineItems, CartLine
} from "@/hooks/useSalesOrder";
import { useAllVariantsSimple } from "@/hooks/useAllVariants";
import { ProductSearchPanel } from "@/components/inventory/pos/ProductSearchPanel";
import { CartPanel } from "@/components/inventory/pos/CartPanel";
import { ReturnPanel } from "@/components/inventory/pos/ReturnPanel";
import { SalesListPanel } from "@/components/inventory/pos/SalesListPanel";
import { VariantDetailWithStock } from "@/hooks/useAllVariants";
import { debounce } from "lodash";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

type ActivePanel = "search" | "held" | "return" | "sales";

export default function SalesPage() {
  const permissions = useFeaturePermissions("INVENTORY", "sales_order");
  const queryClient = useQueryClient();
  const { data: warehouses = [] } = useWarehouses({ is_active: true });
  const { data: draftOrders = [], refetch: refetchDrafts } = useDraftSalesOrders();
  const { mutateAsync: createSalesOrder, isPending: isCreatingOrder } = useCreateSalesOrder();
  const { mutateAsync: completeOrder, isPending: isCompleting } = useCompleteSalesOrder();
  const { mutateAsync: cancelOrder, isPending: isCancelling } = useCancelSalesOrder();
  const { mutateAsync: updateSalesOrder } = useUpdateSalesOrder();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>("search");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState("");

  // Debounced draft updater
  const updateDraftDebounced = useRef(
    debounce(async (orderId: string, newCart: CartLine[], notes: string, custId: string | null, whId: string) => {
      if (!orderId) return;
      try {
        const lineItems = cartToLineItems(newCart);
        await updateSalesOrder({
          orderId,
          data: {
            line_items: lineItems,
            customer: custId,
            warehouse: whId,
            order_date: new Date().toISOString().split("T")[0],
            notes: notes,
            status: "DRAFT",
          },
        });
        refetchDrafts();
      } catch (err) {
        console.error("Failed to update draft", err);
      }
    }, 800)
  ).current;

  // Watch cart changes for draft auto-update
  useEffect(() => {
    if (activeDraftId && cart.length > 0 && selectedWarehouse) {
      updateDraftDebounced(
        activeDraftId,
        cart,
        orderNotes,
        selectedCustomer?.id ?? null,
        selectedWarehouse.id
      );
    }
    return () => {
      updateDraftDebounced.cancel();
    };
  }, [cart, activeDraftId, selectedCustomer, selectedWarehouse, orderNotes, updateDraftDebounced]);

  // Clear draft ID when cart becomes empty
  useEffect(() => {
    if (activeDraftId && cart.length === 0) {
      setActiveDraftId(null);
    }
  }, [cart, activeDraftId]);

  // Prefetch product list on mount for faster initial load
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ["inventory_variant", { active_only: true }],
      queryFn: () => useAllVariantsSimple({ active_only: true }),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  useEffect(() => {
    if (!selectedWarehouse && warehouses.length > 0) setSelectedWarehouse(warehouses[0]);
  }, [warehouses, selectedWarehouse]);

const clearCart = useCallback(() => {
  setCart([]);
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
      discountPct: parseFloat(line.discount_percent || 0),
      discountFixed: parseFloat(line.discount_amount || 0),
      notes: "",
      salesOrderLineId: line.id,
    }));
    setCart(loadedCart);
    setSelectedCustomer(order.customer ? { id: order.customer.id, name: order.customer_name } : null);
    setOrderNotes(order.notes || "");
    setActiveDraftId(order.id);
    setActivePanel("search");
  }, []);

const handleCompleteSale = useCallback(async (notes: string, payments: any[], overrideCart?: CartLine[]) => {
  const finalCart = overrideCart || cart;
  if (finalCart.length === 0) return;
  
  const customerId = selectedCustomer?.id ?? null;
  const warehouseId = selectedWarehouse?.id;
  
  const notesWithPayments = notes + (payments.length ? ` | Payments: ${payments.map(p => `${p.method}:${p.amount}`).join(", ")}` : "");
  try {
    if (activeDraftId) {
      const updatedLineItems = cartToLineItems(finalCart);
      await completeOrder({ orderId: activeDraftId, line_items: updatedLineItems });
    } else {
      await createSalesOrder({
        customer: customerId,
        warehouse: warehouseId,
        order_date: new Date().toISOString().split("T")[0],
        notes: notesWithPayments,
        line_items: cartToLineItems(finalCart),
        status: "COMPLETE",
      });
    }
    clearCart();
    refetchDrafts();
    await queryClient.refetchQueries({ queryKey: ["inventory_variant"] });
    await queryClient.refetchQueries({ queryKey: ["batchStock"] });
    queryClient.invalidateQueries({ queryKey: ["inventory_sales_order"] });
  } catch (err: any) {
    console.error(err);
  }
}, [cart, activeDraftId, selectedCustomer, selectedWarehouse, createSalesOrder, completeOrder, clearCart, refetchDrafts, queryClient]);

  const handleSaveDraft = useCallback(async (notes: string, overrideCart?: CartLine[]) => {
    const finalCart = overrideCart || cart;
    if (finalCart.length === 0) return;
    try {
      if (activeDraftId) {
        return;
      }
      await createSalesOrder({
        customer: selectedCustomer?.id ?? null,
        warehouse: selectedWarehouse.id,
        order_date: new Date().toISOString().split("T")[0],
        notes,
        line_items: cartToLineItems(finalCart),
        status: "DRAFT",
      });
      clearCart();
      refetchDrafts();
      await queryClient.refetchQueries({ queryKey: ["inventory_variant"] });
      await queryClient.refetchQueries({ queryKey: ["batchStock"] });
    } catch (err: any) {
      console.error(err);
    }
  }, [cart, activeDraftId, selectedCustomer, selectedWarehouse, createSalesOrder, clearCart, refetchDrafts, queryClient]);

  const handleCancelDraft = useCallback(async (orderId: string) => {
    if (!window.confirm("Cancel this draft order? Stock reservations will be released.")) return;
    try {
      await cancelOrder(orderId);
      refetchDrafts();
      if (activeDraftId === orderId) clearCart();
    } catch (err: any) {
      console.error(err);
    }
  }, [cancelOrder, refetchDrafts, activeDraftId, clearCart]);

  const handleCartChange = useCallback((newCart: CartLine[]) => {
  }, []);

  const panelLabels: Record<ActivePanel, string> = {
    search: "Product Catalog",
    held: "Held Orders",
    return: "Returns",
    sales: "Recent Sales",
  };

  const panelIcons: Record<ActivePanel, React.ReactNode> = {
    search: <CatalogIcon size={16} />,
    held: <PauseIcon size={16} />,
    return: <ReturnIcon size={16} />,
    sales: <HistoryIcon size={16} />,
  };

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Left — content panel */}
      <div className="flex flex-col overflow-hidden h-full flex-1 min-w-0 border-r border-border/60">
        {/* Modern Nav Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border bg-card/40 backdrop-blur-md">
          <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-2xl border border-border/40">
            {(["search", "held", "return", "sales"] as ActivePanel[]).map(p => (
              <button
                key={p}
                onClick={() => setActivePanel(p)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300
                  ${activePanel === p
                    ? "bg-card text-primary shadow-lg shadow-black/5 border border-border/50 scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
              >
                <span className={`${activePanel === p ? "text-primary" : "text-muted-foreground/60"}`}>
                  {panelIcons[p]}
                </span>
                {panelLabels[p]}
                {p === "held" && draftOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-warning px-1 text-[9px] font-black text-warning-foreground ring-2 ring-background">
                    {draftOrders.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-2 border border-border/50 hover:bg-muted/60 transition-colors cursor-pointer group">
            <WarehouseIcon className="text-muted-foreground group-hover:text-primary transition-colors" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Station</span>
              <select
                value={selectedWarehouse?.id ?? ""}
                onChange={(e) => setSelectedWarehouse(warehouses.find(w => String(w.id) === e.target.value) ?? null)}
                className="bg-transparent text-xs font-black outline-none text-foreground cursor-pointer appearance-none pr-4"
              >
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic Content Panel */}
        <div className="flex-1 h-full overflow-hidden relative">
          <div className="absolute inset-0 overflow-y-auto">
            {activePanel === "search" && (
              <ProductSearchPanel
                onAddToCart={(v: VariantDetailWithStock) => {
                  const availableStock = v.stock?.available ?? 0;
                  
                  if (availableStock <= 0) {
                    alert(`"${v.product_name}" is out of stock.`);
                    return;
                  }

                  setCart(prev => {
                    const existing = prev.find(l => l.variant.id === v.id);
                    const currentQty = existing ? existing.qty : 0;
                    const newQty = currentQty + 1;
                    
                    if (newQty > availableStock) {
                      alert(`Cannot add more than ${availableStock} items. Only ${availableStock} in stock.`);
                      return prev;
                    }

                    if (existing) {
                      return prev.map(l =>
                        l.variant.id === v.id ? { ...l, qty: newQty } : l
                      );
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
              <div className="p-8 max-w-4xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-black text-foreground">Held Transactions</h2>
                  <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full uppercase tracking-widest">
                    {draftOrders.length} Orders
                  </span>
                </div>
                {draftOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-[32px] border border-dashed border-border/60">
                    <div className="w-20 h-20 rounded-[28px] bg-muted/50 flex items-center justify-center text-muted-foreground mb-4">
                      <PauseIcon size={32} />
                    </div>
                    <p className="text-base font-bold text-foreground">No held orders</p>
                    <p className="text-sm text-muted-foreground mt-1">Pending transactions will appear here</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {draftOrders.map(order => (
                      <div key={order.id} className="group bg-card border border-border rounded-[24px] p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-warning uppercase tracking-widest bg-warning/10 px-2 py-0.5 rounded-md w-fit">
                              Draft
                            </span>
                            <p className="text-base font-black text-foreground group-hover:text-primary transition-colors">{order.order_number}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-muted-foreground">{new Date(order.order_date).toLocaleDateString()}</p>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 mb-6 p-3 bg-muted/30 rounded-xl">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black">
                            {(order.customer_name || "W").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{order.customer_name || "Walk-in Customer"}</p>
                            <p className="text-[10px] font-medium text-muted-foreground">{order.lines?.length || 0} Products</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => loadDraftOrder(order)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-black hover:opacity-90 transition-all active:scale-[0.97]"
                          >
                            <PlayIcon size={14} /> Resume Order
                          </button>
                          {permissions.delete && (
                            <button
                              onClick={() => handleCancelDraft(order.id)}
                              disabled={isCancelling}
                              className="w-10 flex items-center justify-center bg-destructive/10 text-destructive rounded-xl hover:bg-destructive hover:text-destructive-foreground transition-all disabled:opacity-50"
                            >
                              <XIcon size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activePanel === "return" && <ReturnPanel warehouses={warehouses} />}
            {activePanel === "sales" && <SalesListPanel />}
          </div>
        </div>
      </div>

      {/* Right — checkout panel */}
      <div className="w-[400px] flex-shrink-0 flex flex-col bg-card/30 backdrop-blur-sm relative z-10 shadow-2xl shadow-black/10">
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
          onCartChange={handleCartChange}
          isSubmitting={isCreatingOrder || isCompleting}
          activeDraftId={activeDraftId}
          canCreate={permissions.create}
          canUpdate={permissions.update}
        />
      </div>
    </div>
  );
}

// Icons
function CatalogIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>;
}

function HistoryIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>;
}

function PauseIcon({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>;
}

function ReturnIcon({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-3.84" />
  </svg>;
}

function WarehouseIcon({ className = "" }: { className?: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>;
}

function PlayIcon({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>;
}

function XIcon({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>;
}