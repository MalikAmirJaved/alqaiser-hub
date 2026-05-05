// src/components/inventory/product/ProductVariantsManager.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Copy, ChevronDown, ChevronUp, X, Check, Package } from "lucide-react";
import { uid } from "@/services/localStorageService";
import { ls } from "@/services/localStorageService";

interface Variant {
  id: string;
  product_id: string;
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
  const [attributeDefinitions, setAttributeDefinitions] = useState<Record<string, string[]>>({
    Color: ["Red", "Blue", "Green", "Black", "White", "Yellow", "Purple", "Orange"],
    Size: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
    Material: ["Cotton", "Polyester", "Wool", "Leather", "Silk", "Nylon"],
    Style: ["Casual", "Formal", "Sport", "Vintage", "Modern"]
  });
  
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string[]>>({});
  const [generating, setGenerating] = useState(false);
  const [expandedVariant, setExpandedVariant] = useState<string | null>(null);
  const [newAttributeName, setNewAttributeName] = useState("");
  const [newAttributeOptions, setNewAttributeOptions] = useState("");

  // Load attribute groups from settings
  useEffect(() => {
    const attrGroups = ls.get("attributeGroups", []);
    // You could load custom attribute definitions from here
  }, []);

  // Generate all combinations from selected attributes
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
      
      // Check if variant already exists
      const exists = variants.some(v => 
        JSON.stringify(v.attribute_combination) === JSON.stringify(combo)
      );
      
