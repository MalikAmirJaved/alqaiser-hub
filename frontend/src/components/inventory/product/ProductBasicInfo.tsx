// src/components/inventory/product/ProductBasicInfo.tsx
"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { ls } from "@/services/localStorageService";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

interface ProductBasicInfoProps {
  product: any;
  onChange: (product: any) => void;
  errors?: Record<string, string>;
}

export default function ProductBasicInfo({ product, onChange, errors = {} }: ProductBasicInfoProps) {
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [brands, setBrands] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    const cats = ls.get<any[]>("categories", []) || [];
    setCategories(cats.map((c: any) => ({ value: c.id, label: `${c.name} (${c.code})` })));
    
    const brs = ls.get<any[]>("brands", []) || [];
    setBrands(brs.map((b: any) => ({ value: b.id, label: `${b.name} (${b.code})` })));
  }, []);

  const updateField = (key: string, value: any) => {
    onChange({ ...product, [key]: value });
  };

  return (
    <div className="space-y-6">
      {/* SKU and Barcode Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">
            SKU <span className="text-destructive">*</span>
          </Label>
          <Input
            value={product.sku || ""}
            onChange={(e) => updateField("sku", e.target.value.toUpperCase())}
            placeholder="Unique product SKU"
            className={errors.sku ? "border-destructive" : ""}
          />
          {errors.sku && (
            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" /> {errors.sku}
            </p>
          )}
        </div>
        
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Barcode / EAN</Label>
          <Input
            value={product.barcode || ""}
            onChange={(e) => updateField("barcode", e.target.value)}
            placeholder="Barcode number"
          />
        </div>
      </div>

      {/* Product Name */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          Product Name <span className="text-destructive">*</span>
        </Label>
        <Input
          value={product.name || ""}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="Enter product name"
          className={errors.name ? "border-destructive" : ""}
        />
        {errors.name && (
          <p className="text-xs text-destructive flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3" /> {errors.name}
          </p>
        )}
      </div>

      {/* Category and Brand Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">
            Category <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            value={product.category_id || ""}
            onChange={(val) => updateField("category_id", val)}
            options={categories}
            placeholder="Select category"
          />
          {errors.category && (
            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" /> {errors.category}
            </p>
          )}
        </div>
        
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Brand</Label>
          <SearchableSelect
            value={product.brand_id || ""}
            onChange={(val) => updateField("brand_id", val)}
            options={brands}
            placeholder="Select brand"
          />
        </div>
      </div>

      {/* Product Type and Unit of Measure */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Product Type</Label>
          <Select
            value={product.product_type || "simple"}
            onValueChange={(val) => updateField("product_type", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select product type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">Simple Product</SelectItem>
              <SelectItem value="variable">Variable Product (with variants)</SelectItem>
              <SelectItem value="bundle">Bundle Product</SelectItem>
              <SelectItem value="digital">Digital Product</SelectItem>
              <SelectItem value="service">Service</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Unit of Measure</Label>
          <Select
            value={product.unit_of_measure || "PCS"}
            onValueChange={(val) => updateField("unit_of_measure", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PCS">Pieces (PCS)</SelectItem>
              <SelectItem value="KG">Kilograms (KG)</SelectItem>
              <SelectItem value="LTR">Liters (LTR)</SelectItem>
              <SelectItem value="MTR">Meters (MTR)</SelectItem>
              <SelectItem value="BOX">Box (BOX)</SelectItem>
              <SelectItem value="SET">Set (SET)</SelectItem>
              <SelectItem value="PAIR">Pair (PAIR)</SelectItem>
              <SelectItem value="DOZEN">Dozen (DOZEN)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Short Description */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Short Description</Label>
        <Textarea
          value={product.short_description || ""}
          onChange={(e) => updateField("short_description", e.target.value)}
          rows={2}
          placeholder="Brief description for listings (150-200 characters)"
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          {product.short_description?.length || 0}/200 characters
        </p>
      </div>

      {/* Full Description */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Full Description</Label>
        <Textarea
          value={product.description || ""}
          onChange={(e) => updateField("description", e.target.value)}
          rows={5}
          placeholder="Complete product details, features, specifications..."
          className="resize-none"
        />
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Status</Label>
        <Select
          value={product.status || "draft"}
          onValueChange={(val) => updateField("status", val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active - Available for sale</SelectItem>
            <SelectItem value="draft">Draft - Not yet published</SelectItem>
            <SelectItem value="archived">Archived - Hidden from store</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Info Box */}
      <div className="bg-muted/20 rounded-lg p-4 border border-border">
        <h4 className="text-sm font-medium mb-2">ℹ️ Product Information</h4>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>SKU must be unique across all products</li>
          <li>Select "Variable Product" to add size, color, or other variants</li>
          <li>Categories and brands can be managed in Settings</li>
          <li>Products with status "Active" will appear in POS and sales orders</li>
        </ul>
      </div>
    </div>
  );
}