// src/components/inventory/product/AdvancedProductManager.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Package, Layers, ImageIcon } from "lucide-react";
import ProductBasicInfo from "./ProductBasicInfo";
import ProductVariantsManager from "./ProductVariantsManager";
import { Category } from "@/hooks/useCategories";
import { Brand } from "@/hooks/useBrands";
import { Product, ProductPayload, ProductVariantPayload } from "@/hooks/useProducts";

interface AdvancedProductManagerProps {
  product: Product | null;
  categories: Category[];
  brands: Brand[];
  onSave: (productData: ProductPayload) => Promise<void>;
  onCancel: () => void;
}

export default function AdvancedProductManager({
  product,
  categories,
  brands,
  onSave,
  onCancel,
}: AdvancedProductManagerProps) {
  const [formData, setFormData] = useState<ProductPayload>(() => {
    if (product) {
      // Map existing product to payload format for editing
      return {
        productName: product.product_name,
        description: product.description,
        category: product.category_id,
        brand: product.brand_id,
        unit: product.unit,
        storageRequirement: product.storage_requirement,
        taxRate: parseFloat(product.tax_rate),
        variants: product.variants.map(v => ({
          sku: v.sku,
          barcode: v.barcode || "",
          qrCode: v.qr_code || "",
          buyingPrice: parseFloat(v.buying_price),
          sellingPrice: parseFloat(v.selling_price),
          minStockLevel: v.min_stock_level,
          maxStockLevel: v.max_stock_level,
          attributes: v.variant_attributes.map(attr => ({
            key: attr.attribute_key,
            value: attr.attribute_value,
          })),
          images: v.variant_images.map(img => img.image_url),
          // stock field is not used in update; backend handles stock separately
        })),
      };
    }
    return {
      productName: "",
      description: "",
      category: null,
      brand: null,
      unit: "PIECE",
      storageRequirement: "AMBIENT",
      taxRate: 0,
      variants: [],
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.productName.trim()) newErrors.productName = "Product name required";
    if (!formData.category) newErrors.category = "Category required";
    if (formData.variants.length === 0) {
      newErrors.variants = "At least one variant required";
    } else {
      for (let i = 0; i < formData.variants.length; i++) {
        const v = formData.variants[i];
        if (!v.sku) newErrors[`variant_${i}_sku`] = "SKU required";
        if (v.sellingPrice <= 0) newErrors[`variant_${i}_price`] = "Selling price required";
        if (v.buyingPrice < 0) newErrors[`variant_${i}_cost`] = "Buying price cannot be negative";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const updateFormData = (updates: Partial<ProductPayload>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-6xl bg-card rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold">
              {product ? "Edit Product" : "Create New Product"}
            </h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : (product ? "Update" : "Create")}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <ProductBasicInfo
            data={formData}
            categories={categories}
            brands={brands}
            onChange={updateFormData}
            errors={errors}
          />
          <ProductVariantsManager
            variants={formData.variants}
            onChange={(variants) => updateFormData({ variants })}
            errors={errors}
            baseSkuHint={formData.productName.replace(/\s+/g, "-").toUpperCase()}
          />
        </div>
      </div>
    </div>
  );
}