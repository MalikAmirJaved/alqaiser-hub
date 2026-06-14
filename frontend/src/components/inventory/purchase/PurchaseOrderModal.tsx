'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Trash2, Info, Package, Building2, Check, Layers, ChevronDown } from 'lucide-react';
import { useSuppliers, useCreateSupplier } from '@/hooks/useSuppliers';
import { useWarehouses, useCreateWarehouse } from '@/hooks/useWarehouses';
import { useProducts, useCreateProduct, useUpdateProduct } from '@/hooks/useProducts';
import { useAssets, useCreateAsset } from '@/hooks/useAssets';
import type { PurchaseOrder, PurchaseOrderPayload } from '@/types/purchase';
import type { Product, ProductVariant, ProductPayload } from '@/hooks/useProducts';
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { toast } from "sonner";
import SearchableSelect from '@/components/reuseable/SearchableSelect';
import ProductForm from '@/components/inventory/product/ProductForm';
import VariantCard from '@/components/inventory/product/VariantCard';
import { FormModal } from '@/components/inventory/supplier/FormModal';
import { useAutoCode } from '@/hooks/useAutoCode';
import { useQueryClient } from '@tanstack/react-query';

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

let _lineId = 1;
const nextLineId = () => _lineId++;

function emptyLine(): LineItem {
  return { id: nextLineId(), selectedId: '', quantity_ordered: 1, unit_cost: 0, tax_rate: 0 };
}