      if (!exists) {
        newVariants.push({
          id: uid("var"),
          product_id: product.id,
          sku: variantSKU,
          barcode: "",
          attribute_combination: combo,
          cost_price: product.cost_price || 0,
          selling_price: product.selling_price || 0,
          special_price: undefined,
          main_image: "",
          status: "active"
        });
      }
    });
    
    if (newVariants.length > 0) {
      onChange([...variants, ...newVariants]);
    }
    setGenerating(false);
  };

  const updateVariant = (variantId: string, updates: Partial<Variant>) => {
    onChange(variants.map(v => v.id === variantId ? { ...v, ...updates } : v));
  };

  const deleteVariant = (variantId: string) => {
    if (confirm("Delete this variant?")) {
      onChange(variants.filter(v => v.id !== variantId));
    }
  };

  const duplicateVariant = (variant: Variant) => {
    const newVariant = {
      ...variant,
      id: uid("var"),
      sku: `${variant.sku}-COPY`,
      created_at: new Date().toISOString()
    };
    onChange([...variants, newVariant]);
  };

  const addAttributeDefinition = () => {
    if (newAttributeName && newAttributeOptions) {
      const options = newAttributeOptions.split(",").map(s => s.trim());
      setAttributeDefinitions({
        ...attributeDefinitions,
        [newAttributeName]: options
      });
      setNewAttributeName("");
      setNewAttributeOptions("");
    }
  };

  const toggleAttributeSelection = (attrName: string, option: string) => {
    setSelectedAttributes(prev => {
      const current = prev[attrName] || [];
      const updated = current.includes(option)
        ? current.filter(o => o !== option)
        : [...current, option];
      
      if (updated.length === 0) {
        const { [attrName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [attrName]: updated };
    });
  };

  const getVariantDisplayName = (variant: Variant) => {
    return Object.entries(variant.attribute_combination)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
  };

  return (
    <div className="space-y-6">
      {/* Attribute Selector for Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate Variants from Attributes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="standard" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="standard">Standard Attributes</TabsTrigger>
              <TabsTrigger value="custom">Custom Attributes</TabsTrigger>
            </TabsList>
            
            <TabsContent value="standard" className="space-y-4 pt-4">
              <div className="space-y-3">
                {Object.entries(attributeDefinitions).map(([attrName, options]) => (
                  <div key={attrName}>
                    <Label className="text-sm font-medium mb-2 block">{attrName}</Label>
                    <div className="flex flex-wrap gap-2">
                      {options.map(opt => (
                        <Badge
                          key={opt}
                          variant={selectedAttributes[attrName]?.includes(opt) ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80 transition-all"
                          onClick={() => toggleAttributeSelection(attrName, opt)}
                        >
                          {opt}
                          {selectedAttributes[attrName]?.includes(opt) && (
                            <X className="w-3 h-3 ml-1" />
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="custom" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Attribute Name</Label>
                  <Input
                    value={newAttributeName}
                    onChange={(e) => setNewAttributeName(e.target.value)}
                    placeholder="e.g., Finish"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Options (comma-separated)</Label>
                  <Input
                    value={newAttributeOptions}
                    onChange={(e) => setNewAttributeOptions(e.target.value)}
                    placeholder="e.g., Matte, Glossy, Satin"
                    className="mt-1"
                  />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={addAttributeDefinition} className="w-full">
                <Plus className="w-4 h-4 mr-1" /> Add Custom Attribute
              </Button>
            </TabsContent>
          </Tabs>
          
          <Button
            onClick={generateCombinations}
            disabled={Object.keys(selectedAttributes).length === 0 || generating}
            className="w-full"
          >
            {generating ? "Generating..." : `Generate Variants (${Object.values(selectedAttributes).reduce((a, b) => a * b.length, 1)} combinations)`}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Variants List */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-medium">Product Variants</h3>
            <p className="text-xs text-muted-foreground">{variants.length} variant(s)</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const newVariant: Variant = {
                id: uid("var"),
                product_id: product.id,
                sku: `${product.sku}-VAR${variants.length + 1}`,
                attribute_combination: {},
                cost_price: product.cost_price || 0,
                selling_price: product.selling_price || 0,
                status: "active"
              };
              onChange([...variants, newVariant]);
              setExpandedVariant(newVariant.id);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Manual
          </Button>
        </div>

        {variants.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-lg">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No variants yet</p>
            <p className="text-sm">Select attributes above and click "Generate Variants"</p>
          </div>
        ) : (
          variants.map((variant, idx) => (
            <Card key={variant.id} className="overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedVariant(expandedVariant === variant.id ? null : variant.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedVariant === variant.id ? 
                    <ChevronUp className="w-4 h-4 text-muted-foreground" /> : 
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  }
                  <div>
                    <div className="font-medium">
                      {Object.keys(variant.attribute_combination).length > 0 
                        ? getVariantDisplayName(variant)
                        : `Variant ${idx + 1}`}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      SKU: {variant.sku}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-medium text-success">
                      ${variant.selling_price?.toFixed(2)}
                    </div>
                    {variant.cost_price !== variant.selling_price && (
                      <div className="text-xs text-muted-foreground line-through">
                        ${variant.cost_price?.toFixed(2)}
                      </div>
                    )}
                  </div>
                  <Badge variant={variant.status === "active" ? "default" : "secondary"}>
                    {variant.status}
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); duplicateVariant(variant); }}
                      className="h-8 w-8"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); deleteVariant(variant.id); }}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {expandedVariant === variant.id && (
                <div className="border-t border-border p-4 bg-muted/5">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs">SKU</Label>
                      <Input
                        value={variant.sku}
                        onChange={(e) => updateVariant(variant.id, { sku: e.target.value.toUpperCase() })}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Barcode</Label>
                      <Input
                        value={variant.barcode || ""}
                        onChange={(e) => updateVariant(variant.id, { barcode: e.target.value })}
                        className="mt-1 h-8 text-sm"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cost Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variant.cost_price}
                        onChange={(e) => updateVariant(variant.id, { cost_price: parseFloat(e.target.value) || 0 })}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Selling Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variant.selling_price}
                        onChange={(e) => updateVariant(variant.id, { selling_price: parseFloat(e.target.value) || 0 })}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Special Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variant.special_price || ""}
                        onChange={(e) => updateVariant(variant.id, { special_price: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="mt-1 h-8 text-sm"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <select
                        value={variant.status}
                        onChange={(e) => updateVariant(variant.id, { status: e.target.value })}
                        className="w-full mt-1 h-8 rounded-md border border-border bg-background px-2 text-sm"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Variant Image URL</Label>
                      <Input
                        value={variant.main_image || ""}
                        onChange={(e) => updateVariant(variant.id, { main_image: e.target.value })}
                        className="mt-1 h-8 text-sm"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  
                  {/* Attribute Combination Display */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <Label className="text-xs mb-2 block">Attribute Combination</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(variant.attribute_combination).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="gap-1">
                          {key}: {value}
                          <button
                            onClick={() => {
                              const newCombo = { ...variant.attribute_combination };
                              delete newCombo[key];
                              updateVariant(variant.id, { attribute_combination: newCombo });
                            }}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={() => {
                          const attrName = prompt("Enter attribute name (e.g., Size):");
                          if (attrName) {
                            const attrValue = prompt(`Enter value for ${attrName}:`);
                            if (attrValue) {
                              updateVariant(variant.id, {
                                attribute_combination: {
                                  ...variant.attribute_combination,
                                  [attrName]: attrValue
                                }
                              });
                            }
                          }
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Attribute
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Info Box */}
      <div className="bg-info/10 border border-info/20 rounded-lg p-3 text-sm">
        <p className="text-info-foreground">
          💡 <strong>Variant Tips:</strong> Variants share inventory tracking separately. Each variant has its own SKU, price, and stock level. 
          Use attributes like Size, Color, Material to create product variations.
        </p>
      </div>
    </div>
  );
}

// Helper: Cartesian product generator
function cartesianProduct(attributeNames: string[], attributeValues: string[][]): Record<string, string>[] {
  if (attributeNames.length === 0) return [];
  
  const result: Record<string, string>[] = [];
  
  function generate(current: Record<string, string>, depth: number) {
    if (depth === attributeNames.length) {
      result.push({ ...current });
      return;
    }
    
    for (const value of attributeValues[depth]) {
      current[attributeNames[depth]] = value;
      generate(current, depth + 1);
    }
  }
  
  generate({}, 0);
  return result;
}