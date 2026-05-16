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
import { ProductPayload } from "@/hooks/useProducts";

interface ProductBasicInfoProps {
  data: ProductPayload;
  categories: Category[];
  brands: Brand[];
  onChange: (updates: Partial<ProductPayload>) => void;
  errors?: Record<string, string>;
}

const unitOptions = [
  { value: "PIECE", label: "Piece" },
  { value: "KG", label: "Kilogram" },
  { value: "GRAM", label: "Gram" },
  { value: "LITER", label: "Liter" },
  { value: "ML", label: "Milliliter" },
  { value: "PACK", label: "Pack" },
  { value: "DOZEN", label: "Dozen" },
];

const storageOptions = [
  { value: "AMBIENT", label: "Ambient" },
  { value: "REFRIGERATED", label: "Refrigerated" },
  { value: "FROZEN", label: "Frozen" },
];

export default function ProductBasicInfo({ data, categories, brands, onChange, errors = {} }: ProductBasicInfoProps) {
  const categoryOptions = categories.map(c => ({ value: String(c.id), label: `${c.name} (${c.code})` }));
  const brandOptions = brands.map(b => ({ value: String(b.id), label: `${b.name} (${b.code})` }));

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label>Product Name <span className="text-destructive">*</span></Label>
        <Input
          value={data.productName}
          onChange={(e) => onChange({ productName: e.target.value })}
          className={errors.productName ? "border-destructive" : ""}
        />
        {errors.productName && <p className="text-xs text-destructive"><AlertCircle className="w-3 h-3 inline" /> {errors.productName}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea value={data.description || ""} onChange={(e) => onChange({ description: e.target.value })} rows={3} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Category <span className="text-destructive">*</span></Label>
          <SearchableSelect
            value={data.category ? String(data.category) : ""}
            onChange={(val) => onChange({ category: val ? Number(val) : null })}
            options={categoryOptions}
            placeholder="Select category"
          />
          {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Brand</Label>
          <SearchableSelect
            value={data.brand ? String(data.brand) : ""}
            onChange={(val) => onChange({ brand: val ? Number(val) : null })}
            options={brandOptions}
            placeholder="Select brand"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Unit</Label>
          <Select value={data.unit} onValueChange={(val) => onChange({ unit: val })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {unitOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Storage Requirement</Label>
          <Select value={data.storageRequirement} onValueChange={(val) => onChange({ storageRequirement: val })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {storageOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tax Rate (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={data.taxRate}
            onChange={(e) => onChange({ taxRate: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>
    </div>
  );
}