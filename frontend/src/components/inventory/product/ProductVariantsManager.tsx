// src/components/inventory/product/ProductVariantsManager.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy, ChevronDown, ChevronUp, X, Package, Image as ImageIcon } from "lucide-react";
import { ProductVariantPayload } from "@/hooks/useProducts";

interface Variant extends ProductVariantPayload {
  id?: string; // temporary frontend ID
}

interface ProductVariantsManagerProps {
  variants: Variant[];
  onChange: (variants: Variant[]) => void;
  errors?: Record<string, string>;
  baseSkuHint?: string;
}

export default function ProductVariantsManager({ variants, onChange, errors = {}, baseSkuHint = "SKU" }: ProductVariantsManagerProps) {
  const [expandedVariant, setExpandedVariant] = useState<string | null>(null);
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrValue, setNewAttrValue] = useState("");
  const [currentVariantIndex, setCurrentVariantIndex] = useState<number | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");

  const addVariant = () => {
    const newId = `temp_${Date.now()}_${Math.random()}`;
    onChange([
      ...variants,
      {
        sku: `${baseSkuHint}-VAR${variants.length + 1}`,
        barcode: "",
        qrCode: "",
        buyingPrice: 0,
        sellingPrice: 0,
        minStockLevel: 0,
        maxStockLevel: 0,
        stock: 0,
        attributes: [],
        images: [],
        id: newId,
      },
    ]);
    setExpandedVariant(newId);
  };

  const updateVariant = (index: number, updates: Partial<Variant>) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], ...updates };
    onChange(newVariants);
  };

  const deleteVariant = (index: number) => {
    if (confirm("Delete this variant?")) {
      const newVariants = variants.filter((_, i) => i !== index);
      onChange(newVariants);
      if (expandedVariant === variants[index].id) setExpandedVariant(null);
    }
  };

  const duplicateVariant = (index: number) => {
    const original = variants[index];
    const newId = `temp_${Date.now()}_${Math.random()}`;
    const copy = {
      ...original,
      sku: `${original.sku}-COPY`,
      id: newId,
      attributes: original.attributes ? [...original.attributes] : [],
      images: original.images ? [...original.images] : [],
    };
    onChange([...variants, copy]);
    setExpandedVariant(newId);
  };

  const addAttribute = (variantIndex: number) => {
    if (!newAttrKey.trim() || !newAttrValue.trim()) return;
    const currentAttrs = variants[variantIndex].attributes || [];
    updateVariant(variantIndex, {
      attributes: [...currentAttrs, { key: newAttrKey.trim(), value: newAttrValue.trim() }],
    });
    setNewAttrKey("");
    setNewAttrValue("");
    setCurrentVariantIndex(null);
  };

  const removeAttribute = (variantIndex: number, attrIndex: number) => {
    const attrs = variants[variantIndex].attributes || [];
    const updated = attrs.filter((_, i) => i !== attrIndex);
    updateVariant(variantIndex, { attributes: updated });
  };

  const addImage = (variantIndex: number) => {
    if (!newImageUrl.trim()) return;
    const currentImages = variants[variantIndex].images || [];
    updateVariant(variantIndex, { images: [...currentImages, newImageUrl.trim()] });
    setNewImageUrl("");
    setCurrentVariantIndex(null);
  };

  const removeImage = (variantIndex: number, imgIndex: number) => {
    const images = variants[variantIndex].images || [];
    const updated = images.filter((_, i) => i !== imgIndex);
    updateVariant(variantIndex, { images: updated });
  };

  const getVariantDisplayName = (variant: Variant) => {
    if (!variant.attributes || variant.attributes.length === 0) return variant.sku;
    return variant.attributes.map(a => `${a.key}: ${a.value}`).join(" | ");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-medium">Product Variants</h3>
          <p className="text-xs text-muted-foreground">{variants.length} variant(s)</p>
        </div>
        <Button size="sm" onClick={addVariant}>
          <Plus className="w-4 h-4 mr-1" /> Add Variant
        </Button>
      </div>
      {errors.variants && <p className="text-xs text-destructive">{errors.variants}</p>}

      {variants.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No variants yet. Add at least one variant.</p>
        </div>
      ) : (
        variants.map((variant, idx) => (
          <Card key={variant.id || idx} className="overflow-hidden">
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
              onClick={() => setExpandedVariant(expandedVariant === (variant.id || String(idx)) ? null : (variant.id || String(idx)))}
            >
              <div className="flex items-center gap-3">
                {expandedVariant === (variant.id || String(idx)) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <div>
                  <div className="font-medium">{getVariantDisplayName(variant)}</div>
                  <div className="text-xs font-mono text-muted-foreground">SKU: {variant.sku}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-medium text-success">${variant.sellingPrice}</div>
                  <div className="text-xs text-muted-foreground line-through">${variant.buyingPrice}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); duplicateVariant(idx); }} className="h-8 w-8">
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteVariant(idx); }} className="h-8 w-8 text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {expandedVariant === (variant.id || String(idx)) && (
              <div className="border-t p-4 bg-muted/5 space-y-4">
                {/* Basic fields */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <Label className="text-xs">SKU *</Label>
                    <Input value={variant.sku} onChange={(e) => updateVariant(idx, { sku: e.target.value.toUpperCase() })} className="mt-1 h-8" />
                    {errors[`variant_${idx}_sku`] && <p className="text-xs text-destructive">{errors[`variant_${idx}_sku`]}</p>}
                  </div>
                  <div>
                    <Label className="text-xs">Barcode</Label>
                    <Input value={variant.barcode || ""} onChange={(e) => updateVariant(idx, { barcode: e.target.value })} className="mt-1 h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">QR Code URL</Label>
                    <Input value={variant.qrCode || ""} onChange={(e) => updateVariant(idx, { qrCode: e.target.value })} className="mt-1 h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Initial Stock</Label>
                    <Input type="number" value={variant.stock || 0} onChange={(e) => updateVariant(idx, { stock: parseInt(e.target.value) || 0 })} className="mt-1 h-8" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs">Buying Price</Label>
                    <Input type="number" step="0.01" value={variant.buyingPrice} onChange={(e) => updateVariant(idx, { buyingPrice: parseFloat(e.target.value) || 0 })} className="mt-1 h-8" />
                    {errors[`variant_${idx}_cost`] && <p className="text-xs text-destructive">{errors[`variant_${idx}_cost`]}</p>}
                  </div>
                  <div>
                    <Label className="text-xs">Selling Price *</Label>
                    <Input type="number" step="0.01" value={variant.sellingPrice} onChange={(e) => updateVariant(idx, { sellingPrice: parseFloat(e.target.value) || 0 })} className="mt-1 h-8" />
                    {errors[`variant_${idx}_price`] && <p className="text-xs text-destructive">{errors[`variant_${idx}_price`]}</p>}
                  </div>
                  <div>
                    <Label className="text-xs">Min Stock Level</Label>
                    <Input type="number" value={variant.minStockLevel || 0} onChange={(e) => updateVariant(idx, { minStockLevel: parseInt(e.target.value) || 0 })} className="mt-1 h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Max Stock Level</Label>
                    <Input type="number" value={variant.maxStockLevel || 0} onChange={(e) => updateVariant(idx, { maxStockLevel: parseInt(e.target.value) || 0 })} className="mt-1 h-8" />
                  </div>
                </div>

                {/* Attributes section */}
                <div>
                  <Label className="text-sm font-medium">Attributes</Label>
                  <div className="mt-2 space-y-2">
                    {variant.attributes && variant.attributes.map((attr, aIdx) => (
                      <div key={aIdx} className="flex items-center gap-2 bg-muted/20 p-2 rounded">
                        <span className="text-sm font-mono">{attr.key}:</span>
                        <span className="text-sm">{attr.value}</span>
                        <button onClick={() => removeAttribute(idx, aIdx)} className="ml-auto text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {currentVariantIndex === idx && (
                      <div className="flex gap-2 items-center">
                        <Input placeholder="Key (e.g., Color)" value={newAttrKey} onChange={(e) => setNewAttrKey(e.target.value)} className="h-8 w-32" />
                        <Input placeholder="Value (e.g., Red)" value={newAttrValue} onChange={(e) => setNewAttrValue(e.target.value)} className="h-8 w-32" />
                        <Button size="sm" onClick={() => addAttribute(idx)}>Add</Button>
                        <Button size="sm" variant="ghost" onClick={() => setCurrentVariantIndex(null)}>Cancel</Button>
                      </div>
                    )}
                    {currentVariantIndex !== idx && (
                      <Button size="sm" variant="outline" onClick={() => setCurrentVariantIndex(idx)}>
                        <Plus className="w-3 h-3 mr-1" /> Add Attribute
                      </Button>
                    )}
                  </div>
                </div>

                {/* Images section */}
                <div>
                  <Label className="text-sm font-medium">Images</Label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {variant.images && variant.images.map((imgUrl, imgIdx) => (
                      <div key={imgIdx} className="relative group w-16 h-16 rounded overflow-hidden border border-border">
                        <img src={imgUrl} alt={`Variant ${idx} image ${imgIdx}`} className="w-full h-full object-cover" />
                        <button onClick={() => removeImage(idx, imgIdx)} className="absolute top-0 right-0 bg-black/50 p-1 rounded-bl group-hover:opacity-100 opacity-0 transition">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    {currentVariantIndex === idx && newImageUrl !== undefined && (
                      <div className="flex gap-2 items-center">
                        <Input placeholder="Image URL" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} className="h-8 w-64" />
                        <Button size="sm" onClick={() => addImage(idx)}>Add</Button>
                        <Button size="sm" variant="ghost" onClick={() => setCurrentVariantIndex(null)}>Cancel</Button>
                      </div>
                    )}
                    {currentVariantIndex !== idx && (
                      <Button size="sm" variant="outline" onClick={() => setCurrentVariantIndex(idx)}>
                        <ImageIcon className="w-3 h-3 mr-1" /> Add Image
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}