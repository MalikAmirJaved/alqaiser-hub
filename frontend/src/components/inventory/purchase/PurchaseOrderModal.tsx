'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Info, Package, Building2, Monitor } from 'lucide-react';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useProducts } from '@/hooks/useProducts';
import { useAssets } from '@/hooks/useAssets';          // new import
import type { PurchaseOrder, PurchaseOrderPayload } from '@/types/purchase';
import { useCompanySettings } from "@/hooks/useCompanySettings";

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PurchaseOrderPayload) => Promise<void>;
  initialData?: PurchaseOrder;
  loading?: boolean;
}

interface LineItem {
  id: number;
  selectedId: string;      // generic: variant UUID or asset UUID
  quantity_ordered: number;
  unit_cost: number;
  tax_rate: number;
}

interface SelectOption {
  id: string;
  label: string;
  buying_price: number;
}

let _lineId = 1;
const nextLineId = () => _lineId++;

function emptyLine(): LineItem {
  return { id: nextLineId(), selectedId: '', quantity_ordered: 1, unit_cost: 0, tax_rate: 0 };
}

function fmtCurrency(n: number, currencySymbol = '$') {
  return `${currencySymbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PurchaseOrderModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  loading,
}: PurchaseOrderModalProps) {
  const { data: suppliers = [] } = useSuppliers();
  const { data: warehouses = [] } = useWarehouses();
  const { data: products = [] } = useProducts();
  const { data: assets = [] } = useAssets();     // fetch assets
  const { CurrencyCode } = useCompanySettings();

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [inventoryType, setInventoryType] = useState<'FOR_SALE' | 'OFFICE_INVENTORY'>('FOR_SALE');
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);

  // Build options based on inventory type
  const variantOptions = useMemo<SelectOption[]>(() => {
    if (inventoryType === 'FOR_SALE') {
      return products.flatMap((p) =>
        p.variants.map((v) => ({
          id: v.id,
          label: `${v.sku} — ${p.product_name}`,
          buying_price: v.buying_price || 0,
        }))
      );
    } else {
      // Office Inventory: use assets
      return assets.map((a) => ({
        id: a.id,
        label: `${a.name} ${a.brand ? `(${a.brand})` : ''} ${a.serial_number ? `- SN: ${a.serial_number}` : ''}`,
        buying_price: a.purchase_price || 0,
      }));
    }
  }, [inventoryType, products, assets]);

  // Populate when editing
  useEffect(() => {
    if (initialData) {
      setSupplierId(initialData.supplier ?? '');
      setWarehouseId(initialData.warehouse ?? '');
      setOrderDate(initialData.order_date?.slice(0, 10) ?? '');
      setExpectedDate(initialData.expected_delivery_date?.slice(0, 10) ?? '');
      setNotes(initialData.notes ?? '');
      setInventoryType(initialData.inventory_type ?? 'FOR_SALE');
      setLineItems(
        initialData.lines?.map((l) => ({
          id: nextLineId(),
          selectedId: l.variant || l.asset || '',  // use whichever exists
          quantity_ordered: l.quantity_ordered,
          unit_cost: l.unit_cost,
          tax_rate: l.tax_rate,
        })) ?? [emptyLine()]
      );
    }
  }, [initialData]);

  const { subtotal, totalTax, grandTotal } = useMemo(() => {
    let sub = 0;
    let tax = 0;
    lineItems.forEach((l) => {
      const lineAmt = l.quantity_ordered * l.unit_cost;
      sub += lineAmt;
      tax += lineAmt * (l.tax_rate / 100);
    });
    return { subtotal: sub, totalTax: tax, grandTotal: sub + tax };
  }, [lineItems]);

  const updateLine = <K extends keyof LineItem>(id: number, field: K, value: LineItem[K]) => {
    setLineItems((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const handleSelectChange = (id: number, selectedId: string) => {
    const selected = variantOptions.find(opt => opt.id === selectedId);
    updateLine(id, 'selectedId', selectedId as any);
    if (selected && selected.buying_price > 0) {
      updateLine(id, 'unit_cost', selected.buying_price as any);
    }
  };

  const addLine = () => setLineItems((prev) => [...prev, emptyLine()]);
  const removeLine = (id: number) =>
    setLineItems((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: PurchaseOrderPayload = {
      supplier: supplierId,
      warehouse: warehouseId,
      inventory_type: inventoryType,
      order_date: orderDate || undefined,
      expected_delivery_date: expectedDate || undefined,
      notes: notes || undefined,
      line_items: lineItems
        .filter((l) => l.selectedId)
        .map(({ selectedId, quantity_ordered, unit_cost, tax_rate }) => ({
          ...(inventoryType === 'FOR_SALE' ? { variant: selectedId } : { asset: selectedId }),
          quantity_ordered: Number(quantity_ordered),
          unit_cost: Number(unit_cost),
          tax_rate: Number(tax_rate),
        })),
    };
    await onSubmit(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-medium">
              {initialData ? 'Edit Purchase Order' : 'New Purchase Order'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {initialData
                ? `Editing ${initialData.order_number}`
                : 'Order will be saved as Draft'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* Order details section */}
            <section>
              <SectionLabel>Order details</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Supplier" required>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    required
                    className="field-input"
                  >
                    <option value="">Select supplier…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Destination warehouse" required>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    required
                    className="field-input"
                  >
                    <option value="">Select warehouse…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Order date">
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="field-input"
                  />
                </Field>

                <Field label="Expected delivery">
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="field-input"
                  />
                </Field>

                {/* Inventory Type field */}
                <Field label="Inventory Type" required className="col-span-2">
                  <div className="flex gap-4 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="inventoryType"
                        value="FOR_SALE"
                        checked={inventoryType === 'FOR_SALE'}
                        onChange={() => setInventoryType('FOR_SALE')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">For Sale (Stock)</span>
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="inventoryType"
                        value="OFFICE_INVENTORY"
                        checked={inventoryType === 'OFFICE_INVENTORY'}
                        onChange={() => setInventoryType('OFFICE_INVENTORY')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Office Inventory (Asset)</span>
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </label>
                  </div>
                  {inventoryType === 'OFFICE_INVENTORY' && (
                    <p className="text-xs text-info mt-2">
                      Office inventory will be added to HR Assets and Finance Expenses automatically upon receipt.
                      No stock quantity will be tracked in inventory.
                    </p>
                  )}
                </Field>
              </div>

              <Field label="Notes" className="mt-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes for this order…"
                  className="field-input resize-none"
                />
              </Field>
            </section>

            {/* Line items section */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel className="mb-0">Line items</SectionLabel>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add item
                </button>
              </div>

              {lineItems.length === 0 ? (
                <EmptyLines />
              ) : (
                <div className="space-y-2">
                  {/* Column labels */}
                  <div className="grid gap-2 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                    style={{ gridTemplateColumns: '1fr 72px 100px 80px 28px' }}
                  >
                    <span>{inventoryType === 'FOR_SALE' ? 'Variant / SKU' : 'Asset'}</span>
                    <span>Qty</span>
                    <span>Unit cost</span>
                    <span>Tax %</span>
                    <span />
                  </div>

                  {lineItems.map((line) => (
                    <LineRow
                      key={line.id}
                      line={line}
                      options={variantOptions}
                      onSelectChange={handleSelectChange}
                      onChange={updateLine}
                      onRemove={() => removeLine(line.id)}
                      canRemove={lineItems.length > 1}
                      currencySymbol={CurrencyCode()}
                      placeholder={inventoryType === 'FOR_SALE' ? "Select variant…" : "Select asset…"}
                    />
                  ))}
                </div>
              )}

              {/* Order summary */}
              {lineItems.some((l) => l.selectedId && l.quantity_ordered > 0) && (
                <div className="mt-4 bg-muted/40 rounded-lg px-4 py-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{fmtCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Est. tax</span>
                    <span>{fmtCurrency(totalTax)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-base pt-2 border-t border-border">
                    <span>Order total</span>
                    <span>{fmtCurrency(grandTotal)}</span>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted/30 flex-shrink-0">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5" />
              Saved as Draft — confirm after review
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-85 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Saving…' : initialData ? 'Update Order' : 'Create Order'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <style>{`
        .field-input {
          width: 100%;
          padding: 7px 10px;
          font-size: 13px;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          background: var(--color-background);
          color: var(--color-foreground);
          outline: none;
          font-family: inherit;
          transition: border-color 0.15s;
        }
        .field-input:focus {
          border-color: var(--color-ring);
        }
        .field-input::placeholder {
          color: var(--color-muted-foreground);
        }
        .field-input:disabled {
          background: var(--color-muted);
          opacity: 0.7;
          cursor: not-allowed;
        }
        select.field-input {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          background-size: 14px;
          padding-right: 32px;
          appearance: none;
        }
        input[type="date"].field-input,
        input[type="datetime-local"].field-input {
          color-scheme: dark;
        }
      `}</style>
    </div>
  );
}

// Sub-components (unchanged except LineRow accepts dynamic options)
function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-3 pb-2 border-b border-border ${className}`}>
      {children}
    </p>
  );
}

