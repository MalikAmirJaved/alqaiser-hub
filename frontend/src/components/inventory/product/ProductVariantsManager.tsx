// src/components/inventory/product/ProductVariantsManager.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Copy, ChevronDown, ChevronUp, X, Package } from "lucide-react";

interface Variant {
  id?: string;
  sku: string;
  barcode?: string;
  attribute_combination: Record<string, string>;
  cost_price: number;
  selling_price: number;
  special_price?: number;
  main_image?: string;
  status: string;
}

interface ProductVariantsManagerProps {
  product: any;
  variants: Variant[];
  onChange: (variants: Variant[]) => void;
}

export default function ProductVariantsManager({ product, variants, onChange }: ProductVariantsManagerProps) {
  const [attributeDefinitions] = useState<Record<string, string[]>>({
    Color: ["Red", "Blue", "Green", "Black", "White"],
    Size: ["XS", "S", "M", "L", "XL"],
    Material: ["Cotton", "Polyester", "Wool"],
  });
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string[]>>({});
  const [generating, setGenerating] = useState(false);
  const [expandedVariant, setExpandedVariant] = useState<string | null>(null);

  const generateCombinations = () => {
    const attributeNames = Object.keys(selectedAttributes);
    const attributeValues = attributeNames.map(name => selectedAttributes[name]);
    const combinations = cartesianProduct(attributeNames, attributeValues);
    setGenerating(true);
    const newVariants: Variant[] = [];
    const baseSKU = product.sku;
    combinations.forEach(combo => {
      const attributeStr = Object.values(combo).join("-");
      const variantSKU = `${baseSKU}-${attributeStr}`.toUpperCase();
      if (!variants.some(v => JSON.stringify(v.attribute_combination) === JSON.stringify(combo))) {
        newVariants.push({
          sku: variantSKU,
          attribute_combination: combo,
          cost_price: product.cost_price || 0,
          selling_price: product.selling_price || 0,
          status: "active",
        });
      }
    });
    if (newVariants.length) onChange([...variants, ...newVariants]);
    setGenerating(false);
  };

  const updateVariant = (index: number, updates: Partial<Variant>) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], ...updates };
    onChange(newVariants);
  };

  const deleteVariant = (index: number) => {
    if (confirm("Delete this variant?")) onChange(variants.filter((_, i) => i !== index));
  };

  const duplicateVariant = (index: number) => {
    const variant = variants[index];
    onChange([...variants, { ...variant, sku: `${variant.sku}-COPY` }]);
  };

  const toggleAttributeSelection = (attrName: string, option: string) => {
    setSelectedAttributes(prev => {
      const current = prev[attrName] || [];
      const updated = current.includes(option) ? current.filter(o => o !== option) : [...current, option];
      if (updated.length === 0) { const { [attrName]: _, ...rest } = prev; return rest; }
      return { ...prev, [attrName]: updated };
    });
  };

  const getVariantDisplayName = (variant: Variant) => Object.entries(variant.attribute_combination).map(([k, v]) => `${k}: ${v}`).join(" | ");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Generate Variants from Attributes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="standard">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="standard">Standard Attributes</TabsTrigger>
              <TabsTrigger value="custom">Custom Attributes</TabsTrigger>
            </TabsList>
            <TabsContent value="standard" className="space-y-4 pt-4">
              {Object.entries(attributeDefinitions).map(([attrName, options]) => (
                <div key={attrName}>
                  <Label className="text-sm font-medium mb-2 block">{attrName}</Label>
                  <div className="flex flex-wrap gap-2">
                    {options.map(opt => (
                      <Badge key={opt} variant={selectedAttributes[attrName]?.includes(opt) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleAttributeSelection(attrName, opt)}>
                        {opt}{selectedAttributes[attrName]?.includes(opt) && <X className="w-3 h-3 ml-1" />}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="custom" className="pt-4">
              <p className="text-sm text-muted-foreground">Custom attributes can be added via the settings page.</p>
            </TabsContent>
          </Tabs>
          <Button onClick={generateCombinations} disabled={Object.keys(selectedAttributes).length === 0 || generating} className="w-full">
            {generating ? "Generating..." : `Generate Variants (${Object.values(selectedAttributes).reduce((a, b) => a * b.length, 1)} combinations)`}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div><h3 className="font-medium">Product Variants</h3><p className="text-xs text-muted-foreground">{variants.length} variant(s)</p></div>
          <Button size="sm" variant="outline" onClick={() => onChange([...variants, { sku: `${product.sku}-VAR${variants.length+1}`, attribute_combination: {}, cost_price: product.cost_price, selling_price: product.selling_price, status: "active" }])}>
            <Plus className="w-4 h-4 mr-1" /> Add Manual
          </Button>
        </div>
        {variants.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg"><Package className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No variants yet</p></div>
        ) : (
          variants.map((variant, idx) => (
            <Card key={idx} className="overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30" onClick={() => setExpandedVariant(expandedVariant === String(idx) ? null : String(idx))}>
                <div className="flex items-center gap-3">
                  {expandedVariant === String(idx) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <div><div className="font-medium">{Object.keys(variant.attribute_combination).length ? getVariantDisplayName(variant) : `Variant ${idx+1}`}</div><div className="text-xs font-mono text-muted-foreground">SKU: {variant.sku}</div></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right"><div className="font-medium text-success">${variant.selling_price?.toFixed(2)}</div><div className="text-xs text-muted-foreground line-through">${variant.cost_price?.toFixed(2)}</div></div>
                  <Badge variant={variant.status === "active" ? "default" : "secondary"}>{variant.status}</Badge>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); duplicateVariant(idx); }} className="h-8 w-8"><Copy className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteVariant(idx); }} className="h-8 w-8 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </div>
              {expandedVariant === String(idx) && (
                <div className="border-t p-4 bg-muted/5">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div><Label className="text-xs">SKU</Label><Input value={variant.sku} onChange={(e) => updateVariant(idx, { sku: e.target.value.toUpperCase() })} className="mt-1 h-8" /></div>
                    <div><Label className="text-xs">Barcode</Label><Input value={variant.barcode || ""} onChange={(e) => updateVariant(idx, { barcode: e.target.value })} className="mt-1 h-8" /></div>
                    <div><Label className="text-xs">Cost Price</Label><Input type="number" step="0.01" value={variant.cost_price} onChange={(e) => updateVariant(idx, { cost_price: parseFloat(e.target.value) || 0 })} className="mt-1 h-8" /></div>
                    <div><Label className="text-xs">Selling Price</Label><Input type="number" step="0.01" value={variant.selling_price} onChange={(e) => updateVariant(idx, { selling_price: parseFloat(e.target.value) || 0 })} className="mt-1 h-8" /></div>
                    <div><Label className="text-xs">Status</Label><select value={variant.status} onChange={(e) => updateVariant(idx, { status: e.target.value })} className="w-full mt-1 h-8 rounded-md border border-border bg-background px-2"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function cartesianProduct(attributeNames: string[], attributeValues: string[][]): Record<string, string>[] {
  if (!attributeNames.length) return [];
  const result: Record<string, string>[] = [];
  function generate(current: Record<string, string>, depth: number) {
    if (depth === attributeNames.length) { result.push({ ...current }); return; }
    for (const value of attributeValues[depth]) { current[attributeNames[depth]] = value; generate(current, depth + 1); }
  }
  generate({}, 0);
  return result;
}