function fmtCurrency(n: number, currencySymbol = '$') {
  return `${currencySymbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const supplierFormFields = [
  { name: "code", label: "Code", type: "code" as const, required: true, placeholder: "e.g., SUP-001" },
  { name: "name", label: "Name", type: "text" as const, required: true, placeholder: "Company name" },
  { name: "contact_person", label: "Contact Person", type: "text" as const, placeholder: "Full name" },
  { name: "email", label: "Email", type: "email" as const, placeholder: "contact@company.com" },
  { name: "phone", label: "Phone", type: "tel" as const, placeholder: "+1 234 567 8900" },
];

const warehouseFormFields = [
  { name: "code", label: "Code", type: "code" as const, required: true, placeholder: "e.g., WH-001" },
  { name: "warehouse_name", label: "Warehouse Name", type: "text" as const, required: true, placeholder: "Main Warehouse" },
  { name: "country", label: "Country", type: "text" as const, placeholder: "Country" },
  { name: "state", label: "State", type: "text" as const, placeholder: "State/Province" },
  { name: "city", label: "City", type: "text" as const, placeholder: "City" },
];

const assetFormFields = [
  { name: "name", label: "Asset Name", type: "text" as const, required: true, placeholder: "e.g., Office Chair" },
  { name: "brand", label: "Brand", type: "text" as const, placeholder: "Brand name" },
  { name: "serial_number", label: "Serial Number", type: "text" as const, placeholder: "SN-001" },
  { name: "description", label: "Description", type: "textarea" as const, placeholder: "Optional description" },
];

export function PurchaseOrderModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  prefillFromRequest,
  loading,
}: PurchaseOrderModalProps) {
  const { data: suppliers = [] } = useSuppliers();
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
  const { generateCode: genSupplierCode } = useAutoCode("supplier");
  const { generateCode: genWarehouseCode } = useAutoCode("warehouse");

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
        }))
      );
    } else {
      return assets.map((a) => ({
        id: a.id,
        label: `${a.name} ${a.brand ? `(${a.brand})` : ''} ${a.serial_number ? `- SN: ${a.serial_number}` : ''}`,
        buying_price: a.purchase_price || 0,
      }));
    }
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
      const loadedLines: LineItem[] =
        initialData.lines?.map((l) => ({
          id: nextLineId(),
          selectedId: l.variant || l.asset || '',
          quantity_ordered: l.quantity_ordered,
          unit_cost: l.unit_cost,
          tax_rate: l.tax_rate,
        })) ?? [];
      setLineItems(loadedLines.length > 0 ? loadedLines : [emptyLine()]);
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
    if (pIds.size > 0) {
      setSelectedProductIds(Array.from(pIds));
    }
  }, [initialData, products]);

  const handleTypeChange = (type: InventoryType) => {
    setInventoryType(type);
    setLineItems([emptyLine()]);
    setSelectedProductIds([]);
  };

  const handleAddProduct = (productId: string) => {
    if (!productId) return;
    if (selectedProductIds.includes(productId)) return;
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
      return active.length === 0 && newLines.length === 0
        ? [emptyLine()]
        : [...active, ...newLines];
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
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
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
      return [...filtered, {
        id: nextLineId(),
        selectedId: variantId,
        quantity_ordered: 1,
        unit_cost: variant.buying_price || 0,
        tax_rate: 0,
      }];
    });
  };

  const findVariant = (variantId: string): ProductVariant | undefined => {
    for (const p of products) {
      const v = p.variants.find((v) => v.id === variantId);
      if (v) return v;
    }
    return undefined;
  };

  const { subtotal, totalTax, grandTotal } = useMemo(() => {
    let sub = 0;
    let tax = 0;
    lineItems.forEach((l) => {
      if (!l.selectedId) return;
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

  const handleCreateProductSubmit = async (data: ProductPayload) => {
    const result = await createProduct.mutateAsync(data);
    setShowCreateProduct(false);
    await refetchProducts();
    const newProductId = result.data.id;
    setSelectedProductIds((prev) => [...prev, newProductId]);
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
          id: v.id,
          sku: v.sku,
          variantTitle: v.variant_title,
          barcode: v.barcode,
          sellingPrice: v.selling_price,
          minStockLevel: v.min_stock_level,
          maxStockLevel: v.max_stock_level,
          attributes: v.variant_attributes?.map((a) => ({ key: a.attribute_key, value: a.attribute_value })),
        })),
        {
          sku: data.sku,
          variantTitle: data.variantTitle,
          barcode: data.barcode,
          sellingPrice: data.sellingPrice,
          minStockLevel: data.minStockLevel,
          maxStockLevel: data.maxStockLevel,
          attributes: data.attributes,
        },
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
    await queryClient.invalidateQueries({ queryKey: ["inventory_supplier"] });
  };

  const handleCreateWarehouse = async (data: any) => {
    await createWarehouse.mutateAsync(data);
    setShowWarehouseForm(false);
    await queryClient.invalidateQueries({ queryKey: ["inventory_warehouse"] });
  };

  const handleCreateAsset = async (data: any) => {
    await createAsset.mutateAsync({
      ...data,
      is_active: true,
      purchase_date: new Date().toISOString().split("T")[0],
      purchase_price: 0,
      total_quantity: 1,
      available_quantity: 1,
    });
    setShowAssetForm(false);
    await queryClient.invalidateQueries({ queryKey: ["assets"] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedLines = lineItems.filter((l) => l.selectedId);
    if (selectedLines.length === 0) {
      toast.error("Add at least one line item.");
      return;
    }
    const missingCost = selectedLines.find((l) => l.unit_cost <= 0);
    if (missingCost) {
      toast.error("Cost price is required for every line item.");
      return;
    }

    const payload: PurchaseOrderPayload = {
      supplier: supplierId,
      warehouse: warehouseId,
      inventory_type: inventoryType,
      order_date: orderDate || undefined,
      expected_delivery_date: expectedDate || undefined,
      notes: notes || undefined,
      line_items: selectedLines
        .map(({ selectedId, quantity_ordered, unit_cost, tax_rate }) => ({
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

  return (
    <>
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

              {/* ── Inventory Type (always on top) ── */}
              <section>
                <SectionLabel>Inventory Type</SectionLabel>
                <div className="flex gap-6 mt-1">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors"
                    style={{
                      borderColor: inventoryType === 'FOR_SALE' ? 'var(--color-primary)' : undefined,
                      background: inventoryType === 'FOR_SALE' ? 'rgba(var(--color-primary-rgb), 0.05)' : undefined,
                    }}
                  >
                    <input
                      type="radio"
                      name="inventoryType"
                      value="FOR_SALE"
                      checked={inventoryType === 'FOR_SALE'}
                      onChange={() => handleTypeChange('FOR_SALE')}
                      className="w-4 h-4"
                    />
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">For Sale (Stock)</p>
                        <p className="text-xs text-muted-foreground">Items for resale — stock tracked</p>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors"
                    style={{
                      borderColor: inventoryType === 'OFFICE_INVENTORY' ? 'var(--color-primary)' : undefined,
                      background: inventoryType === 'OFFICE_INVENTORY' ? 'rgba(var(--color-primary-rgb), 0.05)' : undefined,
                    }}
                  >
                    <input
                      type="radio"
                      name="inventoryType"
                      value="OFFICE_INVENTORY"
                      checked={inventoryType === 'OFFICE_INVENTORY'}
                      onChange={() => handleTypeChange('OFFICE_INVENTORY')}
                      className="w-4 h-4"
                    />
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="text-sm font-medium">Office Inventory (Asset)</p>
                        <p className="text-xs text-muted-foreground">For internal use — added to HR Assets</p>
                      </div>
                    </div>
                  </label>
                </div>
                {inventoryType === 'OFFICE_INVENTORY' && (
                  <p className="text-xs text-info mt-2 flex items-center gap-1.5">
                    <Info className="w-3 h-3" />
                    Office inventory will be added to HR Assets and Finance Expenses upon receipt
                  </p>
                )}
              </section>

              {/* ── Order details ── */}
              <section>
                <SectionLabel>Order Details</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Supplier" required>
                    <div className="flex gap-1.5">
                      <select
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                        required
                        className="field-input flex-1"
                      >
                        <option value="">Select supplier…</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowSupplierForm(true)}
                        className="flex items-center justify-center w-9 h-9 rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-primary transition-colors shrink-0"
                        title="Create new supplier"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </Field>

                  {inventoryType === 'FOR_SALE' && (
                    <Field label="Destination warehouse" required>
                      <div className="flex gap-1.5">
                        <select
                          value={warehouseId}
                          onChange={(e) => setWarehouseId(e.target.value)}
                          required
                          className="field-input flex-1"
                        >
                          <option value="">Select warehouse…</option>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowWarehouseForm(true)}
                          className="flex items-center justify-center w-9 h-9 rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-primary transition-colors shrink-0"
                          title="Create new warehouse"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </Field>
                  )}

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

              {/* ── Line items ── */}
              <section>
                <SectionLabel>Line Items</SectionLabel>

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
                    currencySymbol={CurrencyCode()}
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
                    currencySymbol={CurrencyCode()}
                    onCreateAsset={() => setShowAssetForm(true)}
                  />
                )}

                {(inventoryType === 'OFFICE_INVENTORY' ? lineItems.some((l) => l.selectedId) : lineItems.filter(l => l.selectedId).length > 0) && (
                  <div className="mt-4 bg-muted/40 rounded-lg px-4 py-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{fmtCurrency(subtotal, CurrencyCode())}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Est. tax</span>
                      <span>{fmtCurrency(totalTax, CurrencyCode())}</span>
                    </div>
                    <div className="flex justify-between font-medium text-base pt-2 border-t border-border">
                      <span>Order total</span>
                      <span>{fmtCurrency(grandTotal, CurrencyCode())}</span>
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
          input[type="date"].field-input {
            color-scheme: dark;
          }
        `}</style>
      </div>

      {/* ── Create Product modal ── */}
      {showCreateProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-card rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <ProductForm
              onSubmit={handleCreateProductSubmit}
              isLoading={createProduct.isPending}
              isEditing={false}
              onCancel={() => setShowCreateProduct(false)}
            />
          </div>
        </div>
      )}

      {/* ── Create Variant modal ── */}
      {showVariantForm && variantFormProductId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <VariantCard
              standalone
              onSubmit={handleCreateVariant}
              onCancel={() => { setShowVariantForm(false); setVariantFormProductId(null); }}
              loading={updateProduct.isPending}
            />
          </div>
        </div>
      )}

      {/* ── Create Supplier modal ── */}
      <FormModal
        open={showSupplierForm}
        onClose={() => setShowSupplierForm(false)}
        title="Add New Supplier"
        fields={supplierFormFields}
        initialData={{}}
        onSubmit={handleCreateSupplier}
        isSubmitting={createSupplier.isPending}
        onGenerateCode={genSupplierCode}
      />

      {/* ── Create Warehouse modal ── */}
      <FormModal
        open={showWarehouseForm}
        onClose={() => setShowWarehouseForm(false)}
        title="Add New Warehouse"
        fields={warehouseFormFields}
        initialData={{}}
        onSubmit={handleCreateWarehouse}
        isSubmitting={createWarehouse.isPending}
        onGenerateCode={genWarehouseCode}
      />

      {/* ── Create Asset modal ── */}
      <FormModal
        open={showAssetForm}
        onClose={() => setShowAssetForm(false)}
        title="Add New Asset"
        fields={assetFormFields}
        initialData={{}}
        onSubmit={handleCreateAsset}
        isSubmitting={createAsset.isPending}
      />
    </>
  );
}

