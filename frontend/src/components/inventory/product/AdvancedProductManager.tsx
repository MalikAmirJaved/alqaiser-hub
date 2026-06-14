// src/components/inventory/product/AdvancedProductManager.tsx
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Package, Layers, Tag, ImageIcon, ClipboardList } from "lucide-react";
import ProductBasicInfo from "./ProductBasicInfo";
import ProductVariantsManager from "./ProductVariantsManager";
import ProductAttributesManager from "./ProductAttributesManager";
import ProductMediaGallery from "./ProductMediaGallery";
import ProductTagsManager from "./ProductTagsManager";

interface AdvancedProductManagerProps {
  product: any;
  categories: any[];
  brands: any[];
  tags: any[];
  warehouses?: any[]; // kept for future, not used in form
  onSave: (productData: any) => Promise<void>;
  onCancel: () => void;
}

export default function AdvancedProductManager({
  product,
  categories,
  brands,
  tags,
  onSave,
  onCancel,
}: AdvancedProductManagerProps) {
  const [activeTab, setActiveTab] = useState("basic");
  const [formData, setFormData] = useState<any>(() => {
    if (product) {
      // Convert existing tags to tag_input format (list of {name, group?})
      const tagInput = (product.tags || []).map((t: any) => ({
        name: t.name,
        group: t.group?.name || undefined,
      }));
      return {
        ...product,
        tag_input: tagInput,
      };
    }
    return {
      sku: generateSKU(),
      name: "",
      short_description: "",
      description: "",
      category_id: "",
      brand_id: "",
      product_type: "simple",
      unit_of_measure: "PCS",
      tax_class: "standard",
      main_image: "",
      gallery_images: [],
      video_url: "",
      status: "draft",
      attributes: [],
      variants: [],
      tag_input: [], // array of {name, group?}
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
    // Validate variants have prices if product_type is variable
    if (formData.product_type === "variable" && (!formData.variants || formData.variants.length === 0)) {
      newErrors.variants = "At least one variant required for variable product";
    }
    if (formData.product_type === "variable") {
      for (let i = 0; i < formData.variants.length; i++) {
        const v = formData.variants[i];
        if (!v.selling_price || v.selling_price <= 0) {
          newErrors[`variant_${i}_price`] = `Variant ${i+1} selling price required`;
        }
      }
    } else if (formData.product_type === "simple") {
      // For simple products, ensure exactly one variant with price
      if (!formData.variants || formData.variants.length === 0) {
        newErrors.variants = "Simple product must have one variant with price";
      } else if (!formData.variants[0].selling_price || formData.variants[0].selling_price <= 0) {
        newErrors.variants = "Selling price required for the product variant";
      }
    }
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
      // Prepare data for backend
      const payload = { ...formData };
      // Remove any id fields from nested objects (backend will recreate)
      if (payload.variants) {
        payload.variants = payload.variants.map((v: any) => {
          const { id, ...rest } = v;
          return rest;
        });
      }
      if (payload.attributes) {
        payload.attributes = payload.attributes.map((a: any) => {
          const { id, ...rest } = a;
          return rest;
        });
      }
      // tag_input already in correct format
      await onSave(payload);
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
            <TabsTrigger value="variants"><Layers className="w-4 h-4 mr-2" /> Variants</TabsTrigger>
            <TabsTrigger value="attributes"><ClipboardList className="w-4 h-4 mr-2" /> Attributes</TabsTrigger>
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
                errors={errors}
              />
            </TabsContent>
            <TabsContent value="attributes">
              <ProductAttributesManager
                product={formData}
                attributes={formData.attributes || []}
                onChange={(attributes) => updateFormData({ attributes })}
              />
            </TabsContent>
            <TabsContent value="tags">
              <ProductTagsManager
                product={formData}
                tagInput={formData.tag_input || []}
                allTags={tags}
                onChange={(tagInput) => updateFormData({ tag_input: tagInput })}
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