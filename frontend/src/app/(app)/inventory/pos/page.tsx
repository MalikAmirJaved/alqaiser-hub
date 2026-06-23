// src/app/(app)/inventory/pos/page.tsx
"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/usePagination";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import { apiFetch } from "@/lib/api";
import { useCompanySettingsQuery } from "@/hooks/useCompanySettings";
import { useTermsAndConditions } from "@/hooks/useTermsAndConditions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { PrintPreviewModal, type QuoteInvoiceData, type DocCompany } from "@/components/common/QuoteInvoiceDocument";
import { ProductSearchPanel } from "@/components/inventory/pos/ProductSearchPanel";
import { CartPanel } from "@/components/inventory/pos/CartPanel";
import { ReturnPanel } from "@/components/inventory/pos/ReturnPanel";
import { SalesListPanel } from "@/components/inventory/pos/SalesListPanel";
import ThermalReceiptModal, { type ThermalReceiptData, printThermalReceipt } from "@/components/inventory/pos/ThermalReceiptModal";
import type { PosVariant } from "@/hooks/usePosCatalog";
import { debounce } from "lodash";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ActivePanel = "search" | "held" | "return" | "sales";

export default function SalesPage() {
  const permissions = useFeaturePermissions("INVENTORY", "sales_order");
  const formatCurrency = useFormatCurrency();
  const queryClient = useQueryClient();
  const { data: warehouses = [] } = useWarehouses({ is_active: true });
  const { data: draftOrders = [], refetch: refetchDrafts } = useDraftSalesOrders();
  const { mutateAsync: createSalesOrder, isPending: isCreatingOrder } = useCreateSalesOrder();
  const { mutateAsync: completeOrder, isPending: isCompleting } = useCompleteSalesOrder();
  const { mutateAsync: cancelOrder, isPending: isCancelling } = useCancelSalesOrder();
  const { mutateAsync: updateSalesOrder } = useUpdateSalesOrder();
  const { data: companySettings } = useCompanySettingsQuery();
  const { terms: termsData } = useTermsAndConditions();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>("search");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState("");
  const [invoiceModalProps, setInvoiceModalProps] = useState<{ open: boolean; data: QuoteInvoiceData | null }>({ open: false, data: null });
  const [thermalReceiptData, setThermalReceiptData] = useState<ThermalReceiptData | null>(null);
  const [thermalModalOpen, setThermalModalOpen] = useState(false);
  const heldPagination = usePagination();

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

  // Default: "All" stations (null = show products across all warehouses)
  useEffect(() => {
    if (warehouses.length > 0 && selectedWarehouse === undefined) {
      setSelectedWarehouse(null);
    }
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

  // Build thermal receipt data from cart
  const buildThermalReceipt = useCallback((
    finalCart: CartLine[],
    totalAmount: number,
    orderNumber: string,
  ): ThermalReceiptData => {
    const now = new Date();
    return {
      orderNumber,
      date: now.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      customerName: selectedCustomer?.name,
      lines: finalCart.map((line) => ({
        variant_name: line.variant.product_name || line.variant.sku || "Product",
        variant_sku: line.variant.sku,
        quantity: line.qty,
        unit_price: line.unitPrice,
        total: line.qty * line.unitPrice,
      })),
      totalAmount,
    };
  }, [selectedCustomer]);

  // Show thermal receipt popup
  const showThermalReceipt = useCallback((data: ThermalReceiptData) => {
    setThermalReceiptData(data);
    setThermalModalOpen(true);
  }, []);

  // Thermal print for cart (pre-sale) - shows preview
  const handleCartThermalPrint = useCallback(() => {
    if (cart.length === 0) return;
    const orderNumber = `TEMP-${Date.now()}`;
    const data = buildThermalReceipt(cart, 0, orderNumber);
    // Calculate total using cart values
    const total = cart.reduce((sum, l) => sum + (l.qty * l.unitPrice - (l.discountFixed > 0 ? l.discountFixed : (l.qty * l.unitPrice * l.discountPct / 100))), 0);
    data.totalAmount = total;
    showThermalReceipt(data);
  }, [cart, buildThermalReceipt, showThermalReceipt]);

const handleCompleteSale = useCallback(async (notes: string, payments: any[], overrideCart?: CartLine[], createInvoice?: boolean) => {
  const finalCart = overrideCart || cart;
  if (finalCart.length === 0) return;
  
  const customerId = selectedCustomer?.id ?? null;
  const warehouseId = selectedWarehouse?.id;
  
  const notesWithPayments = notes + (payments.length ? ` | Payments: ${payments.map(p => `${p.method}:${p.amount}`).join(", ")}` : "");
  try {
    let result: any;
    if (activeDraftId) {
      const updatedLineItems = cartToLineItems(finalCart);
      result = await completeOrder({ orderId: activeDraftId, line_items: updatedLineItems, create_invoice: createInvoice });
    } else {
      result = await createSalesOrder({
        customer: customerId,
        warehouse: warehouseId,
        order_date: new Date().toISOString().split("T")[0],
        notes: notesWithPayments,
        line_items: cartToLineItems(finalCart),
        status: "COMPLETE",
        create_invoice: createInvoice,
      });
    }
    
    const orderNumber = result?.data?.order_number || result?.order_number || "";
    const totalAmount = result?.data?.total_amount || finalCart.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    
    clearCart();
    refetchDrafts();
    await queryClient.refetchQueries({ queryKey: ["inventory_variant"] });
    await queryClient.refetchQueries({ queryKey: ["batchStock"] });
    queryClient.invalidateQueries({ queryKey: ["inventory_sales_order"] });
    
    // Auto-show thermal receipt popup
    const receiptData = buildThermalReceipt(finalCart, totalAmount, orderNumber);
    showThermalReceipt(receiptData);
    
    // If invoice was created, also show the A4 print modal
    const invoiceId = result?.data?.invoice_id || result?.invoice_id;
    if (createInvoice && invoiceId) {
      try {
        const invoiceData = await queryClient.fetchQuery<any>({
          queryKey: ["finance_customer_invoices", invoiceId],
          queryFn: () => apiFetch(`/api/finance/customer-invoices/${invoiceId}/`),
          staleTime: 0,
        });
        
        const company = companySettings;
        const docCompany: DocCompany = {
          companyName: company?.companyName || "",
          address: company?.address || "",
          city: company?.city || "",
          state: company?.state || "",
          country: company?.country || "",
          phone: company?.phone || "",
          email: company?.email || "",
          taxId: company?.taxId || "",
          logo: "",
          logoUrl: "",
        };
        
        const docData: QuoteInvoiceData = {
          type: "INVOICE",
          documentNumber: invoiceData?.invoice_number || "",
          date: invoiceData?.invoice_date || new Date().toISOString().split("T")[0],
          dueDate: invoiceData?.due_date || "",
          customerName: selectedCustomer?.name || invoiceData?.customer_name || "",
          customerEmail: selectedCustomer?.email || invoiceData?.customer_email || "",
          customerPhone: selectedCustomer?.phone || invoiceData?.customer_phone || "",
          lines: (invoiceData?.lines || []).map((l: any) => ({
            variant_name: l.variant_name || "Product",
            variant_sku: l.variant_sku || "",
            quantity: l.quantity,
            unit_price: Number(l.unit_price),
            tax_rate: Number(l.tax_rate),
            discount_amount: Number(l.discount_amount || 0),
          })),
          totalAmount: Number(invoiceData?.amount || 0),
          status: invoiceData?.status || "DRAFT",
          paymentStatus: invoiceData?.payment_status || "",
          notes: invoiceData?.notes || "",
        };
        
        setInvoiceModalProps({ open: true, data: docData });
      } catch (err) {
        console.error("Failed to load invoice for preview:", err);
      }
    }
  } catch (err: any) {
    console.error(err);
  }
}, [cart, activeDraftId, selectedCustomer, selectedWarehouse, createSalesOrder, completeOrder, clearCart, refetchDrafts, queryClient, companySettings, formatCurrency, buildThermalReceipt, showThermalReceipt]);

  const handleSaveDraft = useCallback(async (notes: string, overrideCart?: CartLine[]) => {
    const finalCart = overrideCart || cart;
    if (finalCart.length === 0) return;
    try {
      if (activeDraftId) {
        return;
      }
      if (!selectedWarehouse) {
        alert("Please select a station before saving a draft.");
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

          <Select
            value={selectedWarehouse?.id ? String(selectedWarehouse.id) : "all"}
            onValueChange={(val) => {
              if (val === "all") {
                setSelectedWarehouse(null);
              } else {
                setSelectedWarehouse(warehouses.find(w => String(w.id) === val) ?? null);
              }
            }}
          >
            <SelectTrigger className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-2 border border-border/50 hover:bg-muted/60 transition-colors cursor-pointer group !h-auto w-auto data-[placeholder]:text-muted-foreground focus:ring-0 focus:ring-offset-0 shadow-none">
              <WarehouseIcon className="text-muted-foreground group-hover:text-primary transition-colors" />
              <div className="flex flex-col items-start">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Station</span>
                <SelectValue placeholder="Select station" className="text-xs font-black" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold text-primary">
                <div className="flex items-center gap-2">
                  <GlobeIcon size={14} />
                  <span>All Stations</span>
                </div>
              </SelectItem>
              {warehouses.map(w => (
                <SelectItem key={w.id} value={String(w.id)}>
                  {w.warehouse_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dynamic Content Panel */}
        <div className="flex-1 h-full overflow-hidden relative">
          <div className="absolute inset-0 overflow-y-auto">
            {activePanel === "search" && (
              <ProductSearchPanel
                onAddToCart={(v: PosVariant & { product_name: string; product_id: string }) => {
                  const availableStock = v.stock.available;
                  
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
                  <>
                    {(() => {
                      const totalDraftPages = Math.max(1, Math.ceil(draftOrders.length / heldPagination.pageSize));
                      const safeDraftPage = Math.min(heldPagination.page, totalDraftPages);
                      const paginatedDrafts = draftOrders.slice(
                        (safeDraftPage - 1) * heldPagination.pageSize,
                        safeDraftPage * heldPagination.pageSize,
                      );
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {paginatedDrafts.map(order => (
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
                      );
                    })()}
                    {draftOrders.length > heldPagination.pageSize && (
                      <div className="flex items-center justify-between px-3 py-2 border border-border/60 bg-muted/10 rounded-lg">
                        <span className="text-xs text-muted-foreground font-medium">
                          {(Math.min(heldPagination.page, Math.max(1, Math.ceil(draftOrders.length / heldPagination.pageSize))) - 1) * heldPagination.pageSize + 1}-
                          {Math.min(heldPagination.page * heldPagination.pageSize, draftOrders.length)} of{" "}
                          {draftOrders.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={heldPagination.prevPage}
                            disabled={heldPagination.page <= 1}
                            className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors text-muted-foreground"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={heldPagination.nextPage}
                            disabled={heldPagination.page >= Math.max(1, Math.ceil(draftOrders.length / heldPagination.pageSize))}
                            className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors text-muted-foreground"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
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
          onThermalPrint={handleCartThermalPrint}
          onCartChange={handleCartChange}
          isSubmitting={isCreatingOrder || isCompleting}
          activeDraftId={activeDraftId}
          canCreate={permissions.create}
          canUpdate={permissions.update}
        />
      </div>

      {/* Invoice Print Modal (A4) */}
      {invoiceModalProps.data && (
        <PrintPreviewModal
          open={invoiceModalProps.open}
          onClose={() => setInvoiceModalProps({ open: false, data: null })}
          documentProps={{
            data: invoiceModalProps.data,
            company: {
              companyName: companySettings?.companyName || "",
              address: companySettings?.address || "",
              city: companySettings?.city || "",
              state: companySettings?.state || "",
              country: companySettings?.country || "",
              phone: companySettings?.phone || "",
              email: companySettings?.email || "",
              taxId: companySettings?.taxId || "",
              logo: "",
              logoUrl: "",
            },
            termsContent: termsData?.invoice || "",
            formatCurrency,
          }}
        />
      )}

      {/* Thermal Receipt Modal */}
      {thermalReceiptData && (
        <ThermalReceiptModal
          open={thermalModalOpen}
          onClose={() => setThermalModalOpen(false)}
          data={thermalReceiptData}
          companyName={companySettings?.companyName || "Store"}
          formatCurrency={formatCurrency}
        />
      )}
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

function GlobeIcon({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>;
}

function XIcon({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>;
}
