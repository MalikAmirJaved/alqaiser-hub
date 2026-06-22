'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Plus, Trash2, Info, Package, Building2, Check, Layers,
  ChevronDown, ShoppingCart, Warehouse, CalendarDays, FileText,
  Tag, AlertCircle,
} from 'lucide-react';
import { useSuppliers, useCreateSupplier } from '@/hooks/useSuppliers';
import { useWarehouses, useCreateWarehouse } from '@/hooks/useWarehouses';
import { useProducts, useCreateProduct, useUpdateProduct } from '@/hooks/useProducts';
import { useAssets, useCreateAsset } from '@/hooks/useAssets';
import type { PurchaseOrder, PurchaseOrderPayload } from '@/types/purchase';
import type { Product, ProductVariant, ProductPayload } from '@/hooks/useProducts';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { toast } from 'sonner';
import SearchableSelect from '@/components/reuseable/SearchableSelect';
import ProductForm from '@/components/inventory/product/ProductForm';
import VariantCard from '@/components/inventory/product/VariantCard';
import { FormModal } from '@/components/inventory/supplier/FormModal';
import { WarehouseForm } from '@/components/inventory/warehouse/WarehouseForm';
import { AssetForm } from '@/components/HRAssets/AssetForm';
import { useAutoCode } from '@/hooks/useAutoCode';
import { useQueryClient } from '@tanstack/react-query';

/* ─── Types ─────────────────────────────────────────────── */
interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PurchaseOrderPayload) => Promise<void>;
  initialData?: PurchaseOrder;
  prefillFromRequest?: {
    id: string;
    asset: string;
    asset_name: string;
    quantity: number;
    under_date: string;
  } | null;
  loading?: boolean;
}

interface LineItem {
  id: number;
  selectedId: string;
  quantity_ordered: number;
  unit_cost: number;
  tax_rate: number;
}

interface SelectOption {
  id: string;
  label: string;
  buying_price: number;
}

type InventoryType = 'FOR_SALE' | 'OFFICE_INVENTORY';

interface VariantFormData {
  sku: string;
  variantTitle: string;
  barcode: string;
  sellingPrice: number;
  minStockLevel: number;
  maxStockLevel: number;
  attributes: { key: string; value: string }[];
}

/* ─── Helpers ────────────────────────────────────────────── */
let _lineId = 1;
const nextLineId = () => _lineId++;

function emptyLine(): LineItem {
  return { id: nextLineId(), selectedId: '', quantity_ordered: 1, unit_cost: 0, tax_rate: 0 };
}

function fmtCurrency(n: number, sym = '$') {
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const supplierFormFields = [
  { name: 'code', label: 'Code', type: 'code' as const, required: true, placeholder: 'e.g., SUP-001' },
  { name: 'name', label: 'Name', type: 'text' as const, required: true, placeholder: 'Company name' },
  { name: 'contact_person', label: 'Contact Person', type: 'text' as const, placeholder: 'Full name' },
  { name: 'email', label: 'Email', type: 'email' as const, placeholder: 'contact@company.com' },
  { name: 'phone', label: 'Phone', type: 'tel' as const, placeholder: '+1 234 567 8900' },
  { name: 'address_line', label: 'Address Line', type: 'textarea' as const, placeholder: 'Street address' },
  { name: 'location', label: 'Location', type: 'location-group' as const, fields: { country: 'country', state: 'state', city: 'city' } },
  { name: 'postal_code', label: 'Postal Code', type: 'text' as const, placeholder: 'Postal code' },
  {
    name: 'status',
    label: 'Status',
    type: 'select' as const,
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'suspended', label: 'Suspended' },
    ],
  },
];

