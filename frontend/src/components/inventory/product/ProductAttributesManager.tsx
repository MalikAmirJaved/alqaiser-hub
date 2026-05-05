// src/components/inventory/product/ProductAttributesManager.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, MoveUp, MoveDown, Save, Filter } from "lucide-react";
import { uid } from "@/services/localStorageService";
import { ls } from "@/services/localStorageService";

interface ProductAttribute {
  id: string;
  product_id: string;
  attribute_name: string;
  attribute_value: string;
  attribute_group: string;
  is_filterable: string;
  display_order: number;
}

interface ProductAttributesManagerProps {
  product: any;
  attributes: ProductAttribute[];
  onChange: (attributes: ProductAttribute[]) => void;
}

export default function ProductAttributesManager({ product, attributes, onChange }: ProductAttributesManagerProps) {
  const [attributeGroups, setAttributeGroups] = useState<{ id: string; name: string }[]>([]);
  const [newAttribute, setNewAttribute] = useState({
    attribute_name: "",
    attribute_value: "",
    attribute_group: "",
    is_filterable: "false"
  });
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkInput, setBulkInput] = useState("");

  useEffect(() => {
    const groups = ls.get("attributeGroups", []);
    setAttributeGroups(groups);
  }, []);

  const addAttribute = () => {
    if (!newAttribute.attribute_name || !newAttribute.attribute_value) return;
    
    const attribute: ProductAttribute = {
      id: uid("pa"),
      product_id: product.id,
      ...newAttribute,
      display_order: attributes.length,
      created_at: new Date().toISOString(),
      created_by: ls.get("session")?.id
    };
    
    onChange([...attributes, attribute]);
    setNewAttribute({
      attribute_name: "",
      attribute_value: "",
      attribute_group: "",
      is_filterable: "false"
    });
  };

  const addBulkAttributes = () => {
    const lines = bulkInput.split("\n");
    const newAttributes: ProductAttribute[] = [];
    
    lines.forEach(line => {
      const [name, value, group = "", filterable = "false"] = line.split(",").map(s => s.trim());
      if (name && value) {
        newAttributes.push({
          id: uid("pa"),
          product_id: product.id,
          attribute_name: name,
          attribute_value: value,
          attribute_group: group,
          is_filterable: filterable === "true" ? "true" : "false",
          display_order: attributes.length + newAttributes.length,
          created_at: new Date().toISOString(),
          created_by: ls.get("session")?.id
        });
      }
    });
    
    if (newAttributes.length > 0) {
      onChange([...attributes, ...newAttributes]);
    }
    setBulkInput("");
    setShowBulkAdd(false);
  };

  const updateAttribute = (id: string, updates: Partial<ProductAttribute>) => {
    onChange(attributes.map(attr => attr.id === id ? { ...attr, ...updates } : attr));
  };

  const deleteAttribute = (id: string) => {
    if (confirm("Delete this attribute?")) {
      const remaining = attributes.filter(attr => attr.id !== id);
      remaining.forEach((attr, idx) => {
        attr.display_order = idx;
      });
      onChange(remaining);
    }
  };

  const moveAttribute = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= attributes.length) return;
    
    const newAttributes = [...attributes];
    [newAttributes[index], newAttributes[newIndex]] = [newAttributes[newIndex], newAttributes[index]];
    
    newAttributes.forEach((attr, idx) => {
      attr.display_order = idx;
    });
    
    onChange(newAttributes);
  };

  const groupedAttributes = attributes.reduce((acc, attr) => {
    const group = attr.attribute_group || "General Specifications";
    if (!acc[group]) acc[group] = [];
    acc[group].push(attr);
    return acc;
  }, {} as Record<string, ProductAttribute[]>);

  const sortedGroups = Object.keys(groupedAttributes).sort((a, b) => {
    const aOrder = groupedAttributes[a][0]?.display_order || 0;
    const bOrder = groupedAttributes[b][0]?.display_order || 0;
    return aOrder - bOrder;
  });

  return (
    <div className="space-y-6">
      {/* Add New Attribute Form */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base">Add New Attribute</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowBulkAdd(!showBulkAdd)}>
              {showBulkAdd ? "Single Entry" : "Bulk Import"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!showBulkAdd ? (
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-4">
                <Label className="text-xs">Attribute Name</Label>
                <Input
                  value={newAttribute.attribute_name}
                  onChange={(e) => setNewAttribute({ ...newAttribute, attribute_name: e.target.value })}
                  placeholder="e.g., Material, Weight"
                  className="mt-1"
                />
              </div>
              <div className="col-span-4">
                <Label className="text-xs">Attribute Value</Label>
                <Input
                  value={newAttribute.attribute_value}
                  onChange={(e) => setNewAttribute({ ...newAttribute, attribute_value: e.target.value })}
                  placeholder="e.g., Stainless Steel"
                  className="mt-1"
                />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Attribute Group</Label>
                <Select
                  value={newAttribute.attribute_group || "none"}
                  onValueChange={(val) => setNewAttribute({ ...newAttribute, attribute_group: val === "none" ? "" : val })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Group</SelectItem>
                    {attributeGroups.map(group => (
                      <SelectItem key={group.id} value={group.name}>{group.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 flex items-end">
                <Button onClick={addAttribute} className="w-full">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Bulk Import (CSV format)</Label>
                <textarea
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="name,value,group,filterable&#10;Material,Steel,Technical,true&#10;Weight,2kg,Technical,false&#10;Warranty,2 Years,Warranty,true"
                  rows={6}
                  className="w-full mt-1 p-2 rounded-md border border-border bg-background text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Format: attribute_name, attribute_value, attribute_group (optional), is_filterable (optional)
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={addBulkAttributes} variant="default" size="sm">
                  Import Attributes
                </Button>
                <Button onClick={() => setShowBulkAdd(false)} variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attributes List Grouped */}
      {attributes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-lg">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/30 flex items-center justify-center">
            <Filter className="w-6 h-6 opacity-30" />
          </div>
          <p>No attributes added yet</p>
          <p className="text-sm">Add specifications like material, dimensions, warranty, etc.</p>
        </div>
      ) : (
        sortedGroups.map(groupName => (
          <div key={groupName} className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full"></span>
              {groupName}
              <Badge variant="outline" className="text-xs">{groupedAttributes[groupName].length}</Badge>
            </h4>
            <div className="space-y-2">
              {groupedAttributes[groupName].map((attr, idx) => {
                const globalIndex = attributes.findIndex(a => a.id === attr.id);
                return (
                  <div key={attr.id} className="flex items-center gap-3 p-3 bg-muted/5 rounded-lg border border-border hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <button
                        onClick={() => moveAttribute(globalIndex, "up")}
                        disabled={globalIndex === 0}
                        className="p-1 rounded hover:bg-muted disabled:opacity-30 transition"
                      >
                        <MoveUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => moveAttribute(globalIndex, "down")}
                        disabled={globalIndex === attributes.length - 1}
                        className="p-1 rounded hover:bg-muted disabled:opacity-30 transition"
                      >
                        <MoveDown className="w-3 h-3" />
                      </button>
                      <GripVertical className="w-3 h-3 cursor-move" />
                    </div>
                    
                    <div className="flex-1 grid grid-cols-12 gap-3">
                      <Input
                        value={attr.attribute_name}
                        onChange={(e) => updateAttribute(attr.id, { attribute_name: e.target.value })}
                        className="col-span-4 h-8 text-sm bg-background"
                      />
                      <Input
                        value={attr.attribute_value}
                        onChange={(e) => updateAttribute(attr.id, { attribute_value: e.target.value })}
                        className="col-span-4 h-8 text-sm bg-background"
                      />
                      <select
                        value={attr.attribute_group || ""}
                        onChange={(e) => updateAttribute(attr.id, { attribute_group: e.target.value })}
                        className="col-span-2 h-8 rounded-md border border-border bg-background px-2 text-sm"
                      >
                        <option value="">No Group</option>
                        {attributeGroups.map(group => (
                          <option key={group.id} value={group.name}>{group.name}</option>
                        ))}
                      </select>
                      <div className="col-span-1 flex items-center">
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={attr.is_filterable === "true"}
                            onChange={(e) => updateAttribute(attr.id, { is_filterable: e.target.checked ? "true" : "false" })}
                            className="rounded border-border"
                          />
                          <span className="text-muted-foreground">Filter</span>
                        </label>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          onClick={() => deleteAttribute(attr.id)}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Attribute Statistics */}
      {attributes.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="text-sm font-medium mb-3">Attribute Statistics</h4>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="p-2 bg-muted/20 rounded-lg">
                <div className="text-xl font-bold text-primary">{attributes.length}</div>
                <div className="text-xs text-muted-foreground">Total Attributes</div>
              </div>
              <div className="p-2 bg-muted/20 rounded-lg">
                <div className="text-xl font-bold text-info">{Object.keys(groupedAttributes).length}</div>
                <div className="text-xs text-muted-foreground">Groups</div>
              </div>
              <div className="p-2 bg-muted/20 rounded-lg">
                <div className="text-xl font-bold text-success">
                  {attributes.filter(a => a.is_filterable === "true").length}
                </div>
                <div className="text-xs text-muted-foreground">Filterable</div>
              </div>
              <div className="p-2 bg-muted/20 rounded-lg">
                <button
                  onClick={() => {
                    const confirmReset = confirm("Reset all attribute groups? This will set all attributes to 'No Group'.");
                    if (confirmReset) {
                      attributes.forEach(attr => {
                        updateAttribute(attr.id, { attribute_group: "" });
                      });
                    }
                  }}
                  className="text-xs text-destructive hover:underline"
                >
                  Reset Groups
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <div className="bg-muted/20 rounded-lg p-3 text-sm border border-border">
        <p className="text-muted-foreground">
          📋 <strong>Attributes vs Variants:</strong> Attributes are specifications (like "Material: Steel"), while 
          Variants are purchasable options (like "Size: Large, Color: Red"). Use attributes for product details, 
          variants for sellable combinations.
        </p>
      </div>
    </div>
  );
}