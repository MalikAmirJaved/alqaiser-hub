// src/components/inventory/product/ProductDetailsModal.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Edit, Package, Layers, Tag, Truck, ClipboardList } from "lucide-react";

export default function ProductDetailsModal({ 
  product, 
  variants, 
  inventory, 
  attributes, 
  tags, 
  warehouses = [],
  onClose, 
  onEdit 
}: {
  product: any;
  variants: any[];
  inventory: any[];
  attributes: any[];
  tags: any[];
  warehouses?: any[];
  onClose: () => void;
  onEdit: () => void;
}) {

  const [activeTab, setActiveTab] = useState("info");

  // Group attributes
  const groupedAttributes = attributes.reduce((acc: any, attr: any) => {
    const group = attr.attribute_group || "General";
    if (!acc[group]) acc[group] = [];
    acc[group].push(attr);
    return acc;
  }, {} as Record<string, any[]>);


  // Calculate total stock
  const totalStock = inventory.reduce((sum, i) => sum + i.stock_quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl bg-card rounded-2xl shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex gap-4">
            {product.main_image && (
              <img src={product.main_image} alt={product.name} className="w-20 h-20 rounded-lg object-cover" />
            )}
            <div>
              <h2 className="text-xl font-semibold">{product.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs text-muted-foreground">SKU: {product.sku}</span>
                {product.barcode && <span className="text-xs text-muted-foreground">| EAN: {product.barcode}</span>}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                  product.status === "active" ? "bg-success/15 text-success" :
                  product.status === "draft" ? "bg-warning/15 text-warning" : "bg-muted/40"
                }`}>
                  {product.status}
                </span>
                {tags.map(tag => (
                  <span key={tag.id} className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                    #{tag.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="px-6 pt-2 border-b border-border justify-start gap-1 bg-transparent">
            <TabsTrigger value="info">📝 Product Info</TabsTrigger>
            <TabsTrigger value="attributes">⚙️ Attributes</TabsTrigger>
            {variants.length > 0 && <TabsTrigger value="variants">🎨 Variants</TabsTrigger>}
            <TabsTrigger value="inventory">📦 Inventory</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Product Info Tab */}
            <TabsContent value="info" className="m-0 space-y-4">
              {product.short_description && (
                <div>
                  <h4 className="font-medium mb-1">Short Description</h4>
                  <p className="text-sm text-muted-foreground">{product.short_description}</p>
                </div>
              )}
              {product.description && (
                <div>
                  <h4 className="font-medium mb-1">Full Description</h4>
                  <div className="text-sm whitespace-pre-wrap">{product.description}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-muted/20 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Category</div>
                  <div className="font-medium">{product.category_name || "—"}</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Brand</div>
                  <div className="font-medium">{product.brand_name || "—"}</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Unit of Measure</div>
                  <div className="font-medium">{product.unit_of_measure || "PCS"}</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Product Type</div>
                  <div className="font-medium capitalize">{product.product_type}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-success/10 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Selling Price</div>
                  <div className="text-2xl font-bold text-success">${product.selling_price?.toFixed(2)}</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Cost Price</div>
                  <div className="font-medium">${product.cost_price?.toFixed(2)}</div>
                </div>
              </div>
            </TabsContent>

            {/* Attributes Tab */}
            <TabsContent value="attributes" className="m-0">
              {Object.keys(groupedAttributes).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No attributes defined for this product</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedAttributes).map(([groupName, groupAttrs]: [string, any]) => (

                    <div key={groupName}>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">{groupName}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {(groupAttrs as any[]).map((attr: any) => (

                          <div key={attr.id} className="flex justify-between py-2 border-b border-border">
                            <span className="text-sm font-medium">{attr.attribute_name}</span>
                            <span className="text-sm text-muted-foreground">{attr.attribute_value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Variants Tab */}
            {variants.length > 0 && (
              <TabsContent value="variants" className="m-0">
                <div className="space-y-3">
                  {variants.map(variant => {
                    const variantInventory = inventory.filter(i => i.variant_id === variant.id);
                    const variantStock = variantInventory.reduce((sum, i) => sum + i.stock_quantity, 0);
                    
                    return (
                      <div key={variant.id} className="p-4 bg-muted/10 rounded-lg border border-border">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">
                              {Object.entries(variant.attribute_combination || {}).map(([k, v]: [string, any]) => `${k}: ${v}`).join(" | ")}

                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              SKU: {variant.sku}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-success">${variant.selling_price?.toFixed(2)}</div>
                            <div className="text-sm text-muted-foreground">Stock: {variantStock}</div>
                          </div>
                        </div>
                        {variantInventory.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="text-xs text-muted-foreground mb-2">Warehouse Distribution:</div>
                            <div className="flex flex-wrap gap-2">
                              {variantInventory.map(rec => {
                                const warehouse = warehouses?.find(w => w.id === rec.warehouse_id);
                                return (
                                  <span key={rec.id} className="px-2 py-1 text-xs rounded bg-muted/40">
                                    {warehouse?.name || rec.warehouse_id}: {rec.stock_quantity}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            )}

            {/* Inventory Tab */}
            <TabsContent value="inventory" className="m-0">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-muted/20 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{totalStock}</div>
                  <div className="text-xs text-muted-foreground">Total Stock</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-warning">
                    {inventory.reduce((sum, i) => sum + (i.reserved_quantity || 0), 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Reserved</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-success">
                    {inventory.reduce((sum, i) => sum + (i.available_quantity || 0), 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Available</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium">Warehouse Details</h4>
                {inventory.map(record => {
                  const warehouse = warehouses?.find(w => w.id === record.warehouse_id);
                  return (
                    <div key={record.id} className="p-3 bg-muted/10 rounded-lg">
                      <div className="flex justify-between">
                        <div>
                          <div className="font-medium">{warehouse?.name || record.warehouse_id}</div>
                          {record.location_bin && (
                            <div className="text-xs text-muted-foreground">Bin: {record.location_bin}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div>Stock: {record.stock_quantity}</div>
                          {record.reorder_point && (
                            <div className="text-xs text-muted-foreground">Reorder at: {record.reorder_point}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}