function Field({ label, required, children, className = '' }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function EmptyLines() {
  return (
    <div className="border border-dashed border-border rounded-lg py-10 text-center text-muted-foreground">
      <div className="text-3xl mb-2">📦</div>
      <p className="text-sm">No items added yet</p>
      <p className="text-xs mt-1 text-muted-foreground/60">Click "Add item" to start building your order</p>
    </div>
  );
}

function LineRow({
  line,
  options,
  onSelectChange,
  onChange,
  onRemove,
  canRemove,
  currencySymbol,
  placeholder,
}: {
  line: LineItem;
  options: SelectOption[];
  onSelectChange: (id: number, selectedId: string) => void;
  onChange: <K extends keyof LineItem>(id: number, field: K, value: LineItem[K]) => void;
  onRemove: () => void;
  canRemove: boolean;
  currencySymbol: string;
  placeholder: string;
}) {
  return (
    <div
      className="grid gap-2 items-center bg-muted/30 border border-border rounded-lg px-3 py-2.5"
      style={{ gridTemplateColumns: '1fr 72px 100px 80px 28px' }}
    >
      <select
        value={line.selectedId}
        onChange={(e) => onSelectChange(line.id, e.target.value)}
        required
        className="field-input text-xs"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>

      <input
        type="number"
        min="1"
        value={line.quantity_ordered}
        onChange={(e) => onChange(line.id, 'quantity_ordered', parseInt(e.target.value) || 0)}
        className="field-input text-xs text-right tabular-nums"
      />

      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{currencySymbol}</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={line.unit_cost}
          onChange={(e) => onChange(line.id, 'unit_cost', parseFloat(e.target.value) || 0)}
          className="field-input text-xs text-right tabular-nums pl-5"
        />
      </div>

      <div className="relative">
        <input
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={line.tax_rate}
          onChange={(e) => onChange(line.id, 'tax_rate', parseFloat(e.target.value) || 0)}
          className="field-input text-xs text-right tabular-nums pr-5"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        title="Remove line"
        className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-30 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}