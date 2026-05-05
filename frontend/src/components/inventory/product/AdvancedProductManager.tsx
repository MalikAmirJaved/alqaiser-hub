// src/components/inventory/product/AdvancedProductManager.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Package, Layers, DollarSign, Tag, Image as ImageIcon, Settings, Truck, ClipboardList } from "lucide-react";
import { ls, uid } from "@/services/localStorageService";

// Import sub-components
import ProductBasicInfo from "./ProductBasicInfo";
import ProductVariantsManager from "./ProductVariantsManager";
import ProductAttributesManager from "./ProductAttributesManager";
import ProductPricingTax from "./ProductPricingTax";
import ProductInventoryManager from "./ProductInventoryManager";
import ProductMediaGallery from "./ProductMediaGallery";
import ProductTagsManager from "./ProductTagsManager";

export default function AdvancedProductManager({ productId, onSave, onCancel }) {
  const [activeTab, setActiveTab] = useState("basic");
  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [attributes, setAttributes] = useState<any[]>([]);
  const [inventoryRecords, setInventoryRecords] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Load all data
  useEffect(() => {
    setWarehouses(ls.get<any[]>("warehouses", []) || []);
    
    if (productId) {
      const products = ls.get<any[]>("products", []) || [];
      const found = products.find((p: any) => p.id === productId);

      if (found) {
        setProduct(found);
        loadVariants(productId);
        loadAttributes(productId);
        loadInventory(productId);
        loadTags(productId);
      }
    } else {
      // Initialize new product
      setProduct({
        id: uid("prod"),
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
        created_at: new Date().toISOString()
      });
      setVariants([]);
      setAttributes([]);
      setInventoryRecords([]);
      setTags([]);
    }
  }, [productId]);

  const generateSKU = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    return `SKU-${timestamp}`;
  };

  const loadVariants = (pid: string) => {
    const allVariants = ls.get<any[]>("productVariants", []) || [];
    setVariants(allVariants.filter((v: any) => v.product_id === pid));
  };


  const loadAttributes = (pid: string) => {
    const allAttributes = ls.get<any[]>("productAttributes", []) || [];
    setAttributes(allAttributes.filter((a: any) => a.product_id === pid));
  };


  const loadInventory = (pid: string) => {
    const allInventory = ls.get<any[]>("inventory", []) || [];
    setInventoryRecords(allInventory.filter((i: any) => i.product_id === pid));
  };


  const loadTags = (pid: string) => {
    const allProductTags = ls.get<any[]>("productTags", []) || [];
    const tagIds = allProductTags.filter((pt: any) => pt.product_id === pid).map((pt: any) => pt.tag_id);
    const allTags = ls.get<any[]>("tags", []) || [];
    setTags(allTags.filter((t: any) => tagIds.includes(t.id)));
  };


  const validateProduct = () => {
    const newErrors: any = {};

    if (!product.name) newErrors.name = "Product name is required";
    if (!product.sku) newErrors.sku = "SKU is required";
    if (!product.category_id) newErrors.category = "Category is required";
    if (product.cost_price < 0) newErrors.cost_price = "Cost price cannot be negative";
    if (product.selling_price < 0) newErrors.selling_price = "Selling price cannot be negative";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateProduct()) {
      setActiveTab("basic");
      return;
    }
    
    setSaving(true);
    
    // Save product
    const products = ls.get<any[]>("products", []) || [];
    if (productId) {
      const updated = products.map((p: any) => p.id === productId 
        ? { ...product, updated_at: new Date().toISOString() } 
        : p
      );
      ls.set("products", updated);
    } else {
      ls.set("products", [{ ...product, created_at: new Date().toISOString() }, ...products]);
    }
    
    // Save variants
    const allVariants = ls.get<any[]>("productVariants", []) || [];
    const filteredVariants = allVariants.filter((v: any) => v.product_id !== product.id);
    ls.set("productVariants", [...filteredVariants, ...variants]);
    
    // Save attributes
    const allAttributes = ls.get<any[]>("productAttributes", []) || [];
    const filteredAttributes = allAttributes.filter((a: any) => a.product_id !== product.id);
    ls.set("productAttributes", [...filteredAttributes, ...attributes]);
    
    // Save inventory
    const allInventory = ls.get<any[]>("inventory", []) || [];
    const filteredInventory = allInventory.filter((i: any) => i.product_id !== product.id);
    ls.set("inventory", [...filteredInventory, ...inventoryRecords]);
    
    // Save tags
    const allProductTags = ls.get<any[]>("productTags", []) || [];
    const filteredTags = allProductTags.filter((pt: any) => pt.product_id !== product.id);
    const newTags = tags.map((tag: any) => ({
      id: uid("pt"),
      product_id: product.id,
      tag_id: tag.id,
      created_at: new Date().toISOString(),
      created_by: ls.get<any>("session")?.id
    }));

    ls.set("productTags", [...filteredTags, ...newTags]);
    
    setSaving(false);
    onSave?.();
  };

  if (!product) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-6xl bg-card rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold">
              {productId ? "Edit Product" : "Create New Product"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              SKU: {product.sku}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : (productId ? "Update Product" : "Create Product")}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="px-6 pt-2 border-b border-border justify-start gap-1 bg-transparent flex-wrap h-auto">
            <TabsTrigger value="basic" className="data-[state=active]:bg-primary/10">
              <Package className="w-4 h-4 mr-2" /> Basic Info
            </TabsTrigger>
            {product.product_type === "variable" && (
              <TabsTrigger value="variants" className="data-[state=active]:bg-primary/10">
                <Layers className="w-4 h-4 mr-2" /> Variants
              </TabsTrigger>
            )}
            <TabsTrigger value="attributes" className="data-[state=active]:bg-primary/10">
              <ClipboardList className="w-4 h-4 mr-2" /> Attributes
            </TabsTrigger>
            <TabsTrigger value="pricing" className="data-[state=active]:bg-primary/10">
              <DollarSign className="w-4 h-4 mr-2" /> Pricing & Tax
            </TabsTrigger>
            <TabsTrigger value="inventory" className="data-[state=active]:bg-primary/10">
              <Truck className="w-4 h-4 mr-2" /> Inventory
            </TabsTrigger>
            <TabsTrigger value="tags" className="data-[state=active]:bg-primary/10">
              <Tag className="w-4 h-4 mr-2" /> Tags
            </TabsTrigger>
            <TabsTrigger value="media" className="data-[state=active]:bg-primary/10">
              <ImageIcon className="w-4 h-4 mr-2" /> Media
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="basic" className="m-0">
              <ProductBasicInfo 
                product={product}
                onChange={setProduct}
                errors={errors}
              />
            </TabsContent>

            <TabsContent value="variants" className="m-0">
              <ProductVariantsManager
                product={product}
                variants={variants}
                onChange={setVariants}
              />
            </TabsContent>

            <TabsContent value="attributes" className="m-0">
              <ProductAttributesManager
                product={product}
                attributes={attributes}
                onChange={setAttributes}
              />
            </TabsContent>

            <TabsContent value="pricing" className="m-0">
              <ProductPricingTax
                product={product}
                onChange={setProduct}
              />
            </TabsContent>

            <TabsContent value="inventory" className="m-0">
              <ProductInventoryManager
                product={product}
                variants={variants}
                inventoryRecords={inventoryRecords}
                warehouses={warehouses}
                onChange={setInventoryRecords}
              />
            </TabsContent>

            <TabsContent value="tags" className="m-0">
              <ProductTagsManager
                product={product}
                tags={tags}
                onChange={setTags}
              />
            </TabsContent>

            <TabsContent value="media" className="m-0">
              <ProductMediaGallery
                product={product}
                onChange={setProduct}
              />
            </TabsContent>

          </div>
        </Tabs>
      </div>
    </div>
  );
}