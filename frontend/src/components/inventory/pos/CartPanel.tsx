// src/components/inventory/pos/CartPanel.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { useCustomers, useCreateCustomer } from "@/hooks/useCustomers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { CartLine, fmt, cartTotal, cartSubtotal, cartTax } from "@/lib/utils";
import { CartLineItem } from "./CartLineItem";

interface CartPanelProps {
  cart: CartLine[];
  onUpdateCart: (newCart: CartLine[]) => void;
  onClearCart: () => void;
  selectedCustomer: any;
  onSelectCustomer: (customer: any) => void;
  selectedWarehouse: any;
  onSelectWarehouse: (warehouse: any) => void;
  warehouses: any[];
  onSaveDraft: (notes: string) => Promise<void>;
  onCompleteSale: (notes: string, payments: any[]) => Promise<void>;
  isSubmitting?: boolean;
}

export function CartPanel({
  cart,
  onUpdateCart,
  onClearCart,
  selectedCustomer,
  onSelectCustomer,
  selectedWarehouse,
  onSelectWarehouse,
  warehouses,
  onSaveDraft,
  onCompleteSale,
  isSubmitting,
}: CartPanelProps) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDD, setShowCustomerDD] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [payments, setPayments] = useState<{ method: string; amount: number }[]>([]);
  const [newPaymentAmt, setNewPaymentAmt] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState<"CASH" | "CARD" | "CREDIT">("CASH");
  const [globalDiscMode, setGlobalDiscMode] = useState<"pct" | "fixed">("pct");
  const [globalDisc, setGlobalDisc] = useState(0);
  const [expandedLine, setExpandedLine] = useState<number | null>(null);

  const { data: customers = [] } = useCustomers(customerSearch || undefined);
  const createCustomer = useCreateCustomer();
  const customerRef = useRef<HTMLDivElement>(null);

  // Apply global discount to cart lines
  const effectiveCart = cart.map((l) => {
    if (globalDisc <= 0) return l;
    if (globalDiscMode === "pct") return { ...l, discountPct: globalDisc, discountFixed: 0 };
    const base = l.qty * l.unitPrice;
    const total = cart.reduce((s, x) => s + x.qty * x.unitPrice, 0);
    const share = total > 0 ? (base / total) * globalDisc : 0;
    return { ...l, discountFixed: share, discountPct: 0 };
  });

  const total = cartTotal(effectiveCart);
  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - paidSoFar);

  const updateLine = (idx: number, patch: Partial<CartLine>) => {
    const newCart = [...cart];
    newCart[idx] = { ...newCart[idx], ...patch };
    onUpdateCart(newCart);
  };

  const removeLine = (idx: number) => {
    onUpdateCart(cart.filter((_, i) => i !== idx));
  };

  const addPayment = () => {
    const amt = parseFloat(newPaymentAmt);
    if (!amt || amt <= 0) return;
    setPayments([...payments, { method: newPaymentMethod, amount: amt }]);
    setNewPaymentAmt("");
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) return;
    try {
      const newCust = await createCustomer.mutateAsync({
        name: newCustomerName,
        email: newCustomerEmail,
        phone: newCustomerPhone,
      });
      onSelectCustomer(newCust);
      setShowNewCustomerForm(false);
      setNewCustomerName("");
      setNewCustomerEmail("");
      setNewCustomerPhone("");
      setCustomerSearch("");
    } catch (err) {
      alert("Failed to create customer");
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setShowCustomerDD(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Customer selector */}
      <div className="px-4 pt-4 pb-3 border-b border-border" ref={customerRef}>
        <div className="relative">
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 cursor-text" onClick={() => setShowCustomerDD(true)}>
            <UserIcon />
            <input
              value={selectedCustomer ? selectedCustomer.name : customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); onSelectCustomer(null); setShowCustomerDD(true); setShowNewCustomerForm(false); }}
              placeholder="Walk-in customer / search…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onFocus={() => setShowCustomerDD(true)}
            />
            {selectedCustomer && (
              <button onClick={(e) => { e.stopPropagation(); onSelectCustomer(null); setCustomerSearch(""); }} className="text-muted-foreground hover:text-foreground">
                <XIcon size={13} />
              </button>
            )}
          </div>
          {showCustomerDD && (
            <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
              {!showNewCustomerForm ? (
                <>
                  {customers.length === 0 && customerSearch ? (
                    <button
                      onClick={() => setShowNewCustomerForm(true)}
                      className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent"
                    >
                      + Create "{customerSearch}"
                    </button>
                  ) : (
                    customers.slice(0, 10).map((c) => (
                      <button
                        key={c.id}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-left"
                        onClick={() => { onSelectCustomer(c); setCustomerSearch(""); setShowCustomerDD(false); }}
                      >
                        <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.phone || c.email}</p>
                        </div>
                      </button>
                    ))
                  )}
                </>
              ) : (
                <div className="p-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Name *"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none"
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none"
                  />
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setShowNewCustomerForm(false)} className="flex-1 py-2 rounded-lg border border-border text-sm">Cancel</button>
                    <button onClick={handleCreateCustomer} disabled={createCustomer.isPending} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Create</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cart lines */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-8">
            <CartIcon />
            <p className="text-sm text-center">Cart is empty.<br />Search for products to add.</p>
          </div>
        ) : (
          cart.map((line, idx) => (
            <CartLineItem
              key={`${line.variant.id}-${idx}`}
              line={line}
              idx={idx}
              effectiveLine={effectiveCart[idx]}
              expanded={expandedLine === idx}
              onToggleExpand={() => setExpandedLine(expandedLine === idx ? null : idx)}
              onUpdate={(patch) => updateLine(idx, patch)}
              onRemove={() => removeLine(idx)}
            />
          ))
        )}
      </div>

      {/* Order discount */}
      {cart.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <TagIcon />
            <span className="text-xs text-muted-foreground font-medium">Order Discount</span>
            <div className="flex-1" />
            <div className="flex gap-1 bg-muted rounded-md p-0.5">
              {(["pct", "fixed"] as const).map((m) => (
                <button key={m} onClick={() => setGlobalDiscMode(m)} className={`px-2 py-0.5 rounded text-xs transition-colors ${globalDiscMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {m === "pct" ? "%" : "#"}
                </button>
              ))}
            </div>
            <input type="number" min={0} value={globalDisc || ""} onChange={(e) => setGlobalDisc(Number(e.target.value))} placeholder="0" className="w-20 bg-muted rounded-md px-2 py-1 text-xs text-right outline-none focus:ring-1 ring-primary" />
          </div>
        </div>
      )}

      {/* Totals */}
      {cart.length > 0 && (
        <div className="px-4 py-3 border-t border-border space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span><span>{fmt(cartSubtotal(effectiveCart))}</span>
          </div>
          {cartTax(effectiveCart) > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tax</span><span>{fmt(cartTax(effectiveCart))}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold pt-1 border-t border-border">
            <span>Total</span><span>{fmt(total)}</span>
          </div>
        </div>
      )}

      {/* Payment & Actions */}
      {cart.length > 0 && (
        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border">
          <textarea
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="Order notes…"
            rows={2}
            className="w-full bg-muted rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 ring-primary resize-none"
          />

          {/* Payment section (only for complete sale) */}
          <div className="space-y-2">
            <div className="flex gap-1">
              {(["CASH", "CARD", "CREDIT"] as const).map((m) => (
                <button key={m} onClick={() => setNewPaymentMethod(m)} className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 border ${newPaymentMethod === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                  {m}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="number" value={newPaymentAmt} onChange={(e) => setNewPaymentAmt(e.target.value)} placeholder="Amount" onKeyDown={(e) => e.key === "Enter" && addPayment()} className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none" />
              <button onClick={() => setNewPaymentAmt(fmt(remaining))} className="px-2 py-2 bg-muted rounded-lg text-xs">Exact</button>
              <button onClick={addPayment} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">Add</button>
            </div>
            {payments.length > 0 && (
              <div className="space-y-1">
                {payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{p.method}</span>
                    <span>{fmt(p.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-medium">
                  <span>Remaining</span><span className={remaining > 0 ? "text-destructive" : "text-success"}>{fmt(remaining)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button onClick={onClearCart} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted">Clear</button>
            <button onClick={() => onSaveDraft(orderNotes)} className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80">Save Draft</button>
            <button onClick={() => onCompleteSale(orderNotes, payments)} className="flex-1 py-2.5 rounded-xl bg-success text-success-foreground text-sm font-medium hover:opacity-90">Complete Sale</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function UserIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>; }
function XIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function CartIcon() { return <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>; }
function TagIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>; }