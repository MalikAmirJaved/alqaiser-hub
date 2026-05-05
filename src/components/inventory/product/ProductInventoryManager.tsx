// src/components/inventory/product/ProductInventoryManager.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Warehouse, AlertTriangle, CheckCircle, MapPin } from "lucide-react";
import { uid } from "@/services/localStorageService";
import { ls } from "@/services/localStorageService";

interface InventoryRecord {
  id: string;
  product_id: string;
  variant_id: string | null;
  warehouse_id: string;
  stock_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  reorder_point: number | null;
  reorder_quantity: number | null;
  max_stock_level: number | null;
  lead_time_days: number | null;
  shelf_life_days: number | null;
  location_bin: string;
  last_counted_at: string | null;
}

interface ProductInventoryManagerProps {
  product: any;
  variants: any[];
  inventoryRecords: InventoryRecord[];
  warehouses: any[];
  onChange: (records: InventoryRecord[]) => void;
}

export default function ProductInventoryManager({ 
  product, 
  variants, 
  inventoryRecords, 
  warehouses, 
  onChange 
}: ProductInventoryManagerProps) {
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [newInventory, setNewInventory] = useState<Partial<InventoryRecord>>({
    warehouse_id: "",
    stock_quantity: 0,
    reserved_quantity: 0,
    reorder_point: null,
    reorder_quantity: null,
    max_stock_level: null,
    lead_time_days: null,
    shelf_life_days: null,
    location_bin: ""
  });
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  const addInventory = () => {
    if (!newInventory.warehouse_id) return;
    
    const record: InventoryRecord = {
      id: uid("inv"),
      product_id: product.id,
      variant_id: selectedVariant || null,
      ...newInventory as any,
      available_quantity: (newInventory.stock_quantity || 0) - (newInventory.reserved_quantity || 0),
      last_counted_at: null,
      created_at: new Date().toISOString(),
      created_by: ls.get("session")?.id
    };
    
    onChange([...inventoryRecords, record]);
    setNewInventory({
      warehouse_id: "",
      stock_quantity: 0,
      reserved_quantity: 0,
      reorder_point: null,
      reorder_quantity: null,
      max_stock_level: null,
      lead_time_days: null,
      shelf_life_days: null,
      location_bin: ""
    });
  };

  const updateInventory = (id: string, updates: Partial<InventoryRecord>) => {
    onChange(inventoryRecords.map(record => {
      if (record.id === id) {
        const updated = { ...record, ...updates };
        updated.available_quantity = (updated.stock_quantity || 0) - (updated.reserved_quantity || 0);
        return updated;
      }
      return record;
    }));
  };

  const deleteInventory = (id: string) => {
    if (confirm("Remove this inventory record?")) {
      onChange(inventoryRecords.filter(record => record.id !== id));
    }
  };

  const getWarehouseName = (id: string) => warehouses.find(w => w.id === id)?.name || id;
  
  const getWarehouseCode = (id: string) => warehouses.find(w => w.id === id)?.code || "";

  const getVariantName = (variantId: string | null) => {
    if (!variantId) return "Base Product";
    const variant = variants.find(v => v.id === variantId);
    if (!variant) return "Unknown Variant";
    return Object.entries(variant.attribute_combination || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  };

  // Calculate totals
  const totalStock = inventoryRecords.reduce((sum, r) => sum + r.stock_quantity, 0);
  const totalReserved = inventoryRecords.reduce((sum, r) => sum + (r.reserved_quantity || 0), 0);
  const totalAvailable = inventoryRecords.reduce((sum, r) => sum + (r.available_quantity || 0), 0);
  const lowStockCount = inventoryRecords.filter(r => r.stock_quantity <= (r.reorder_point || 5)).length;

  // Group inventory by variant
  const inventoryByVariant = {
    "base": inventoryRecords.filter(i => !i.variant_id),
    ...variants.reduce((acc, variant) => {
      acc[variant.id] = inventoryRecords.filter(i => i.variant_id === variant.id);
      return acc;
    }, {} as Record<string, InventoryRecord[]>)
  };

  return (
    <div className="space-y-6">
      {/* Stock Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{totalStock}</div>
            <div className="text-xs text-muted-foreground">Total Stock</div>
          </CardContent>
        </Card>
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-warning">{totalReserved}</div>
            <div className="text-xs text-muted-foreground">Reserved</div>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-success">{totalAvailable}</div>
            <div className="text-xs text-muted-foreground">Available</div>
          </CardContent>
        </Card>
        <Card className={lowStockCount > 0 ? "bg-destructive/5 border-destructive/20" : "bg-muted/20"}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-destructive">{lowStockCount}</div>
            <div className="text-xs text-muted-foreground">Low Stock</div>
          </CardContent>
        </Card>
      </div>

      {/* Add Inventory Form */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Add Stock to Warehouse</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowBulkAdd(!showBulkAdd)}>
              {showBulkAdd ? "Single Entry" : "Bulk Add"}
            </Button>
          </div>
          
          {!showBulkAdd ? (
            <div className="grid grid-cols-12 gap-3">
              {product.product_type === "variable" && (
                <div className="col-span-2">
                  <Label className="text-xs">Variant</Label>
                  <select
                    value={selectedVariant}
                    onChange={(e) => setSelectedVariant(e.target.value)}
                    className="w-full mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="">Base Product</option>
                    {variants.map(variant => (
                      <option key={variant.id} value={variant.id}>
                        {Object.entries(variant.attribute_combination || {})
                          .map(([k, v]) => `${k}:${v}`).join(" ")}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className={product.product_type === "variable" ? "col-span-2" : "col-span-3"}>
                <Label className="text-xs">Warehouse *</Label>
                <select
                  value={newInventory.warehouse_id}
                  onChange={(e) => setNewInventory({ ...newInventory, warehouse_id: e.target.value })}
                  className="w-full mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.filter(w => w.is_active === "true" || w.is_active === true).map(wh => (
                    <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Stock Quantity</Label>
                <Input
                  type="number"
                  value={newInventory.stock_quantity}
                  onChange={(e) => setNewInventory({ ...newInventory, stock_quantity: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Reserved Quantity</Label>
                <Input
                  type="number"
                  value={newInventory.reserved_quantity}
                  onChange={(e) => setNewInventory({ ...newInventory, reserved_quantity: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Location/Bin</Label>
                <Input
                  value={newInventory.location_bin || ""}
                  onChange={(e) => setNewInventory({ ...newInventory, location_bin: e.target.value })}
                  placeholder="A-12, B-03"
                  className="mt-1"
                />
              </div>
              <div className="col-span-1 flex items-end">
                <Button onClick={addInventory} className="w-full">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                placeholder="warehouse_code, quantity, variant_sku(optional), bin_location(optional)&#10;WH001,100,,A-12&#10;WH002,50,SKU-RED-L,"
                rows={4}
                className="w-full p-2 rounded-md border border-border bg-background text-sm font-mono"
              />
              <div className="flex gap-2">
                <Button variant="default" size="sm">Import Stock</Button>
                <Button variant="outline" size="sm" onClick={() => setShowBulkAdd(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory List by Variant */}
      {inventoryRecords.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-lg">
          <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No inventory records found</p>
          <p className="text-sm">Add stock to warehouses using the form above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(inventoryByVariant).map(([variantId, records]) => {
            if (records.length === 0) return null;
            const variantName = getVariantName(variantId === "base" ? null : variantId);
            
            return (
              <div key={variantId} className="space-y-2">
                {variantId !== "base" && variantName !== "Base Product" && (
                  <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                    <span className="w-1 h-4 bg-primary rounded-full"></span>
                    {variantName}
                    <Badge variant="outline">{records.length} location(s)</Badge>
                  </h4>
                )}
                <div className="space-y-2">
                  {records.map(record => {
                    const isLowStock = record.stock_quantity <= (record.reorder_point || 5);
                    const isOutOfStock = record.stock_quantity === 0;
                    
                    return (
                      <div key={record.id} className={`p-4 rounded-lg border transition-all ${
                        isOutOfStock ? "bg-destructive/5 border-destructive/30" :
                        isLowStock ? "bg-warning/5 border-warning/30" :
                        "bg-muted/5 border-border"
                      }`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 grid grid-cols-12 gap-3">
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Warehouse</Label>
                              <div className="flex items-center gap-1 mt-1">
                                <Warehouse className="w-3 h-3 text-muted-foreground" />
                                <span className="text-sm font-medium">{getWarehouseName(record.warehouse_id)}</span>
                                <span className="text-xs text-muted-foreground">({getWarehouseCode(record.warehouse_id)})</span>
                              </div>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Stock</Label>
                              <Input
                                type="number"
                                value={record.stock_quantity}
                                onChange={(e) => updateInventory(record.id, { stock_quantity: parseInt(e.target.value) || 0 })}
                                className={`mt-1 h-8 text-sm ${isLowStock ? "border-warning" : ""}`}
                              />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Reserved</Label>
                              <Input
                                type="number"
                                value={record.reserved_quantity}
                                onChange={(e) => updateInventory(record.id, { reserved_quantity: parseInt(e.target.value) || 0 })}
                                className="mt-1 h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Available</Label>
                              <div className={`mt-1 text-sm font-bold ${
                                record.available_quantity <= 0 ? "text-destructive" :
                                record.available_quantity < 10 ? "text-warning" : "text-success"
                              }`}>
                                {record.available_quantity}
                              </div>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Location/Bin</Label>
                              <div className="flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3 text-muted-foreground" />
                                <Input
                                  value={record.location_bin || ""}
                                  onChange={(e) => updateInventory(record.id, { location_bin: e.target.value })}
                                  className="h-8 text-sm"
                                  placeholder="A-12"
                                />
                              </div>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground">Reorder Point</Label>
                              <div className="flex items-center gap-1 mt-1">
                                <Input
                                  type="number"
                                  value={record.reorder_point || ""}
                                  onChange={(e) => updateInventory(record.id, { reorder_point: parseInt(e.target.value) || null })}
                                  className="h-8 text-sm"
                                  placeholder="Min stock"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-6">
                            {isLowStock && !isOutOfStock && (
                              <AlertTriangle className="w-4 h-4 text-warning" title="Low stock warning" />
                            )}
                            {isOutOfStock && (
                              <AlertTriangle className="w-4 h-4 text-destructive" title="Out of stock" />
                            )}
                            <button
                              onClick={() => deleteInventory(record.id)}
                              className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Advanced Settings (collapsible) */}
                        <details className="mt-3 pt-2 border-t border-border/50">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            Advanced Settings
                          </summary>
                          <div className="grid grid-cols-4 gap-3 mt-3">
                            <div>
                              <Label className="text-xs">Reorder Quantity</Label>
                              <Input
                                type="number"
                                value={record.reorder_quantity || ""}
                                onChange={(e) => updateInventory(record.id, { reorder_quantity: parseInt(e.target.value) || null })}
                                className="mt-1 h-8 text-sm"
                                placeholder="Qty to reorder"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Max Stock Level</Label>
                              <Input
                                type="number"
                                value={record.max_stock_level || ""}
                                onChange={(e) => updateInventory(record.id, { max_stock_level: parseInt(e.target.value) || null })}
                                className="mt-1 h-8 text-sm"
                                placeholder="Overstock limit"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Lead Time (Days)</Label>
                              <Input
                                type="number"
                                value={record.lead_time_days || ""}
                                onChange={(e) => updateInventory(record.id, { lead_time_days: parseInt(e.target.value) || null })}
                                className="mt-1 h-8 text-sm"
                                placeholder="Days from order"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Shelf Life (Days)</Label>
                              <Input
                                type="number"
                                value={record.shelf_life_days || ""}
                                onChange={(e) => updateInventory(record.id, { shelf_life_days: parseInt(e.target.value) || null })}
                                className="mt-1 h-8 text-sm"
                                placeholder="Expiry in days"
                              />
                            </div>
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-muted/20 rounded-lg p-3 text-sm">
        <p className="text-muted-foreground">
          📦 <strong>Multi-Warehouse Inventory:</strong> Track stock across multiple warehouses separately. 
          Each warehouse can have its own stock level, reorder point, and bin location. Available quantity is auto-calculated as Stock - Reserved.
        </p>
      </div>
    </div>
  );
}