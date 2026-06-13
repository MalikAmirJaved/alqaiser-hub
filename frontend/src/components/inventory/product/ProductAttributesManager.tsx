// src/components/inventory/product/ProductAttributesManager.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, MoveUp, MoveDown, GripVertical } from "lucide-react";

interface ProductAttribute {
  id?: string;
  attribute_name: string;
  attribute_value: string;
  attribute_group: string;
  is_filterable: boolean;
  display_order: number;
}

interface ProductAttributesManagerProps {
  product: any;
  attributes: ProductAttribute[];
  onChange: (attributes: ProductAttribute[]) => void;
}

export default function ProductAttributesManager({ attributes, onChange }: ProductAttributesManagerProps) {
  const [newAttr, setNewAttr] = useState({ attribute_name: "", attribute_value: "", attribute_group: "", is_filterable: false });

  const addAttribute = () => {
    if (!newAttr.attribute_name || !newAttr.attribute_value) return;
    const newId = `attr_${Date.now()}_${Math.random()}`;
    onChange([...attributes, { ...newAttr, id: newId, display_order: attributes.length }]);
    setNewAttr({ attribute_name: "", attribute_value: "", attribute_group: "", is_filterable: false });
  };

  const updateAttribute = (index: number, updates: Partial<ProductAttribute>) => {
    const newAttrs = [...attributes];
    newAttrs[index] = { ...newAttrs[index], ...updates };
    onChange(newAttrs);
  };

  const deleteAttribute = (index: number) => {
    const newAttrs = attributes.filter((_, i) => i !== index);
    newAttrs.forEach((a, i) => a.display_order = i);
    onChange(newAttrs);
  };

  const moveAttribute = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= attributes.length) return;
    const newAttrs = [...attributes];
    [newAttrs[index], newAttrs[newIndex]] = [newAttrs[newIndex], newAttrs[index]];
    newAttrs.forEach((a, i) => a.display_order = i);
    onChange(newAttrs);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4"><Label className="text-xs">Name</Label><Input value={newAttr.attribute_name} onChange={(e) => setNewAttr({...newAttr, attribute_name: e.target.value})} placeholder="e.g., Material" className="mt-1" /></div>
            <div className="col-span-4"><Label className="text-xs">Value</Label><Input value={newAttr.attribute_value} onChange={(e) => setNewAttr({...newAttr, attribute_value: e.target.value})} placeholder="e.g., Steel" className="mt-1" /></div>
            <div className="col-span-3"><Label className="text-xs">Group</Label><Input value={newAttr.attribute_group} onChange={(e) => setNewAttr({...newAttr, attribute_group: e.target.value})} placeholder="Optional" className="mt-1" /></div>
            <div className="col-span-1 flex items-end"><Button onClick={addAttribute}><Plus className="w-4 h-4" /></Button></div>
          </div>
        </CardContent>
      </Card>

      {attributes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg"><p>No attributes added yet</p></div>
      ) : (
        <div className="space-y-2">
          {attributes.map((attr, idx) => (
            <div key={attr.id} className="flex items-center gap-3 p-3 bg-muted/5 rounded-lg border">
              <div className="flex items-center gap-1">
                <button onClick={() => moveAttribute(idx, "up")} disabled={idx === 0} className="p-1 rounded hover:bg-muted"><MoveUp className="w-3 h-3" /></button>
                <button onClick={() => moveAttribute(idx, "down")} disabled={idx === attributes.length-1} className="p-1 rounded hover:bg-muted"><MoveDown className="w-3 h-3" /></button>
                <GripVertical className="w-3 h-3 text-muted-foreground" />
              </div>
              <div className="flex-1 grid grid-cols-12 gap-3">
                <Input value={attr.attribute_name} onChange={(e) => updateAttribute(idx, { attribute_name: e.target.value })} className="col-span-4 h-8" />
                <Input value={attr.attribute_value} onChange={(e) => updateAttribute(idx, { attribute_value: e.target.value })} className="col-span-4 h-8" />
                <Input value={attr.attribute_group || ""} onChange={(e) => updateAttribute(idx, { attribute_group: e.target.value })} className="col-span-3 h-8" placeholder="Group" />
                <div className="col-span-1 flex items-center"><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={attr.is_filterable} onChange={(e) => updateAttribute(idx, { is_filterable: e.target.checked })} /> Filter</label></div>
              </div>
              <button onClick={() => deleteAttribute(idx)} className="text-destructive"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}