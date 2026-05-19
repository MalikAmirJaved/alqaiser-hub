// src/app/(app)/inventory/pos/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWarehouses } from "@/hooks/useWarehouses";
import {
  useCreateSalesOrder,
  useCompleteSalesOrder,
  useCancelSalesOrder,
  useDraftSalesOrders,
  cartToLineItems, CartLine
} from "@/hooks/useSalesOrder";
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

  useEffect(() => {
    if (!selectedWarehouse && warehouses.length > 0) setSelectedWarehouse(warehouses[0]);
  }, [warehouses, selectedWarehouse]);

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setActiveDraftId(null);
    setOrderNotes("");
  };

  const loadDraftOrder = (order: any) => {
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
      salesOrderLineId: line.id, // Store the backend line ID
    }));
    setCart(loadedCart);
    setSelectedCustomer(order.customer ? { id: order.customer.id, name: order.customer_name } : null);
    setOrderNotes(order.notes || "");
    setActiveDraftId(order.id);
    setActivePanel("search");
  };

  const handleCompleteSale = async (notes: string, payments: any[]) => {
    if (cart.length === 0) return;
    const notesWithPayments = notes + (payments.length ? ` | Payments: ${payments.map(p => `${p.method}:${p.amount}`).join(", ")}` : "");

    try {
      if (activeDraftId) {
        // Complete existing draft order with updated cart (may have changed quantities)
        const updatedLineItems = cartToLineItems(cart); // Now includes line_id
        await completeOrder({ orderId: activeDraftId, line_items: updatedLineItems });
        alert(`Order completed with updated quantities, stock deducted`);
      } else {
        // Create new complete order
        const order = await createSalesOrder({
          customer: selectedCustomer?.id ?? null,
          warehouse: selectedWarehouse.id,
          order_date: new Date().toISOString().split("T")[0],
          notes: notesWithPayments,
          line_items: cartToLineItems(cart),
          status: "COMPLETE",
        });
        alert(`Order ${order.order_number} completed and stock deducted`);
      }
      clearCart();
      refetchDrafts();
      queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSaveDraft = async (notes: string) => {
    if (cart.length === 0) return;
    try {
      if (activeDraftId) {
        alert("Draft orders cannot be modified after creation. Please complete or cancel this order first.");
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
      alert("Draft order saved (stock reserved)");
      clearCart();
      refetchDrafts();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCancelDraft = async (orderId: string) => {
    if (confirm("Cancel this draft order? Stock reservations will be released.")) {
      try {
        await cancelOrder(orderId);
        alert("Draft order cancelled");
        refetchDrafts();
        if (activeDraftId === orderId) clearCart();
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  return (
    <div className="flex h-full bg-background overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 border-r border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(["search", "held", "return", "sales"] as ActivePanel[]).map(p => (
              <button
                key={p}
                onClick={() => setActivePanel(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${activePanel === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {p === "held" ? `Held (${draftOrders.length})` : p === "sales" ? "All Sales" : p}
              </button>
            ))}
          </div>
          <select
            value={selectedWarehouse?.id ?? ""}
            onChange={(e) => setSelectedWarehouse(warehouses.find(w => String(w.id) === e.target.value) ?? null)}
            className="bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none"
          >
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
          </select>
        </div>

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
          <div className="p-4 space-y-3 overflow-y-auto">
            {draftOrders.length === 0 ? (
              <div className="text-center text-muted-foreground">No held orders</div>
            ) : (
              draftOrders.map(order => (
                <div key={order.id} className="bg-card border rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{order.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.customer_name || "Walk-in Customer"} • {order.lines?.length || 0} items
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.order_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadDraftOrder(order)}
                      className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => handleCancelDraft(order.id)}
                      disabled={isCancelling}
                      className="px-3 py-1 bg-destructive/20 text-destructive rounded-lg text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activePanel === "return" && <ReturnPanel warehouses={warehouses} />}

        {activePanel === "sales" && <SalesListPanel />}
      </div>

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
      />
    </div>
  );
}