/* ─── Main Modal ─────────────────────────────────────────── */
export function PurchaseOrderModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  prefillFromRequest,
  loading,
}: PurchaseOrderModalProps) {
  const { data: suppliers = [] } = useSuppliers({
  status: "active",
});
  const { data: warehouses = [] } = useWarehouses();
  const { data: products = [], refetch: refetchProducts } = useProducts();
  const { data: assets = [] } = useAssets();
  const { CurrencyCode } = useCompanySettings();
  const queryClient = useQueryClient();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const createSupplier = useCreateSupplier();
  const createWarehouse = useCreateWarehouse();
  const createAsset = useCreateAsset();
  const { generateCode: genSupplierCode } = useAutoCode('supplier');

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [inventoryType, setInventoryType] = useState<InventoryType>('FOR_SALE');
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantFormProductId, setVariantFormProductId] = useState<string | null>(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showWarehouseForm, setShowWarehouseForm] = useState(false);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [collapsedProductIds, setCollapsedProductIds] = useState<string[]>([]);

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedProductIds.includes(p.id)),
    [products, selectedProductIds],
  );

  const variantOptions = useMemo<SelectOption[]>(() => {
    if (inventoryType === 'FOR_SALE') {
      return products.flatMap((p) =>
        p.variants.map((v) => ({
          id: v.id,
          label: `${v.sku} — ${p.product_name}`,
          buying_price: v.buying_price || 0,
        })),
      );
    }
    return assets.map((a) => ({
      id: a.id,
      label: `${a.name}${a.brand ? ` (${a.brand})` : ''}${a.serial_number ? ` · SN: ${a.serial_number}` : ''}`,
      buying_price: a.purchase_price || 0,
    }));
  }, [inventoryType, products, assets]);

  const initialDerivedRef = useRef(false);

  useEffect(() => {
    if (initialData) {
      setSupplierId(initialData.supplier ?? '');
      setWarehouseId(initialData.warehouse ?? '');
      setOrderDate(initialData.order_date?.slice(0, 10) ?? '');
      setExpectedDate(initialData.expected_delivery_date?.slice(0, 10) ?? '');
      setNotes(initialData.notes ?? '');
      setInventoryType(initialData.inventory_type ?? 'FOR_SALE');
      const loaded: LineItem[] =
        initialData.lines?.map((l) => ({
          id: nextLineId(),
          selectedId: l.variant || l.asset || '',
          quantity_ordered: l.quantity_ordered,
          unit_cost: l.unit_cost,
          tax_rate: l.tax_rate,
        })) ?? [];
      setLineItems(loaded.length > 0 ? loaded : [emptyLine()]);
      initialDerivedRef.current = false;
    } else if (prefillFromRequest) {
      setSupplierId('');
      setWarehouseId('');
      setOrderDate(new Date().toISOString().slice(0, 10));
      setExpectedDate(prefillFromRequest.under_date || '');
      setNotes('');
      setInventoryType('OFFICE_INVENTORY');
      setLineItems([{
        id: nextLineId(),
        selectedId: prefillFromRequest.asset,
        quantity_ordered: prefillFromRequest.quantity,
        unit_cost: 0,
        tax_rate: 0,
      }]);
    } else {
      setSupplierId('');
      setWarehouseId('');
      setOrderDate(new Date().toISOString().slice(0, 10));
      setExpectedDate('');
      setNotes('');
      setInventoryType('FOR_SALE');
      setLineItems([emptyLine()]);
      setSelectedProductIds([]);
    }
  }, [initialData, prefillFromRequest]);

  useEffect(() => {
    if (!initialData || products.length === 0 || initialDerivedRef.current) return;
    initialDerivedRef.current = true;
    const pIds = new Set<string>();
    for (const line of initialData.lines || []) {
      if (!line.variant) continue;
      const p = products.find((prod) => prod.variants.some((v) => v.id === line.variant));
      if (p) pIds.add(p.id);
    }
    if (pIds.size > 0) setSelectedProductIds(Array.from(pIds));
  }, [initialData, products]);

  const handleTypeChange = (type: InventoryType) => {
    setInventoryType(type);
    setLineItems([emptyLine()]);
    setSelectedProductIds([]);
  };

  const handleAddProduct = (productId: string) => {
    if (!productId || selectedProductIds.includes(productId)) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setSelectedProductIds((prev) => [...prev, productId]);
    const newLines: LineItem[] = product.variants.map((v) => ({
      id: nextLineId(),
      selectedId: v.id,
      quantity_ordered: 1,
      unit_cost: v.buying_price || 0,
      tax_rate: 0,
    }));
    setLineItems((prev) => {
      const active = prev.filter((l) => l.selectedId);
      return active.length === 0 && newLines.length === 0 ? [emptyLine()] : [...active, ...newLines];
    });
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const variantIds = new Set(product.variants.map((v) => v.id));
    setLineItems((prev) => {
      const remaining = prev.filter((l) => !variantIds.has(l.selectedId));
      return remaining.length === 0 ? [emptyLine()] : remaining;
    });
  };

  const toggleCollapseProduct = (productId: string) => {
    setCollapsedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    );
  };

  const toggleVariant = (variantId: string) => {
    setLineItems((prev) => {
      const exists = prev.find((l) => l.selectedId === variantId);
      if (exists) {
        const next = prev.filter((l) => l.selectedId !== variantId);
        return next.length === 0 ? [emptyLine()] : next;
      }
      const variant = findVariant(variantId);
      if (!variant) return prev;
      const filtered = prev.filter((l) => l.selectedId !== '');
      return [...filtered, { id: nextLineId(), selectedId: variantId, quantity_ordered: 1, unit_cost: variant.buying_price || 0, tax_rate: 0 }];
    });
  };

  const findVariant = (variantId: string): ProductVariant | undefined => {
    for (const p of products) {
      const v = p.variants.find((v) => v.id === variantId);
      if (v) return v;
    }
  };

  const { subtotal, totalTax, grandTotal } = useMemo(() => {
    let sub = 0, tax = 0;
    lineItems.forEach((l) => {
      if (!l.selectedId) return;
      const amt = l.quantity_ordered * l.unit_cost;
      sub += amt;
      tax += amt * (l.tax_rate / 100);
    });
    return { subtotal: sub, totalTax: tax, grandTotal: sub + tax };
  }, [lineItems]);

  const updateLine = <K extends keyof LineItem>(id: number, field: K, value: LineItem[K]) => {
    setLineItems((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const handleSelectChange = (id: number, selectedId: string) => {
    const selected = variantOptions.find((opt) => opt.id === selectedId);
    updateLine(id, 'selectedId', selectedId as any);
    if (selected && selected.buying_price > 0) updateLine(id, 'unit_cost', selected.buying_price as any);
  };

  const addLine = () => setLineItems((prev) => [...prev, emptyLine()]);
  const removeLine = (id: number) =>
    setLineItems((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));

  const handleCreateProductSubmit = async (data: ProductPayload) => {
    const result = await createProduct.mutateAsync(data);
    setShowCreateProduct(false);
    await refetchProducts();
    setSelectedProductIds((prev) => [...prev, result.data.id]);
  };

  const handleCreateVariant = async (data: VariantFormData) => {
    if (!variantFormProductId) return;
    const product = products.find((p) => p.id === variantFormProductId);
    if (!product) return;
    const payload: ProductPayload = {
      productName: product.product_name,
      description: product.description,
      category: product.category_id,
      brand: product.brand_id,
      unit: product.unit,
      storageRequirement: product.storage_requirement,
      taxRate: product.tax_rate,
      status: product.status,
      is_active: product.is_active,
      variants: [
        ...product.variants.map((v) => ({
          id: v.id, sku: v.sku, variantTitle: v.variant_title, barcode: v.barcode,
          sellingPrice: v.selling_price, minStockLevel: v.min_stock_level, maxStockLevel: v.max_stock_level,
          attributes: v.variant_attributes?.map((a) => ({ key: a.attribute_key, value: a.attribute_value })),
        })),
        { sku: data.sku, variantTitle: data.variantTitle, barcode: data.barcode, sellingPrice: data.sellingPrice, minStockLevel: data.minStockLevel, maxStockLevel: data.maxStockLevel, attributes: data.attributes },
      ],
    };
    await updateProduct.mutateAsync({ id: variantFormProductId, ...payload });
    setShowVariantForm(false);
    setVariantFormProductId(null);
    await refetchProducts();
  };

  const handleCreateSupplier = async (data: any) => {
    await createSupplier.mutateAsync(data);
    setShowSupplierForm(false);
    await queryClient.invalidateQueries({ queryKey: ['inventory_supplier'] });
  };

  const handleCreateWarehouse = async (data: any) => {
    await createWarehouse.mutateAsync(data);
    setShowWarehouseForm(false);
    await queryClient.invalidateQueries({ queryKey: ['inventory_warehouse'] });
  };

  const handleCreateAsset = async (data: any) => {
    const finalDescription = data.category
      ? `Category: ${data.category}\n${data.description || ''}`
      : data.description || '';
    await createAsset.mutateAsync({
      name: data.name, brand: data.brand || undefined, serial_number: data.sku || undefined,
      description: finalDescription, is_active: true,
      purchase_date: new Date().toISOString().split('T')[0],
      purchase_price: 0, total_quantity: 1, available_quantity: 1,
    });
    setShowAssetForm(false);
    await queryClient.invalidateQueries({ queryKey: ['assets'] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedLines = lineItems.filter((l) => l.selectedId);
    if (selectedLines.length === 0) return void toast.error('Add at least one line item.');
    if (selectedLines.find((l) => l.unit_cost <= 0)) return void toast.error('Unit cost is required for every item.');
    const payload: PurchaseOrderPayload = {
      supplier: supplierId,
      ...(inventoryType === 'FOR_SALE' ? { warehouse: warehouseId } : {}),
      inventory_type: inventoryType,
      order_date: orderDate || undefined,
      expected_delivery_date: expectedDate || undefined,
      notes: notes || undefined,
      line_items: selectedLines.map(({ selectedId, quantity_ordered, unit_cost, tax_rate }) => ({
        ...(inventoryType === 'FOR_SALE' ? { variant: selectedId } : { asset: selectedId }),
        quantity_ordered: Number(quantity_ordered),
        unit_cost: Number(unit_cost),
        tax_rate: Number(tax_rate),
      })),
      request_ids: prefillFromRequest ? [prefillFromRequest.id] : undefined,
    };
    await onSubmit(payload);
  };

  if (!isOpen) return null;

  const activeLineIds = new Set(lineItems.filter((l) => l.selectedId).map((l) => l.selectedId));
  const sym = CurrencyCode();
  const hasLines = lineItems.some((l) => l.selectedId);

  return (
    <>
      <div className="po-overlay">
        <div className="po-modal">

          {/* ── Header ── */}
          <div className="po-header">
            <div className="po-header-left">
              <div className="po-header-icon">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h2 className="po-title">
                  {initialData ? 'Edit Purchase Order' : 'New Purchase Order'}
                </h2>
                <p className="po-subtitle">
                  {initialData ? `Editing ${initialData.order_number}` : 'Saved as draft — confirm after review'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="po-close-btn" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Body ── */}
          <form onSubmit={handleSubmit} className="po-body-form">
            <div className="po-scroll-area">

              {/* ── Step 1: Order Type ── */}
              <div className="po-section">
                <SectionHeader step={1} title="Order Type" />
                <div className="po-type-grid">
                  <TypeCard
                    value="FOR_SALE"
                    selected={inventoryType === 'FOR_SALE'}
                    onSelect={() => handleTypeChange('FOR_SALE')}
                    icon={<Package className="w-5 h-5 text-blue-500" />}
                    title="Stock for Sale"
                    description="Resale items — tracked in inventory"
                  />
                  <TypeCard
                    value="OFFICE_INVENTORY"
                    selected={inventoryType === 'OFFICE_INVENTORY'}
                    onSelect={() => handleTypeChange('OFFICE_INVENTORY')}
                    icon={<Building2 className="w-5 h-5 text-violet-500" />}
                    title="Office Asset"
                    description="Internal use — logged in HR Assets"
                  />
                </div>
                {inventoryType === 'OFFICE_INVENTORY' && (
                  <div className="po-info-banner">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    Added to HR Assets and Finance Expenses upon receipt
                  </div>
                )}
              </div>

              {/* ── Step 2: Order Details ── */}
              <div className="po-section">
                <SectionHeader step={2} title="Order Details" />
                <div className="po-fields-grid">
                  {/* Supplier */}
                  <FieldGroup label="Supplier" required icon={<Tag className="w-3.5 h-3.5" />}>
                    <div className="po-input-row">
                      <SearchableSelect
                        value={supplierId}
                        onChange={(val) => setSupplierId(val)}
                        options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                        placeholder="Select supplier…"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSupplierForm(true)}
                        className="po-add-btn"
                        title="Add new supplier"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </FieldGroup>

                  {/* Warehouse (FOR_SALE only) */}
                  {inventoryType === 'FOR_SALE' && (
                    <FieldGroup label="Destination Warehouse" required icon={<Warehouse className="w-3.5 h-3.5" />}>
                      <div className="po-input-row">
                        <SearchableSelect
                          value={warehouseId}
                          onChange={(val) => setWarehouseId(val)}
                          options={warehouses.map((w) => ({ value: w.id, label: w.warehouse_name }))}
                          placeholder="Select warehouse…"
                        />
                        <button
                          type="button"
                          onClick={() => setShowWarehouseForm(true)}
                          className="po-add-btn"
                          title="Add new warehouse"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </FieldGroup>
                  )}

                  {/* Dates */}
                  <FieldGroup label="Order Date" icon={<CalendarDays className="w-3.5 h-3.5" />}>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="po-input"
                    />
                  </FieldGroup>

                  <FieldGroup label="Expected Delivery" icon={<CalendarDays className="w-3.5 h-3.5" />}>
                    <input
                      type="date"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                      className="po-input"
                    />
                  </FieldGroup>
                </div>

                {/* Notes full width */}
                <div className="mt-3">
                  <FieldGroup label="Notes" icon={<FileText className="w-3.5 h-3.5" />}>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Any special instructions or delivery notes…"
                      className="po-input po-textarea"
                    />
                  </FieldGroup>
                </div>
              </div>

              {/* ── Step 3: Line Items ── */}
              <div className="po-section">
                <SectionHeader step={3} title="Line Items" />

                {inventoryType === 'FOR_SALE' ? (
                  <ProductVariantSelector
                    products={products}
                    selectedProducts={selectedProducts}
                    onAddProduct={handleAddProduct}
                    onRemoveProduct={handleRemoveProduct}
                    lineItems={lineItems}
                    activeLineIds={activeLineIds}
                    onToggleVariant={toggleVariant}
                    onUpdateLine={updateLine}
                    onRemoveLine={removeLine}
                    currencySymbol={sym}
                    onCreateProduct={() => setShowCreateProduct(true)}
                    onCreateVariant={(productId) => { setVariantFormProductId(productId); setShowVariantForm(true); }}
                    collapsedProductIds={collapsedProductIds}
                    onToggleCollapse={toggleCollapseProduct}
                  />
                ) : (
                  <AssetLineItems
                    lineItems={lineItems}
                    options={variantOptions}
                    onSelectChange={handleSelectChange}
                    onChange={updateLine}
                    onRemove={removeLine}
                    onAdd={addLine}
                    currencySymbol={sym}
                    onCreateAsset={() => setShowAssetForm(true)}
                  />
                )}

                {/* Order summary */}
                {hasLines && (
                  <div className="po-summary">
                    <div className="po-summary-row">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{fmtCurrency(subtotal, sym)}</span>
                    </div>
                    <div className="po-summary-row">
                      <span>Tax</span>
                      <span className="tabular-nums">{fmtCurrency(totalTax, sym)}</span>
                    </div>
                    <div className="po-summary-total">
                      <span>Total</span>
                      <span className="tabular-nums">{fmtCurrency(grandTotal, sym)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="po-footer">
              <p className="po-footer-hint">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Saved as draft until you confirm
              </p>
              <div className="po-footer-actions">
                <button type="button" onClick={onClose} className="po-btn-cancel">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="po-btn-submit">
                  {loading ? 'Saving…' : initialData ? 'Update Order' : 'Create Order'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* ── Inline Styles ── */}
        <style>{`
          /* Layout */
          .po-overlay {
            position: fixed; inset: 0; z-index: 50;
            display: flex; align-items: center; justify-content: center;
            padding: 1rem;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
          }
          .po-modal {
            background: var(--color-card);
            width: 100%; max-width: 780px;
            max-height: 92dvh;
            display: flex; flex-direction: column;
            border-radius: 14px;
            border: 1px solid var(--color-border);
            box-shadow: 0 24px 64px rgba(0,0,0,0.35);
            overflow: hidden;
          }

          /* Header */
          .po-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 20px;
            border-bottom: 1px solid var(--color-border);
            background: var(--color-card);
            flex-shrink: 0;
          }
          .po-header-left { display: flex; align-items: center; gap: 12px; }
          .po-header-icon {
            width: 34px; height: 34px; border-radius: 8px;
            background: var(--color-primary); color: var(--color-primary-foreground);
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          }
          .po-title { font-size: 15px; font-weight: 600; line-height: 1.3; }
          .po-subtitle { font-size: 12px; color: var(--color-muted-foreground); margin-top: 1px; }
          .po-close-btn {
            width: 30px; height: 30px; border-radius: 7px;
            border: 1px solid var(--color-border);
            background: transparent; color: var(--color-muted-foreground);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: background 0.15s, color 0.15s;
            flex-shrink: 0;
          }
          .po-close-btn:hover { background: var(--color-muted); color: var(--color-foreground); }

          /* Body */
          .po-body-form { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
          .po-scroll-area { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 0; }

          /* Sections */
          .po-section {
            padding-bottom: 20px;
            margin-bottom: 20px;
            border-bottom: 1px solid var(--color-border);
          }
          .po-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }

          /* Section Header with step number */
          .po-section-header {
            display: flex; align-items: center; gap: 10px;
            margin-bottom: 14px;
          }
          .po-step-badge {
            width: 22px; height: 22px; border-radius: 50%;
            background: var(--color-primary);
            color: var(--color-primary-foreground);
            font-size: 11px; font-weight: 700;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          }
          .po-section-title {
            font-size: 12px; font-weight: 600;
            text-transform: uppercase; letter-spacing: 0.06em;
            color: var(--color-foreground);
          }

          /* Type selector */
          .po-type-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
          }
          .po-type-card {
            display: flex; align-items: flex-start; gap: 12px;
            padding: 14px 16px;
            border: 2px solid var(--color-border);
            border-radius: 10px;
            cursor: pointer; transition: border-color 0.15s, background 0.15s;
            background: var(--color-background);
            text-align: left;
          }
          .po-type-card:hover { border-color: var(--color-border-strong); }
          .po-type-card.selected {
            border-color: var(--color-primary);
            background: color-mix(in oklab, var(--color-primary) 8%, var(--color-card));
          }
          .po-type-radio { display: none; }
          .po-type-check {
            width: 18px; height: 18px; border-radius: 50%;
            border: 2px solid var(--color-border);
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0; margin-top: 2px;
            transition: border-color 0.15s, background 0.15s;
          }
          .po-type-card.selected .po-type-check {
            border-color: var(--color-primary);
            background: var(--color-primary);
          }
          .po-type-icon { flex-shrink: 0; }
          .po-type-label { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
          .po-type-desc { font-size: 11px; color: var(--color-muted-foreground); line-height: 1.4; }

          /* Info banner */
          .po-info-banner {
            margin-top: 10px;
            display: flex; align-items: center; gap: 7px;
            padding: 8px 12px;
            background: color-mix(in oklab, var(--color-info) 10%, transparent);
            border: 1px solid color-mix(in oklab, var(--color-info) 25%, transparent);
            border-radius: 8px;
            font-size: 12px;
            color: var(--color-info);
          }

          /* Fields grid */
          .po-fields-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
          }

          /* Field group */
          .po-field-group { display: flex; flex-direction: column; gap: 5px; }
          .po-field-label {
            display: flex; align-items: center; gap: 5px;
            font-size: 11px; font-weight: 600;
            color: var(--color-muted-foreground);
            text-transform: uppercase; letter-spacing: 0.04em;
          }
          .po-field-label-icon { color: var(--color-muted-foreground); opacity: 0.7; }
          .po-required { color: #ef4444; margin-left: 1px; }

          /* Inputs */
          .po-input, .po-select {
            width: 100%;
            padding: 8px 11px;
            font-size: 13px;
            border: 1px solid var(--color-border);
            border-radius: 7px;
            background: var(--color-background);
            color: var(--color-foreground);
            outline: none;
            font-family: inherit;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          .po-input:focus, .po-select:focus {
            border-color: var(--color-ring);
            box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-ring) 15%, transparent);
          }
          .po-input::placeholder { color: var(--color-muted-foreground); opacity: 0.7; }
          .po-textarea { resize: none; min-height: 60px; }
          .po-select {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 10px center;
            background-size: 14px;
            padding-right: 34px;
            appearance: none;
          }
          input[type="date"].po-input { color-scheme: dark; }
          .po-input:disabled, .po-select:disabled {
            background: var(--color-muted); opacity: 0.6; cursor: not-allowed;
          }

          /* Input with add button */
          .po-input-row { display: flex; gap: 6px; }
          .po-input-row .po-select { flex: 1; }
          .po-add-btn {
            width: 36px; height: 36px; border-radius: 7px;
            border: 1px solid var(--color-border);
            background: var(--color-background);
            color: var(--color-muted-foreground);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
            flex-shrink: 0;
          }
          .po-add-btn:hover {
            background: var(--color-muted);
            color: var(--color-primary);
            border-color: var(--color-primary);
          }

          /* Line items */
          .po-line-header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 10px;
          }
          .po-line-hint { font-size: 12px; color: var(--color-muted-foreground); }
          .po-line-actions { display: flex; gap: 6px; }
          .po-btn-sm {
            display: inline-flex; align-items: center; gap: 5px;
            padding: 5px 10px; font-size: 12px; font-weight: 500;
            border: 1px solid var(--color-border); border-radius: 6px;
            color: var(--color-muted-foreground);
            background: transparent;
            cursor: pointer; transition: background 0.15s, color 0.15s;
          }
          .po-btn-sm:hover { background: var(--color-muted); color: var(--color-primary); }

          /* Asset rows */
          .po-asset-col-header {
            display: grid;
            grid-template-columns: 1fr 72px 104px 78px 32px;
            gap: 8px;
            padding: 0 4px;
            margin-bottom: 6px;
          }
          .po-asset-col-label {
            font-size: 10px; font-weight: 600; text-transform: uppercase;
            letter-spacing: 0.06em; color: var(--color-muted-foreground);
          }
          .po-asset-row {
            display: grid;
            grid-template-columns: 1fr 72px 104px 78px 32px;
            gap: 8px;
            align-items: center;
            background: var(--color-muted)/20;
            border: 1px solid var(--color-border);
            border-radius: 8px;
            padding: 8px 10px;
            margin-bottom: 6px;
          }
          .po-input-prefix {
            position: relative;
          }
          .po-prefix-sym {
            position: absolute; left: 9px; top: 50%; transform: translateY(-50%);
            font-size: 12px; color: var(--color-muted-foreground); pointer-events: none;
          }
          .po-input-prefix .po-input { padding-left: 20px; }
          .po-input-suffix { position: relative; }
          .po-suffix-sym {
            position: absolute; right: 9px; top: 50%; transform: translateY(-50%);
            font-size: 12px; color: var(--color-muted-foreground); pointer-events: none;
          }
          .po-input-suffix .po-input { padding-right: 22px; }

          .po-remove-btn {
            width: 28px; height: 28px; border-radius: 6px; border: none;
            background: transparent; color: var(--color-muted-foreground);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: background 0.15s, color 0.15s;
          }
          .po-remove-btn:hover { background: rgba(239,68,68,0.1); color: #ef4444; }
          .po-remove-btn:disabled { opacity: 0.3; pointer-events: none; }

          /* Empty state */
          .po-empty {
            border: 2px dashed var(--color-border);
            border-radius: 10px;
            padding: 36px 16px;
            text-align: center;
            color: var(--color-muted-foreground);
          }
          .po-empty-icon { margin: 0 auto 10px; opacity: 0.35; }
          .po-empty-title { font-size: 13px; font-weight: 500; margin-bottom: 4px; }
          .po-empty-sub { font-size: 12px; opacity: 0.7; }

          /* Product card */
          .po-product-card {
            border: 1px solid var(--color-border);
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 10px;
          }
          .po-product-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 14px;
            background: var(--color-muted)/30;
            cursor: pointer; user-select: none;
            gap: 8px;
          }
          .po-product-header:hover { background: var(--color-muted)/50; }
          .po-product-header-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
          .po-product-name { font-size: 13px; font-weight: 600; truncate; }
          .po-product-meta { font-size: 11px; color: var(--color-muted-foreground); white-space: nowrap; }
          .po-product-selected { color: var(--color-primary); font-weight: 600; }
          .po-product-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
          .po-product-action-btn {
            font-size: 11px; font-weight: 500; background: none; border: none;
            cursor: pointer; transition: color 0.15s; padding: 2px 0;
          }
          .po-product-action-btn.primary { color: var(--color-primary); }
          .po-product-action-btn.primary:hover { opacity: 0.75; }
          .po-product-action-btn.danger { color: var(--color-muted-foreground); }
          .po-product-action-btn.danger:hover { color: #ef4444; }

          /* Variant row */
          .po-variant-row {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 10px 14px;
            border-top: 1px solid var(--color-border);
            transition: background 0.12s;
          }
          .po-variant-row.active { background: color-mix(in oklab, var(--color-primary) 5%, transparent); }
          .po-variant-row:hover:not(.active) { background: var(--color-muted)/20; }
          .po-variant-checkbox {
            width: 18px; height: 18px; border-radius: 5px;
            border: 2px solid var(--color-border);
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0; margin-top: 2px; cursor: pointer;
            transition: border-color 0.15s, background 0.15s;
            background: transparent;
          }
          .po-variant-checkbox.checked {
            background: var(--color-primary);
            border-color: var(--color-primary);
            color: var(--color-primary-foreground);
          }
          .po-variant-sku {
            font-family: var(--font-mono); font-size: 11px;
            font-weight: 700; color: var(--color-foreground);
          }
          .po-variant-title { font-size: 12px; color: var(--color-muted-foreground); }
          .po-variant-attrs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
          .po-attr-chip {
            font-size: 10px; font-weight: 500;
            padding: 1px 6px; border-radius: 4px;
            background: var(--color-muted); color: var(--color-muted-foreground);
          }
          .po-variant-stats {
            display: flex; gap: 12px; margin-top: 4px;
            font-size: 11px; color: var(--color-muted-foreground);
          }
          .po-variant-inline-fields {
            display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
            margin-top: 10px; margin-left: 28px;
          }
          .po-inline-label {
            font-size: 10px; font-weight: 600;
            text-transform: uppercase; letter-spacing: 0.04em;
            color: var(--color-muted-foreground);
            margin-bottom: 3px;
          }

          /* Order summary */
          .po-summary {
            margin-top: 14px;
            border: 1px solid var(--color-border);
            border-radius: 10px;
            overflow: hidden;
          }
          .po-summary-row {
            display: flex; justify-content: space-between; align-items: center;
            padding: 9px 14px;
            font-size: 13px;
            color: var(--color-muted-foreground);
            border-bottom: 1px solid var(--color-border);
          }
          .po-summary-total {
            display: flex; justify-content: space-between; align-items: center;
            padding: 11px 14px;
            font-size: 14px; font-weight: 700;
            background: var(--color-muted)/30;
            color: var(--color-foreground);
          }

          /* Footer */
          .po-footer {
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 20px;
            border-top: 1px solid var(--color-border);
            background: var(--color-muted)/20;
            flex-shrink: 0;
            gap: 12px;
          }
          .po-footer-hint {
            display: flex; align-items: center; gap: 6px;
            font-size: 11px; color: var(--color-muted-foreground);
          }
          .po-footer-actions { display: flex; gap: 8px; flex-shrink: 0; }
          .po-btn-cancel {
            padding: 8px 16px; font-size: 13px; font-weight: 500;
            border: 1px solid var(--color-border); border-radius: 8px;
            color: var(--color-muted-foreground); background: transparent;
            cursor: pointer; transition: background 0.15s, color 0.15s;
          }
          .po-btn-cancel:hover { background: var(--color-muted); color: var(--color-foreground); }
          .po-btn-submit {
            padding: 8px 20px; font-size: 13px; font-weight: 600;
            border: none; border-radius: 8px;
            background: var(--color-primary); color: var(--color-primary-foreground);
            cursor: pointer; transition: opacity 0.15s;
          }
          .po-btn-submit:hover { opacity: 0.88; }
          .po-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

          /* ── Mobile ── */
          @media (max-width: 600px) {
            .po-overlay { padding: 0; align-items: flex-end; }
            .po-modal {
              max-width: 100%; border-radius: 16px 16px 0 0;
              max-height: 96dvh;
            }
            .po-type-grid { grid-template-columns: 1fr; }
            .po-fields-grid { grid-template-columns: 1fr; }
            .po-asset-col-header { display: none; }
            .po-asset-row {
              grid-template-columns: 1fr 1fr;
              grid-template-rows: auto auto;
            }
            .po-asset-row > .po-select { grid-column: 1 / -1; }
            .po-footer { flex-direction: column; align-items: stretch; }
            .po-footer-actions { justify-content: flex-end; }
            .po-footer-hint { display: none; }
            .po-variant-inline-fields { grid-template-columns: 1fr 1fr; }
          }
        `}</style>
      </div>

      {/* ── Sub-modals ── */}
      {showCreateProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-card rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <ProductForm onSubmit={handleCreateProductSubmit} isLoading={createProduct.isPending} isEditing={false} onCancel={() => setShowCreateProduct(false)} />
          </div>
        </div>
      )}
      {showVariantForm && variantFormProductId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-card rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <VariantCard standalone onSubmit={handleCreateVariant} onCancel={() => { setShowVariantForm(false); setVariantFormProductId(null); }} loading={updateProduct.isPending} />
          </div>
        </div>
      )}
      <FormModal open={showSupplierForm} onClose={() => setShowSupplierForm(false)} title="Add New Supplier" fields={supplierFormFields} initialData={{}} onSubmit={handleCreateSupplier} isSubmitting={createSupplier.isPending} onGenerateCode={genSupplierCode} />
      {showWarehouseForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border bg-background p-6 shadow-lg sm:rounded-lg">
            <div className="flex flex-col space-y-1.5 pb-4 border-b border-border mb-6">
              <h2 className="text-lg font-semibold">Add New Warehouse</h2>
              <p className="text-sm text-muted-foreground">Fields marked * are required.</p>
            </div>
            <WarehouseForm onSubmit={handleCreateWarehouse} onCancel={() => setShowWarehouseForm(false)} isLoading={createWarehouse.isPending} />
          </div>
        </div>
      )}
      {showAssetForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto border bg-background p-6 shadow-lg sm:rounded-lg">
            <div className="flex flex-col space-y-1.5 pb-4 border-b border-border mb-6">
              <h2 className="text-lg font-semibold">Add New Asset</h2>
              <p className="text-sm text-muted-foreground">Fields marked * are required.</p>
            </div>
            <AssetForm onSubmit={handleCreateAsset} onCancel={() => setShowAssetForm(false)} isLoading={createAsset.isPending} />
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Sub-components ──────────────────────────────────────── */

function SectionHeader({ step, title }: { step: number; title: string }) {
  return (
    <div className="po-section-header">
      <div className="po-step-badge">{step}</div>
      <span className="po-section-title">{title}</span>
    </div>
  );
}

function TypeCard({
  value, selected, onSelect, icon, title, description,
}: {
  value: string; selected: boolean; onSelect: () => void;
  icon: React.ReactNode; title: string; description: string;
}) {
  return (
    <label className={`po-type-card ${selected ? 'selected' : ''}`}>
      <input type="radio" name="inventoryType" value={value} checked={selected} onChange={onSelect} className="po-type-radio" />
      <div className="po-type-check">
        {selected && <Check className="w-2.5 h-2.5 text-white" />}
      </div>
      <div className="po-type-icon">{icon}</div>
      <div>
        <p className="po-type-label">{title}</p>
        <p className="po-type-desc">{description}</p>
      </div>
    </label>
  );
}

function FieldGroup({
  label, required, icon, children,
}: {
  label: string; required?: boolean; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="po-field-group">
      <label className="po-field-label">
        {icon && <span className="po-field-label-icon">{icon}</span>}
        {label}
        {required && <span className="po-required">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ── Asset Line Items ─────────────────────────────────────── */
function AssetLineItems({
  lineItems, options, onSelectChange, onChange, onRemove, onAdd, currencySymbol, onCreateAsset,
}: {
  lineItems: LineItem[];
  options: SelectOption[];
  onSelectChange: (id: number, selectedId: string) => void;
  onChange: <K extends keyof LineItem>(id: number, field: K, value: LineItem[K]) => void;
  onRemove: (id: number) => void;
  onAdd: () => void;
  currencySymbol: string;
  onCreateAsset: () => void;
}) {
  const selectedIds = new Set(
    lineItems.filter((l) => l.selectedId).map((l) => l.selectedId),
  );

  return (
    <div>
      <div className="po-line-header">
        <span className="po-line-hint">Select assets to order</span>
        <div className="po-line-actions">
          <button type="button" onClick={onCreateAsset} className="po-btn-sm">
            <Plus className="w-3.5 h-3.5" /> New Asset
          </button>
          <button type="button" onClick={onAdd} className="po-btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add Row
          </button>
        </div>
      </div>

      {lineItems.length === 0 ? (
        <div className="po-empty">
          <Package className="po-empty-icon w-8 h-8 mx-auto" />
          <p className="po-empty-title">No items added yet</p>
        </div>
      ) : (
        <>
          <div className="po-asset-col-header">
            <span className="po-asset-col-label">Asset</span>
            <span className="po-asset-col-label" style={{ textAlign: 'right' }}>Qty</span>
            <span className="po-asset-col-label" style={{ textAlign: 'right' }}>Unit Cost</span>
            <span className="po-asset-col-label" style={{ textAlign: 'right' }}>Tax %</span>
            <span />
          </div>
          {lineItems.map((line) => (
            <div key={line.id} className="po-asset-row">
              <SearchableSelect
                value={line.selectedId}
                onChange={(val) => onSelectChange(line.id, val)}
                options={options
                  .filter((opt) => !selectedIds.has(opt.id) || opt.id === line.selectedId)
                  .map((opt) => ({ value: opt.id, label: opt.label }))}
                placeholder="Select asset…"
              />

              <input
                type="number" min="1"
                value={line.quantity_ordered}
                onChange={(e) => onChange(line.id, 'quantity_ordered', parseInt(e.target.value) || 0)}
                className="po-input"
                style={{ textAlign: 'right' }}
              />

              <div className="po-input-prefix">
                <span className="po-prefix-sym">{currencySymbol}</span>
                <input
                  type="number" step="0.01" min="0"
                  value={line.unit_cost}
                  onChange={(e) => onChange(line.id, 'unit_cost', parseFloat(e.target.value) || 0)}
                  className="po-input"
                  style={{ textAlign: 'right', paddingLeft: '20px' }}
                />
              </div>

              <div className="po-input-suffix">
                <input
                  type="number" step="0.1" min="0" max="100"
                  value={line.tax_rate}
                  onChange={(e) => onChange(line.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                  className="po-input"
                  style={{ textAlign: 'right', paddingRight: '22px' }}
                />
                <span className="po-suffix-sym">%</span>
              </div>

              <button
                type="button"
                onClick={() => onRemove(line.id)}
                disabled={lineItems.length <= 1}
                className="po-remove-btn"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ── Product Variant Selector ─────────────────────────────── */
function ProductVariantSelector({
  products, selectedProducts, onAddProduct, onRemoveProduct,
  lineItems, activeLineIds, onToggleVariant, onUpdateLine, onRemoveLine,
  currencySymbol, onCreateProduct, onCreateVariant, collapsedProductIds, onToggleCollapse,
}: {
  products: Product[];
  selectedProducts: Product[];
  onAddProduct: (id: string) => void;
  onRemoveProduct: (id: string) => void;
  lineItems: LineItem[];
  activeLineIds: Set<string>;
  onToggleVariant: (variantId: string) => void;
  onUpdateLine: <K extends keyof LineItem>(id: number, field: K, value: LineItem[K]) => void;
  onRemoveLine: (id: number) => void;
  currencySymbol: string;
  onCreateProduct: () => void;
  onCreateVariant: (productId: string) => void;
  collapsedProductIds: string[];
  onToggleCollapse: (productId: string) => void;
}) {
  const productOptions = useMemo(
    () => products
      .filter((p) => !selectedProducts.some((sp) => sp.id === p.id))
      .map((p) => ({ value: p.id, label: p.product_name })),
    [products, selectedProducts],
  );

  return (
    <div className="space-y-3">
      {/* Product search */}
      <div>
        <div className="po-line-header">
          <span className="po-line-hint">Search and add products</span>
          <button type="button" onClick={onCreateProduct} className="po-btn-sm">
            <Plus className="w-3.5 h-3.5" /> New Product
          </button>
        </div>
        <SearchableSelect
          value=""
          onChange={onAddProduct}
          options={productOptions}
          placeholder="Search products…"
          onAddNew={onCreateProduct}
          addNewLabel="+ Create New Product"
        />
      </div>

      {selectedProducts.length === 0 ? (
        <div className="po-empty">
          <Layers className="po-empty-icon w-8 h-8 mx-auto" />
          <p className="po-empty-title">No products added yet</p>
          <p className="po-empty-sub">Search above to add a product and select its variants</p>
        </div>
      ) : (
        <div>
          {selectedProducts.map((product) => {
            const isCollapsed = collapsedProductIds.includes(product.id);
            const selectedCount = product.variants.filter((v) => activeLineIds.has(v.id)).length;
            return (
              <div key={product.id} className="po-product-card">
                <div className="po-product-header" onClick={() => onToggleCollapse(product.id)}>
                  <div className="po-product-header-left">
                    <ChevronDown
                      className="w-4 h-4 text-muted-foreground shrink-0 transition-transform"
                      style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                    />
                    <Package className="w-4 h-4 text-primary shrink-0" />
                    <span className="po-product-name truncate">{product.product_name}</span>
                    <span className="po-product-meta">
                      {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}
                      {selectedCount > 0 && (
                        <span className="po-product-selected"> · {selectedCount} selected</span>
                      )}
                    </span>
                  </div>
                  <div className="po-product-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onCreateVariant(product.id)}
                      className="po-product-action-btn primary"
                    >
                      + Variant
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveProduct(product.id)}
                      className="po-product-action-btn danger"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  product.variants.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No variants for this product
                    </div>
                  ) : (
                    product.variants.map((variant) => {
                      const isActive = activeLineIds.has(variant.id);
                      const lineItem = lineItems.find((l) => l.selectedId === variant.id);
                      return (
                        <div key={variant.id} className={`po-variant-row ${isActive ? 'active' : ''}`}>
                          <button
                            type="button"
                            onClick={() => onToggleVariant(variant.id)}
                            className={`po-variant-checkbox ${isActive ? 'checked' : ''}`}
                          >
                            {isActive && <Check className="w-2.5 h-2.5" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="po-variant-sku">{variant.sku}</span>
                              {variant.variant_title && (
                                <span className="po-variant-title">— {variant.variant_title}</span>
                              )}
                            </div>
                            {variant.variant_attributes && variant.variant_attributes.length > 0 && (
                              <div className="po-variant-attrs">
                                {variant.variant_attributes.map((attr) => (
                                  <span key={attr.id} className="po-attr-chip">
                                    {attr.attribute_key}: {attr.attribute_value}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="po-variant-stats">
                              <span>
                                Stock:{' '}
                                <span style={{ color: variant.total_stock > 0 ? 'var(--color-success)' : 'var(--color-destructive)', fontWeight: 600 }}>
                                  {variant.total_stock}
                                </span>
                              </span>
                              <span>
                                Buy price:{' '}
                                <span style={{ fontWeight: 600, color: 'var(--color-foreground)' }}>
                                  {currencySymbol}{(variant.buying_price || 0).toFixed(2)}
                                </span>
                              </span>
                            </div>

                            {isActive && lineItem && (
                              <div className="po-variant-inline-fields">
                                <div>
                                  <p className="po-inline-label">Qty</p>
                                  <input
                                    type="number" min="1"
                                    value={lineItem.quantity_ordered}
                                    onChange={(e) => onUpdateLine(lineItem.id, 'quantity_ordered', parseInt(e.target.value) || 0)}
                                    className="po-input"
                                    style={{ textAlign: 'right' }}
                                  />
                                </div>
                                <div>
                                  <p className="po-inline-label">Unit Cost</p>
                                  <div className="po-input-prefix">
                                    <span className="po-prefix-sym">{currencySymbol}</span>
                                    <input
                                      type="number" step="0.01" min="0"
                                      value={lineItem.unit_cost}
                                      onChange={(e) => onUpdateLine(lineItem.id, 'unit_cost', parseFloat(e.target.value) || 0)}
                                      className="po-input"
                                      style={{ textAlign: 'right', paddingLeft: '20px' }}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <p className="po-inline-label">Tax %</p>
                                  <div className="po-input-suffix">
                                    <input
                                      type="number" step="0.1" min="0" max="100"
                                      value={lineItem.tax_rate}
                                      onChange={(e) => onUpdateLine(lineItem.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                                      className="po-input"
                                      style={{ textAlign: 'right', paddingRight: '22px' }}
                                    />
                                    <span className="po-suffix-sym">%</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}