// src/components/inventory/product/ProductInventoryManager.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Warehouse, AlertTriangle, MapPin } from "lucide-react";
import { Warehouse as WarehouseType } from "@/hooks/useWarehouses";

interface InventoryRecord {
  id?: string;
  warehouse_id: string;
  stock_quantity: number;
  reserved_quantity: number;
  available_quantity?: number;
  reorder_point?: number | null;
  reorder_quantity?: number | null;
  location_bin?: string;
}

interface ProductInventoryManagerProps {
  product: any;
  variants: any[];
  inventoryRecords: InventoryRecord[];
  warehouses: WarehouseType[];
  onChange: (records: InventoryRecord[]) => void;
}

export default function ProductInventoryManager({ product, variants, inventoryRecords, warehouses, onChange }: ProductInventoryManagerProps) {
  const [selectedVariant, setSelectedVariant] = useState("");
  const [newInv, setNewInv] = useState<Partial<InventoryRecord>>({ warehouse_id: "", stock_quantity: 0, reserved_quantity: 0, location_bin: "" });

  const addInventory = () => {
    if (!newInv.warehouse_id) return;
    const newId = `inv_${Date.now()}_${Math.random()}`;
    onChange([...inventoryRecords, { id: newId, variant_id: selectedVariant || null, ...newInv, available_quantity: (newInv.stock_quantity || 0) - (newInv.reserved_quantity || 0) } as any]);
    setNewInv({ warehouse_id: "", stock_quantity: 0, reserved_quantity: 0, location_bin: "" });
  };

  const updateInventory = (index: number, updates: Partial<InventoryRecord>) => {
    const newRecords = [...inventoryRecords];
    newRecords[index] = { ...newRecords[index], ...updates };
    if (updates.stock_quantity !== undefined || updates.reserved_quantity !== undefined) {
      newRecords[index].available_quantity = (newRecords[index].stock_quantity || 0) - (newRecords[index].reserved_quantity || 0);
    }
    onChange(newRecords);
  };

  const deleteInventory = (index: number) => {
    onChange(inventoryRecords.filter((_, i) => i !== index));
  };

  const getWarehouseName = (id: string) => warehouses.find(w => w.id === Number(id))?.warehouse_name || id;
  const getWarehouseCode = (id: string) => warehouses.find(w => w.id === Number(id))?.code || "";

  const totalStock = inventoryRecords.reduce((s, r) => s + r.stock_quantity, 0);
  const totalReserved = inventoryRecords.reduce((s, r) => s + (r.reserved_quantity || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-primary/5"><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-primary">{totalStock}</div><div className="text-xs">Total Stock</div></CardContent></Card>
        <Card className="bg-warning/5"><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-warning">{totalReserved}</div><div className="text-xs">Reserved</div></CardContent></Card>
        <Card className="bg-success/5"><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-success">{totalStock - totalReserved}</div><div className="text-xs">Available</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4">Add Stock to Warehouse</h3>
          <div className="grid grid-cols-12 gap-3">
            {product.product_type === "variable" && (
              <div className="col-span-2"><Label className="text-xs">Variant</Label><select value={selectedVariant} onChange={(e) => setSelectedVariant(e.target.value)} className="w-full mt-1 h-9 rounded-md border border-border bg-background px-3"><option value="">Base Product</option>{variants.map(v => (<option key={v.id} value={v.id}>{Object.values(v.attribute_combination || {}).join(" ")}</option>))}</select></div>
            )}
            <div className="col-span-3"><Label className="text-xs">Warehouse</Label><select value={newInv.warehouse_id} onChange={(e) => setNewInv({...newInv, warehouse_id: e.target.value})} className="w-full mt-1 h-9 rounded-md border border-border bg-background px-3"><option value="">Select</option>{warehouses.map(w => (<option key={w.id} value={w.id}>{w.warehouse_name} ({w.code})</option>))}</select></div>
            <div className="col-span-2"><Label className="text-xs">Stock Qty</Label><Input type="number" value={newInv.stock_quantity} onChange={(e) => setNewInv({...newInv, stock_quantity: parseInt(e.target.value) || 0})} className="mt-1" /></div>
            <div className="col-span-2"><Label className="text-xs">Reserved</Label><Input type="number" value={newInv.reserved_quantity} onChange={(e) => setNewInv({...newInv, reserved_quantity: parseInt(e.target.value) || 0})} className="mt-1" /></div>
            <div className="col-span-2"><Label className="text-xs">Location/Bin</Label><Input value={newInv.location_bin || ""} onChange={(e) => setNewInv({...newInv, location_bin: e.target.value})} placeholder="A-12" className="mt-1" /></div>
            <div className="col-span-1 flex items-end"><Button onClick={addInventory}><Plus className="w-4 h-4" /></Button></div>
          </div>
        </CardContent>
      </Card>

      {inventoryRecords.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg"><Warehouse className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No inventory records</p></div>
      ) : (
        <div className="space-y-3">
          {inventoryRecords.map((rec, idx) => (
            <div key={rec.id} className="p-4 rounded-lg border bg-muted/5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 grid grid-cols-12 gap-3">
                  <div className="col-span-2"><div className="text-xs text-muted-foreground">Warehouse</div><div className="flex items-center gap-1 mt-1"><Warehouse className="w-3 h-3" /><span className="font-medium">{getWarehouseName(rec.warehouse_id)}</span><span className="text-xs text-muted-foreground">({getWarehouseCode(rec.warehouse_id)})</span></div></div>
                  <div className="col-span-2"><Label className="text-xs">Stock</Label><Input type="number" value={rec.stock_quantity} onChange={(e) => updateInventory(idx, { stock_quantity: parseInt(e.target.value) || 0 })} className="mt-1 h-8" /></div>
                  <div className="col-span-2"><Label className="text-xs">Reserved</Label><Input type="number" value={rec.reserved_quantity} onChange={(e) => updateInventory(idx, { reserved_quantity: parseInt(e.target.value) || 0 })} className="mt-1 h-8" /></div>
                  <div className="col-span-2"><Label className="text-xs">Available</Label><div className="mt-1 font-bold">{rec.available_quantity}</div></div>
                  <div className="col-span-2"><Label className="text-xs">Location</Label><div className="flex gap-1 mt-1"><MapPin className="w-3 h-3 text-muted-foreground" /><Input value={rec.location_bin || ""} onChange={(e) => updateInventory(idx, { location_bin: e.target.value })} className="h-8" placeholder="Bin" /></div></div>
                  <div className="col-span-2"><Label className="text-xs">Reorder Point</Label><Input type="number" value={rec.reorder_point || ""} onChange={(e) => updateInventory(idx, { reorder_point: parseInt(e.target.value) || null })} className="mt-1 h-8" /></div>
                </div>
                <button onClick={() => deleteInventory(idx)} className="text-destructive mt-6"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}