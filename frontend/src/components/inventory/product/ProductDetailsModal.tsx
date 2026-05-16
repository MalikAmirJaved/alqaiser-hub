// src/components/inventory/product/ProductDetailsModal.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Edit, Package, Layers, Image as ImageIcon, Warehouse } from "lucide-react";
import { Product } from "@/hooks/useProducts";

interface ProductDetailsModalProps {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
}

export default function ProductDetailsModal({ product, onClose, onEdit }: ProductDetailsModalProps) {
  const [activeTab, setActiveTab] = useState("info");

  const totalStock = product.variants.reduce((sum, v) => sum + v.total_stock, 0);
  const totalReserved = product.variants.reduce((sum, v) => sum + v.stock_by_warehouse.reduce((s, w) => s + w.quantity_reserved, 0), 0);
  const totalAvailable = totalStock - totalReserved;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl bg-card rounded-2xl shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold">{product.product_name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs text-muted-foreground">ID: {product.id}</span>
              <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                product.status === "active" ? "bg-success/15 text-success" :
                product.status === "draft" ? "bg-warning/15 text-warning" : "bg-muted/40"
              }`}>{product.status}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}><Edit className="w-4 h-4 mr-2" /> Edit</Button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="px-6 pt-2 border-b border-border justify-start gap-1 bg-transparent">
            <TabsTrigger value="info"><Package className="w-4 h-4 mr-1" /> Details</TabsTrigger>
            <TabsTrigger value="variants"><Layers className="w-4 h-4 mr-1" /> Variants ({product.variants.length})</TabsTrigger>
            <TabsTrigger value="stock"><Warehouse className="w-4 h-4 mr-1" /> Stock</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Info Tab */}
            <TabsContent value="info" className="m-0 space-y-4">
              {product.description && (
                <div>
                  <h4 className="font-medium mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/20 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Category</div>
                  <div className="font-medium">{product.category_id || "—"}</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Brand</div>
                  <div className="font-medium">{product.brand_id || "—"}</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Unit</div>
                  <div className="font-medium">{product.unit}</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Storage Requirement</div>
                  <div className="font-medium">{product.storage_requirement}</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Tax Rate</div>
                  <div className="font-medium">{product.tax_rate}%</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-success/10 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">Total Stock</div>
                  <div className="text-2xl font-bold text-success">{totalStock}</div>
                </div>
                <div className="bg-warning/10 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">Reserved</div>
                  <div className="text-2xl font-bold text-warning">{totalReserved}</div>
                </div>
                <div className="bg-info/10 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">Available</div>
                  <div className="text-2xl font-bold text-info">{totalAvailable}</div>
                </div>
              </div>
            </TabsContent>

            {/* Variants Tab */}
            <TabsContent value="variants" className="m-0">
              <div className="space-y-4">
                {product.variants.map(variant => (
                  <div key={variant.id} className="border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">
                          {variant.variant_attributes.map(attr => `${attr.attribute_key}: ${attr.attribute_value}`).join(" | ") || variant.sku}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground mt-1">SKU: {variant.sku}</div>
                        {variant.barcode && <div className="text-xs">Barcode: {variant.barcode}</div>}
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-success">${parseFloat(variant.selling_price).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground line-through">${parseFloat(variant.buying_price).toFixed(2)}</div>
                      </div>
                    </div>
                    {variant.variant_images.length > 0 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto">
                        {variant.variant_images.map(img => (
                          <img key={img.id} src={img.image_url} alt="Variant" className="w-12 h-12 object-cover rounded border" />
                        ))}
                      </div>
                    )}
                    {variant.stock_by_warehouse.length > 0 && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Stock: {variant.total_stock} units across {variant.stock_by_warehouse.length} warehouse(s)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Stock Tab */}
            <TabsContent value="stock" className="m-0">
              <div className="space-y-4">
                {product.variants.flatMap(variant =>
                  variant.stock_by_warehouse.map(sw => ({
                    variantSku: variant.sku,
                    warehouseName: sw.warehouse_name,
                    onHand: sw.quantity_on_hand,
                    reserved: sw.quantity_reserved,
                  }))
                ).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-muted/10 rounded-lg">
                    <div>
                      <div className="font-medium">{item.variantSku}</div>
                      <div className="text-xs text-muted-foreground">{item.warehouseName}</div>
                    </div>
                    <div className="text-right">
                      <div>On hand: {item.onHand}</div>
                      <div className="text-xs text-muted-foreground">Reserved: {item.reserved}</div>
                    </div>
                  </div>
                ))}
                {product.variants.every(v => v.stock_by_warehouse.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">No stock records found.</div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}