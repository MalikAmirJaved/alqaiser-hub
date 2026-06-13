// src/components/inventory/product/AdvancedProductManager.tsx
"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Package, Layers, DollarSign, Tag, ImageIcon, Truck, ClipboardList } from "lucide-react";
import ProductBasicInfo from "./ProductBasicInfo";
import ProductVariantsManager from "./ProductVariantsManager";
import ProductAttributesManager from "./ProductAttributesManager";
import ProductPricingTax from "./ProductPricingTax";
import ProductInventoryManager from "./ProductInventoryManager";
import ProductMediaGallery from "./ProductMediaGallery";
import ProductTagsManager from "./ProductTagsManager";

interface AdvancedProductManagerProps {
  product: any;                 // existing product or null for create
  categories: any[];
  brands: any[];
  tags: any[];
  warehouses: any[];
  onSave: (productData: any) => Promise<void>;
  onCancel: () => void;
}

export default function AdvancedProductManager({
  product,
  categories,
  brands,
  tags,
  warehouses,
  onSave,
  onCancel,
}: AdvancedProductManagerProps) {
  const [activeTab, setActiveTab] = useState("basic");
  const [formData, setFormData] = useState<any>(() => {
    if (product) return { ...product };
    return {
      sku: generateSKU(),
      name: "",
      short_description: "",
      description: "",
      category_id: "",
      brand_id: "",
      product_type: "simple",
      unit_of_measure: "PCS",
      cost_price: 0,
      selling_price: 0,
      status: "draft",
      main_image: "",
      gallery_images: [],
      video_url: "",
      tax_class: "standard",
      attributes: [],
      variants: [],
      inventory: [],
      tags: [],
    };
  });

  const [errors, setErrors] = useState<any>({});
  const [saving, setSaving] = useState(false);

  function generateSKU() {
    return `SKU-${Date.now().toString(36).toUpperCase()}`;
  }

  const validate = () => {
    const newErrors: any = {};
    if (!formData.name) newErrors.name = "Product name required";
    if (!formData.sku) newErrors.sku = "SKU required";
    if (!formData.category_id) newErrors.category = "Category required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      setActiveTab("basic");
      return;
    }
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const updateFormData = (updates: any) => setFormData({ ...formData, ...updates });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-6xl bg-card rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold">
              {product ? "Edit Product" : "Create New Product"}
            </h2>
            <p className="text-sm text-muted-foreground">SKU: {formData.sku}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : (product ? "Update" : "Create")}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="px-6 pt-2 border-b border-border justify-start gap-1 bg-transparent flex-wrap h-auto">
            <TabsTrigger value="basic"><Package className="w-4 h-4 mr-2" /> Basic Info</TabsTrigger>
            {formData.product_type === "variable" && (
              <TabsTrigger value="variants"><Layers className="w-4 h-4 mr-2" /> Variants</TabsTrigger>
            )}
            <TabsTrigger value="attributes"><ClipboardList className="w-4 h-4 mr-2" /> Attributes</TabsTrigger>
            <TabsTrigger value="pricing"><DollarSign className="w-4 h-4 mr-2" /> Pricing</TabsTrigger>
            <TabsTrigger value="inventory"><Truck className="w-4 h-4 mr-2" /> Inventory</TabsTrigger>
            <TabsTrigger value="tags"><Tag className="w-4 h-4 mr-2" /> Tags</TabsTrigger>
            <TabsTrigger value="media"><ImageIcon className="w-4 h-4 mr-2" /> Media</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="basic">
              <ProductBasicInfo
                product={formData}
                categories={categories}
                brands={brands}
                onChange={updateFormData}
                errors={errors}
              />
            </TabsContent>
            <TabsContent value="variants">
              <ProductVariantsManager
                product={formData}
                variants={formData.variants || []}
                onChange={(variants) => updateFormData({ variants })}
              />
            </TabsContent>
            <TabsContent value="attributes">
              <ProductAttributesManager
                product={formData}
                attributes={formData.attributes || []}
                onChange={(attributes) => updateFormData({ attributes })}
              />
            </TabsContent>
            <TabsContent value="pricing">
              <ProductPricingTax
                product={formData}
                onChange={updateFormData}
              />
            </TabsContent>
            <TabsContent value="inventory">
              <ProductInventoryManager
                product={formData}
                variants={formData.variants || []}
                inventoryRecords={formData.inventory || []}
                warehouses={warehouses}
                onChange={(inventory) => updateFormData({ inventory })}
              />
            </TabsContent>
            <TabsContent value="tags">
              <ProductTagsManager
                product={formData}
                tags={formData.tags || []}
                allTags={tags}
                onChange={(tags) => updateFormData({ tags })}
              />
            </TabsContent>
            <TabsContent value="media">
              <ProductMediaGallery
                product={formData}
                onChange={updateFormData}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}