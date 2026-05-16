"use client";

import React, { useMemo, useState } from "react";
import { FormProvider, useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Product, ProductPayload } from "@/hooks/useProducts";
import type { SubmitHandler } from "react-hook-form";
import { useAuth } from "@/hooks/useAuth";
import { useCategories, Category } from "@/hooks/useCategories";
import { useBrands, Brand } from "@/hooks/useBrands";

import ProductDetailsTabContent from "./ProductDetailsTabContent";
import VariantManagementTabContent from "./VariantManagementTabContent";
import { stringify } from "querystring";

// ---------- Zod schemas ----------
const attributeSchema = z.object({
  key: z.string().min(1, "Key required"),
  value: z.string().min(1, "Value required"),
});

const variantSchema = z.object({
  sku: z.string().min(1, "SKU required").max(100),
  barcode: z.string().max(100).optional().nullable(),
  qrCode: z.string().max(200).optional().nullable(),
  buyingPrice: z.preprocess((val) => (val === "" ? undefined : Number(val)), z.number().min(0.01)),
  sellingPrice: z.preprocess((val) => (val === "" ? undefined : Number(val)), z.number().min(0.01)),
  stock: z.preprocess((val) => (val === "" ? undefined : Number(val)), z.number().int().min(0).default(0)),
  attributes: z.array(attributeSchema).default([]),
  images: z.array(z.string()).default([]),
  minStockLevel: z.preprocess((val) => (val === "" ? undefined : Number(val)), z.number().int().min(0).default(0)),
  maxStockLevel: z.preprocess((val) => (val === "" ? undefined : Number(val)), z.number().int().min(0).default(0)),
});

const productFormSchema = z.object({
  productName: z.string().min(2, "Product name required").max(200),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().uuid().nullable().optional(),
  brand: z.string().uuid().nullable().optional(),
  unit: z.enum(["PIECE", "KG", "GRAM", "LITER", "ML", "PACK", "DOZEN"]).default("PIECE"),
  storageRequirement: z.enum(["AMBIENT", "REFRIGERATED", "FROZEN"]).default("AMBIENT"),
  taxRate: z.preprocess((val) => (val === "" ? undefined : Number(val)), z.number().min(0).max(100).default(0)),
  variants: z.array(variantSchema).min(1, "At least one variant is required"),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  initialData?: Product;
  onSubmit: (data: ProductPayload) => Promise<void>;
  isLoading: boolean;
  isEditing: boolean;
}

const ProductForm: React.FC<ProductFormProps> = ({ initialData, onSubmit, isLoading, isEditing }) => {
  const router = useRouter();
  const { user } = useAuth();
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();

  const categoryOptions = useMemo(
    () => categories.map((c: Category) => ({ label: `${c.name} (${c.code})`, value: c.id })),
    [categories]
  );
  const brandOptions = useMemo(
    () => brands.map((b: Brand) => ({ label: `${b.name} (${b.code})`, value: b.id })),
    [brands]
  );

  const defaultValues: ProductFormData = useMemo(() => {
    if (initialData) {
      return {
        productName: initialData.product_name,
        description: initialData.description || "",
        category: initialData.category_id,
        brand: initialData.brand_id,
        unit: initialData.unit as ProductFormData["unit"],
        storageRequirement: initialData.storage_requirement as ProductFormData["storageRequirement"],
        taxRate: parseFloat(initialData.tax_rate),
        variants: initialData.variants.map((v) => ({
          sku: v.sku,
          barcode: v.barcode || "",
          qrCode: v.qr_code || "",
          buyingPrice: parseFloat(v.buying_price),
          sellingPrice: parseFloat(v.selling_price),
          stock: 0, // stock not sent on edit (handled separately), but we keep field for UI consistency
          minStockLevel: v.min_stock_level,
          maxStockLevel: v.max_stock_level,
          attributes: v.variant_attributes.map((attr) => ({ key: attr.attribute_key, value: attr.attribute_value })),
          images: v.variant_images.map((img) => img.image_url),
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
      variants: [
        {
          sku: "",
          barcode: "",
          qrCode: "",
          buyingPrice: 0.01,
          sellingPrice: 0.01,
          stock: 0,
          attributes: [],
          images: [],
          minStockLevel: 0,
          maxStockLevel: 0,
        },
      ],
    };
  }, [initialData]);

  const form = useForm<ProductFormData>({
  resolver: zodResolver(productFormSchema) as any,
  defaultValues,
  mode: "onChange",
});

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  const [activeTab, setActiveTab] = useState<"product-details" | "variants">("product-details");

  const handleAddVariant = () => {
    append({
      sku: "",
      barcode: "",
      qrCode: "",
      buyingPrice: 0.01,
      sellingPrice: 0.01,
      stock: 0,
      attributes: [],
      images: [],
      minStockLevel: 0,
      maxStockLevel: 0,
    });
  };

  const handleAddImageUrl = (variantIndex: number, url: string) => {
    const current = form.getValues(`variants.${variantIndex}.images`) || [];
    form.setValue(`variants.${variantIndex}.images`, [...current, url]);
  };

  const handleRemoveImage = (variantIndex: number, imageIndex: number) => {
    const current = form.getValues(`variants.${variantIndex}.images`) || [];
    const updated = current.filter((_, i) => i !== imageIndex);
    form.setValue(`variants.${variantIndex}.images`, updated);
  };

  const onSubmitHandler: SubmitHandler<ProductFormData> = (data) => {
    const payload: ProductPayload = {
      productName: data.productName,
      description: data.description || "",
      category: data.category || null,
brand: data.brand || null,
      unit: data.unit,
      storageRequirement: data.storageRequirement,
      taxRate: data.taxRate,
      variants: data.variants.map((v) => ({
        sku: v.sku,
        barcode: v.barcode || "",
        qrCode: v.qrCode || "",
        buyingPrice: v.buyingPrice,
        sellingPrice: v.sellingPrice,
        stock: v.stock,
        attributes: v.attributes || [],
        images: v.images || [],
        minStockLevel: v.minStockLevel,
        maxStockLevel: v.maxStockLevel,
      })),
    };
    onSubmit(payload);
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-8 bg-background p-2">
        <div className="border-b border-border pb-4">
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {isEditing ? "Edit Product" : "Create New Product"}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isEditing ? "Update the details for your product." : "Fill in the details to add a new product to your inventory."}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="product-details" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Product Details
            </TabsTrigger>
            <TabsTrigger value="variants" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Variants
            </TabsTrigger>
          </TabsList>

          <TabsContent value="product-details" className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <ProductDetailsTabContent
              categoryOptions={categoryOptions}
              brandOptions={brandOptions}
              setActiveTab={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="variants" className="space-y-6">
            <VariantManagementTabContent
              fields={fields}
              handleAddVariant={handleAddVariant}
              handleRemoveImage={handleRemoveImage}
              handleAddImageUrl={handleAddImageUrl}
              isEditing={isEditing}
              setActiveTab={setActiveTab}
              removeVariant={remove}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>
      </form>
    </FormProvider>
  );
};

export default ProductForm;