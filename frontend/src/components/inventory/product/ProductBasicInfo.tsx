// src/components/inventory/product/ProductBasicInfo.tsx
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { Category } from "@/hooks/useCategories";
import { Brand } from "@/hooks/useBrands";

interface ProductBasicInfoProps {
  product: any;
  categories: Category[];
  brands: Brand[];
  onChange: (product: any) => void;
  errors?: Record<string, string>;
}

export default function ProductBasicInfo({ product, categories, brands, onChange, errors = {} }: ProductBasicInfoProps) {
  const categoryOptions = categories.map(c => ({ value: c.id, label: `${c.name} (${c.code})` }));
  const brandOptions = brands.map(b => ({ value: b.id, label: `${b.name} (${b.code})` }));

  const updateField = (key: string, value: any) => onChange({ ...product, [key]: value });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">SKU <span className="text-destructive">*</span></Label>
          <Input value={product.sku || ""} onChange={(e) => updateField("sku", e.target.value.toUpperCase())} className={errors.sku ? "border-destructive" : ""} />
          {errors.sku && <p className="text-xs text-destructive"><AlertCircle className="w-3 h-3 inline" /> {errors.sku}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Barcode</Label>
          <Input value={product.barcode || ""} onChange={(e) => updateField("barcode", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Product Name <span className="text-destructive">*</span></Label>
        <Input value={product.name || ""} onChange={(e) => updateField("name", e.target.value)} className={errors.name ? "border-destructive" : ""} />
        {errors.name && <p className="text-xs text-destructive"><AlertCircle className="w-3 h-3 inline" /> {errors.name}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Category <span className="text-destructive">*</span></Label>
          <SearchableSelect value={product.category_id || ""} onChange={(val) => updateField("category_id", val)} options={categoryOptions} placeholder="Select category" />
          {errors.category && <p className="text-xs text-destructive"><AlertCircle className="w-3 h-3 inline" /> {errors.category}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Brand</Label>
          <SearchableSelect value={product.brand_id || ""} onChange={(val) => updateField("brand_id", val)} options={brandOptions} placeholder="Select brand" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Product Type</Label>
          <Select value={product.product_type || "simple"} onValueChange={(val) => updateField("product_type", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">Simple Product</SelectItem>
              <SelectItem value="variable">Variable Product</SelectItem>
              <SelectItem value="bundle">Bundle Product</SelectItem>
              <SelectItem value="digital">Digital Product</SelectItem>
              <SelectItem value="service">Service</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Unit of Measure</Label>
          <Select value={product.unit_of_measure || "PCS"} onValueChange={(val) => updateField("unit_of_measure", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PCS">Pieces (PCS)</SelectItem><SelectItem value="KG">Kilograms (KG)</SelectItem>
              <SelectItem value="LTR">Liters (LTR)</SelectItem><SelectItem value="MTR">Meters (MTR)</SelectItem>
              <SelectItem value="BOX">Box (BOX)</SelectItem><SelectItem value="SET">Set (SET)</SelectItem>
              <SelectItem value="PAIR">Pair (PAIR)</SelectItem><SelectItem value="DOZEN">Dozen (DOZEN)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Short Description</Label>
        <Textarea value={product.short_description || ""} onChange={(e) => updateField("short_description", e.target.value)} rows={2} />
        <p className="text-xs text-muted-foreground">{product.short_description?.length || 0}/200 characters</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Full Description</Label>
        <Textarea value={product.description || ""} onChange={(e) => updateField("description", e.target.value)} rows={5} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Status</Label>
        <Select value={product.status || "draft"} onValueChange={(val) => updateField("status", val)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}