// ── Product & Variant Selector (FOR_SALE) ──
function ProductVariantSelector({
  products,
  selectedProducts,
  onAddProduct,
  onRemoveProduct,
  lineItems,
  activeLineIds,
  onToggleVariant,
  onUpdateLine,
  onRemoveLine,
  currencySymbol,
  onCreateProduct,
  onCreateVariant,
  collapsedProductIds,
  onToggleCollapse,
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
    () => products.map((p) => ({ value: p.id, label: p.product_name })),
    [products],
  );

  return (
    <div className="space-y-3">
      {/* Product search + multi-select */}
      <div className="max-w-md">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Add Products</label>
        <SearchableSelect
          value=""
          onChange={onAddProduct}
          options={productOptions}
          placeholder="Search and add a product…"
          onAddNew={onCreateProduct}
          addNewLabel="+ Create New Product"
        />
      </div>

      {selectedProducts.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg py-10 text-center text-muted-foreground">
          <Layers className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm">Add products to include their variants</p>
          <p className="text-xs mt-1 text-muted-foreground/60">All variants will be pre-filled — just toggle the ones you need</p>
        </div>
      ) : (
        <div className="space-y-4">
          {selectedProducts.map((product) => {
            const isCollapsed = collapsedProductIds.includes(product.id);
            const selectedCount = product.variants.filter((v) => activeLineIds.has(v.id)).length;
            return (
              <div key={product.id} className="border border-border rounded-lg">
                {/* Product header - clickable to toggle collapse */}
                <div
                  className="px-3 py-2 bg-muted/30 flex items-center justify-between cursor-pointer select-none"
                  onClick={() => onToggleCollapse(product.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                    />
                    <Package className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium truncate">{product.product_name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {product.variants.length} variants
                      {selectedCount > 0 && (
                        <span className="ml-1.5 text-primary font-medium">· {selectedCount} selected</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onCreateVariant(product.id)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      <Plus className="w-3 h-3" /> Variant
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveProduct(product.id)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Collapsible variant list */}
                {!isCollapsed && (
                  product.variants.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No variants found for this product
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {product.variants.map((variant) => {
                        const isActive = activeLineIds.has(variant.id);
                        const lineItem = lineItems.find((l) => l.selectedId === variant.id);
                        return (
                          <div
                            key={variant.id}
                            className={`px-3 py-2.5 transition-colors ${isActive ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Checkbox */}
                              <button
                                type="button"
                                onClick={() => onToggleVariant(variant.id)}
                                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                  isActive
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'border-muted-foreground/30 hover:border-primary'
                                }`}
                              >
                                {isActive && <Check className="w-3 h-3" />}
                              </button>

                              {/* Variant info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-semibold">{variant.sku}</span>
                                  {variant.variant_title && (
                                    <span className="text-xs text-muted-foreground">— {variant.variant_title}</span>
                                  )}
                                </div>

                                {/* Attributes */}
                                {variant.variant_attributes && variant.variant_attributes.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {variant.variant_attributes.map((attr) => (
                                      <span
                                        key={attr.id}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
                                      >
                                        {attr.attribute_key}: {attr.attribute_value}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Stock info */}
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[11px] text-muted-foreground">
                                    Stock: <span className={`font-medium ${variant.total_stock > 0 ? 'text-success' : 'text-destructive'}`}>
                                      {variant.total_stock}
                                    </span>
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    Price: <span className="font-medium">{currencySymbol}{(variant.buying_price || 0).toFixed(2)}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Inline fields when active */}
                            {isActive && lineItem && (
                              <div className="mt-2 ml-8 grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[10px] text-muted-foreground font-medium">Qty</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={lineItem.quantity_ordered}
                                    onChange={(e) => onUpdateLine(lineItem.id, 'quantity_ordered' as const, parseInt(e.target.value) || 0)}
                                    className="field-input text-xs text-right tabular-nums"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground font-medium">Unit Cost</label>
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">{currencySymbol}</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={lineItem.unit_cost}
                                      onChange={(e) => onUpdateLine(lineItem.id, 'unit_cost' as const, parseFloat(e.target.value) || 0)}
                                      className="field-input text-xs text-right tabular-nums pl-4"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-end gap-1">
                                  <div className="flex-1">
                                    <label className="text-[10px] text-muted-foreground font-medium">Tax %</label>
                                    <div className="relative">
                                      <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={lineItem.tax_rate}
                                        onChange={(e) => onUpdateLine(lineItem.id, 'tax_rate' as const, parseFloat(e.target.value) || 0)}
                                        className="field-input text-xs text-right tabular-nums pr-5"
                                      />
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">%</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => onRemoveLine(lineItem.id)}
                                    disabled={lineItems.filter(l => l.selectedId).length <= 1}
                                    className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-30 transition-colors mb-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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

// ── Asset line items (OFFICE_INVENTORY) ──
function AssetLineItems({
  lineItems,
  options,
  onSelectChange,
  onChange,
  onRemove,
  onAdd,
  currencySymbol,
  onCreateAsset,
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
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Select assets to order</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCreateAsset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Asset
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add item
          </button>
        </div>
      </div>

      {lineItems.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg py-10 text-center text-muted-foreground">
          <Package className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm">No items added yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className="grid gap-2 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            style={{ gridTemplateColumns: '1fr 72px 100px 80px 28px' }}
          >
            <span>Asset</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit cost</span>
            <span className="text-right">Tax %</span>
            <span />
          </div>
          {lineItems.map((line) => (
            <div
              key={line.id}
              className="grid gap-2 items-center bg-muted/30 border border-border rounded-lg px-3 py-2.5"
              style={{ gridTemplateColumns: '1fr 72px 100px 80px 28px' }}
            >
              <select
                value={line.selectedId}
                onChange={(e) => onSelectChange(line.id, e.target.value)}
                className="field-input text-xs"
              >
                <option value="">Select asset…</option>
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
                onClick={() => onRemove(line.id)}
                disabled={lineItems.length <= 1}
                title="Remove line"
                className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ──
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
