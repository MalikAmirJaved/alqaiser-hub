// @/app/(app)/inventory/pos/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useApi } from "@/hooks/useApi";
import { useQueryClient } from "@tanstack/react-query";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useCreateSalesOrder, cartToLineItems } from "@/hooks/useSalesOrder";
import { ProductSearchPanel } from "@/components/inventory/pos/ProductSearchPanel";
import { CartPanel } from "@/components/inventory/pos/CartPanel";
import { ReturnPanel } from "@/components/inventory/pos/ReturnPanel";
import { CartLine, cartTotal, cartSubtotal, cartTax } from "@/lib/utils";

type ActivePanel = "search" | "held" | "return";

export default function SalesPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { data: warehouses = [] } = useWarehouses({ is_active: true });
  const { mutateAsync: createSalesOrder, isPending: isCreatingOrder } = useCreateSalesOrder();
  
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>("search");
  const [heldOrders, setHeldOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedWarehouse && warehouses.length > 0) setSelectedWarehouse(warehouses[0]);
  }, [warehouses, selectedWarehouse]);

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
  };

  const holdOrder = () => {
    if (cart.length === 0) return;
    const held = {
      id: crypto.randomUUID(),
      label: selectedCustomer?.name ?? `Order #${heldOrders.length + 1}`,
      cart,
      customer: selectedCustomer,
      timestamp: Date.now(),
    };
    setHeldOrders([...heldOrders, held]);
    clearCart();
  };

  const resumeOrder = (h: any) => {
    if (cart.length > 0 && !confirm("Replace current cart with held order?")) return;
    setCart(h.cart);
    setSelectedCustomer(h.customer);
    setHeldOrders(heldOrders.filter(x => x.id !== h.id));
    setActivePanel("search");
  };

  const handleSaveDraft = async (notes: string) => {
    if (cart.length === 0) return;
    try {
      await createSalesOrder({
        customer: selectedCustomer?.id ?? null,
        warehouse: selectedWarehouse.id,
        order_date: new Date().toISOString().split("T")[0],
        notes,
        line_items: cartToLineItems(cart),
        status: "DRAFT",
      });
      alert("Draft order saved");
      clearCart();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCompleteSale = async (notes: string, payments: any[]) => {
    if (cart.length === 0) return;
    try {
      // Append payment info to notes (as per original behavior)
      const notesWithPayments = notes + (payments.length ? ` | Payments: ${payments.map(p => `${p.method}:${p.amount}`).join(", ")}` : "");
      
      const order = await createSalesOrder({
        customer: selectedCustomer?.id ?? null,
        warehouse: selectedWarehouse.id,
        order_date: new Date().toISOString().split("T")[0],
        notes: notesWithPayments,
        line_items: cartToLineItems(cart),
        status: "CONFIRMED",
      });
      alert(`Order ${order.order_number} confirmed and stock reserved`);
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="flex h-full bg-background overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 border-r border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(["search", "held", "return"] as ActivePanel[]).map(p => (
              <button key={p} onClick={() => setActivePanel(p)} className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${activePanel === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {p === "held" ? `Held (${heldOrders.length})` : p}
              </button>
            ))}
          </div>
          <select value={selectedWarehouse?.id ?? ""} onChange={(e) => setSelectedWarehouse(warehouses.find(w => String(w.id) === e.target.value) ?? null)} className="bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none">
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
          </select>
        </div>
        {activePanel === "search" && <ProductSearchPanel onAddToCart={(v) => setCart(prev => {
          const idx = prev.findIndex(l => l.variant.id === v.id);
          if (idx >= 0) {
            const newCart = [...prev];
            newCart[idx] = { ...newCart[idx], qty: newCart[idx].qty + 1 };
            return newCart;
          }
          return [...prev, { variant: v, qty: 1, unitPrice: Number(v.selling_price), discountPct: 0, discountFixed: 0, taxRate: 0, notes: "" }];
        })} />}
        {activePanel === "held" && (
          <div className="p-4 space-y-3">
            {heldOrders.length === 0 ? <div className="text-center text-muted-foreground">No held orders</div> : heldOrders.map(h => (
              <div key={h.id} className="bg-card border rounded-xl p-4 flex justify-between">
                <div><p className="font-medium">{h.label}</p><p className="text-xs text-muted-foreground">{h.cart.length} items</p></div>
                <div className="flex gap-2">
                  <button onClick={() => resumeOrder(h)} className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs">Resume</button>
                  <button onClick={() => setHeldOrders(heldOrders.filter(x => x.id !== h.id))} className="px-3 py-1 bg-destructive/20 text-destructive rounded-lg text-xs">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {activePanel === "return" && <ReturnPanel api={api} queryClient={queryClient} warehouses={warehouses} />}
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
        isSubmitting={isCreatingOrder}
      />
    </div>
  );
}