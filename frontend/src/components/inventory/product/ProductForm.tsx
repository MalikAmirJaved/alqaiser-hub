// src/components/inventory/product/ProductForm.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import StepBar from "@/components/reuseable/StepBar";
import ProductInfoStep from "./ProductInfoStep";
import VariantsStep from "./VariantsStep";
import type { Product, ProductPayload } from "@/hooks/useProducts";
import { useAutoCode } from "@/hooks/useAutoCode";
import { type PendingFile, uploadFiles, deleteUploadedFiles } from "@/components/reuseable/FileUpload";

// ──────────────────────────────────────────
// Zod schema
// ──────────────────────────────────────────
const attributeSchema = z.object({
  key: z.string().min(1, "Key required"),
  value: z.string().min(1, "Value required"),
});

const variantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1, "SKU required").max(100),
  variantTitle: z.string().max(200).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  sellingPrice: z.preprocess((v) => (v === "" ? 0 : Number(v)), z.number().min(0.01, "Required")),
  minStockLevel: z.preprocess(
    (v) => (v === "" ? 0 : Number(v)),
    z.number().int().min(0).default(0),
  ),
  maxStockLevel: z.preprocess(
    (v) => (v === "" ? 0 : Number(v)),
    z.number().int().min(0).default(0),
  ),
  attributes: z.array(attributeSchema).default([]),
          images: z.array(z.union([z.string(), z.object({ url: z.string(), url_thumb: z.string() })])).default([]),
});

const schema = z.object({
  productName: z.string().min(2, "Product name is required").max(200),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  unit: z.enum(["PIECE", "KG", "GRAM", "LITER", "ML", "PACK", "DOZEN"]).default("PIECE"),
  storageRequirement: z.enum(["AMBIENT", "REFRIGERATED", "FROZEN"]).default("AMBIENT"),
  taxRate: z.preprocess((v) => (v === "" ? 0 : Number(v)), z.number().min(0).max(100).default(0)),
  status: z.enum(["draft", "active", "discontinued", "archived"]).default("active"),
  is_active: z.boolean().default(true),
  variants: z.array(variantSchema).min(1, "At least one variant required"),
});

type FormData = z.infer<typeof schema>;

interface ProductFormProps {
  initialData?: Product;
  onSubmit: (data: ProductPayload) => Promise<void>;
  isLoading: boolean;
  isEditing: boolean;
  onCancel?: () => void;
  fetchCategories?: (params: { search: string; page: number; pageSize: number }) => Promise<{ options: { value: string; label: string }[]; hasMore: boolean; totalCount: number }>;
  fetchBrands?: (params: { search: string; page: number; pageSize: number }) => Promise<{ options: { value: string; label: string }[]; hasMore: boolean; totalCount: number }>;
}

// ──────────────────────────────────────────
// Main form
// ──────────────────────────────────────────
const ProductForm: React.FC<ProductFormProps> = ({
  initialData,
  onSubmit,
  isLoading,
  isEditing,
  onCancel,
  fetchCategories,
  fetchBrands,
}) => {
  const [step, setStep] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { generateCode } = useAutoCode("product_variant");

  const defaultValues = useMemo((): FormData => {
    if (initialData) {
      return {
        productName: initialData.product_name,
        description: initialData.description || "",
        category: initialData.category_id || null,
        brand: initialData.brand_id || null,
        unit: initialData.unit as FormData["unit"],
        storageRequirement: initialData.storage_requirement as FormData["storageRequirement"],
        taxRate: initialData.tax_rate,
        status: initialData.status as FormData["status"],
        is_active: initialData.is_active,
        variants: initialData.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          variantTitle: v.variant_title || "",
          barcode: v.barcode || "",
          sellingPrice: v.selling_price,
          minStockLevel: v.min_stock_level,
          maxStockLevel: v.max_stock_level,
          attributes: v.variant_attributes.map((a) => ({
            key: a.attribute_key,
            value: a.attribute_value,
          })),
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
      status: "active",
      is_active: true,
      variants: [
        {
          sku: "",
          variantTitle: "",
          barcode: "",
          sellingPrice: 0,
          minStockLevel: 0,
          maxStockLevel: 0,
          attributes: [],
          images: [],
        },
      ],
    };
  }, [initialData]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues,
    mode: "onChange",
  });

  useEffect(() => {
    if (!isEditing) {
      generateCode().then(code => setValue("variants.0.sku", code)).catch(() => {});
    }
  }, []);

  const productName = watch("productName");

  const goNext = async () => {
    const ok = await trigger([
      "productName",
      "category",
      "description",
      "unit",
      "storageRequirement",
      "taxRate",
      "status",
      "is_active",
    ]);
    if (ok) setStep(1);
  };

  const onFormSubmit = async (data: FormData) => {
    setSubmitting(true);
    const uploadedUrls: string[] = [];

    try {
      // Step 1: Upload all pending files
      if (pendingFiles.length > 0) {
        const results = await uploadFiles(pendingFiles);
        
        // Map uploaded URLs to their respective variants
        for (const result of results) {
          uploadedUrls.push(result.url);
          const fieldNameParts = result.fieldName.split(".");
          if (fieldNameParts.length >= 3) {
            const variantIndex = parseInt(fieldNameParts[1]);
            const currentImages = data.variants[variantIndex]?.images || [];
            // Store as object with url and url_thumb
            data.variants[variantIndex].images = [
              ...currentImages,
              { url: result.url, url_thumb: result.url_thumb }
            ];
          }
        }
      }

      // Step 2: Prepare payload with uploaded URLs
      const payload: ProductPayload = {
        productName: data.productName,
        description: data.description || "",
        category: data.category || null,
        brand: data.brand || null,
        unit: data.unit,
        storageRequirement: data.storageRequirement,
        taxRate: data.taxRate,
        status: data.status,
        is_active: data.is_active,
        variants: data.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          variantTitle: v.variantTitle || "",
          barcode: v.barcode || "",
          sellingPrice: v.sellingPrice,
          minStockLevel: v.minStockLevel,
          maxStockLevel: v.maxStockLevel,
          attributes: v.attributes || [],
          images: v.images || [],
        })),
      };

      // Step 3: Create/Update product
      await onSubmit(payload);
      
      // Step 4: Clear pending files on success
      setPendingFiles([]);
    } catch (error) {
      // Step 5: Rollback - delete uploaded files if product creation fails
      if (uploadedUrls.length > 0) {
        await deleteUploadedFiles(uploadedUrls);
      }
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-0">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/60">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold">
              {isEditing ? "Edit Product" : "New Product"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isEditing ? "Update your product details" : "Add a product to your inventory"}
            </p>
          </div>
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <StepBar steps={["Product Info", "Variants"]} current={step} />
      </div>

      <div className="px-6 py-6">
        {step === 0 && (
          <ProductInfoStep
            control={control}
            register={register}
            errors={errors}
            onNext={goNext}
            fetchCategories={fetchCategories}
            fetchBrands={fetchBrands}
            displayCategoryLabel={isEditing && initialData?.category_name ? initialData.category_name : undefined}
            displayBrandLabel={isEditing && initialData?.brand_name ? initialData.brand_name : undefined}
          />
        )}

        {step === 1 && (
          <VariantsStep
            control={control}
            register={register}
            errors={errors}
            watch={watch}
            setValue={setValue}
            trigger={trigger}
            isEditing={isEditing}
            isLoading={submitting || isLoading}
            productName={productName}
            onBack={() => setStep(0)}
            pendingFiles={pendingFiles}
            onPendingFilesChange={setPendingFiles}
          />
        )}
      </div>
    </form>
  );
};

export default ProductForm;
