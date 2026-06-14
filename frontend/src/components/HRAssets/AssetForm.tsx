// components/HRAssets/AssetForm.tsx
"use client";

import { useState, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AssetFormData {
  id?: string;
  name: string;
  brand: string;
  category: string;
  sku: string;
  description: string;
  initialStock: number;
}

interface AssetFormProps {
  initialData?: Partial<AssetFormData>;
  onSubmit: (data: AssetFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

function FieldWrapper({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}>{children}</div>;
}

export function AssetForm({ initialData, onSubmit, onCancel, isLoading }: AssetFormProps) {
  const isEditing = !!initialData?.id;

  const [formData, setFormData] = useState<AssetFormData>({
    name: "",
    brand: "",
    category: "",
    sku: "",
    description: "",
    initialStock: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        brand: initialData.brand || "",
        category: initialData.category || "",
        sku: initialData.sku || "",
        description: initialData.description || "",
        initialStock: initialData.initialStock || 0,
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Asset name is required";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <FieldWrapper>
        <Label htmlFor="name" className="text-sm font-medium">
          Asset Name <span className="text-destructive ml-1">*</span>
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Dell XPS 15, Logitech MX Master"
          className={cn(errors.name && "border-destructive")}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </FieldWrapper>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldWrapper>
          <Label htmlFor="brand" className="text-sm font-medium">Brand</Label>
          <Input
            id="brand"
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            placeholder="e.g., Dell, Logitech"
          />
        </FieldWrapper>

        <FieldWrapper>
          <Label htmlFor="category" className="text-sm font-medium">Category</Label>
          <Input
            id="category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="e.g., Laptop, Monitor"
          />
          <p className="text-xs text-muted-foreground">Used for grouping (e.g., Electronics, Furniture)</p>
        </FieldWrapper>
      </div>

      <FieldWrapper>
        <Label htmlFor="sku" className="text-sm font-medium">SKU / Serial Number</Label>
        <Input
          id="sku"
          value={formData.sku}
          onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
          placeholder="Unique identifier"
          className="font-mono"
        />
      </FieldWrapper>

      {!isEditing && (
        <FieldWrapper>
          <Label htmlFor="initialStock" className="text-sm font-medium">Initial Stock</Label>
          <Input
            id="initialStock"
            type="number"
            min="0"
            value={formData.initialStock}
            onChange={(e) => setFormData({ ...formData, initialStock: parseInt(e.target.value) || 0 })}
            placeholder="Quantity"
          />
          <p className="text-xs text-muted-foreground">Number of identical units (e.g., 5 monitors)</p>
        </FieldWrapper>
      )}

      <FieldWrapper>
        <Label htmlFor="description" className="text-sm font-medium">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Additional notes, specifications, etc."
          rows={3}
        />
      </FieldWrapper>

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />}
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? "Saving..." : isEditing ? "Update" : "Save"} Asset
        </Button>
      </div>
    </form>
  );
}
