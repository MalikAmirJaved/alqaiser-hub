// src/components/inventory/product/ProductForm.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, ArrowRight, Check, Package, Layers,
  Plus, Trash2, X, Copy, ChevronDown, ChevronUp,
  Image as ImageIcon, Tag, DollarSign, BarChart2,
} from "lucide-react";
import type { Product, ProductPayload } from "@/hooks/useProducts";
import { useCategories, Category } from "@/hooks/useCategories";
import { useBrands, Brand } from "@/hooks/useBrands";
import AttributeSelector from "./Attributeselector";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

// ──────────────────────────────────────────
// Zod schema
// ──────────────────────────────────────────
const attributeSchema = z.object({
  key: z.string().min(1, "Key required"),
  value: z.string().min(1, "Value required"),
});

const variantSchema = z.object({
  sku: z.string().min(1, "SKU required").max(100),
  barcode: z.string().max(100).optional().nullable(),
  qrCode: z.string().max(200).optional().nullable(),
  buyingPrice: z.preprocess((v) => (v === "" ? 0 : Number(v)), z.number().min(0)),
  sellingPrice: z.preprocess((v) => (v === "" ? 0 : Number(v)), z.number().min(0.01, "Required")),
  stock: z.preprocess((v) => (v === "" ? 0 : Number(v)), z.number().int().min(0).default(0)),
  minStockLevel: z.preprocess((v) => (v === "" ? 0 : Number(v)), z.number().int().min(0).default(0)),
  maxStockLevel: z.preprocess((v) => (v === "" ? 0 : Number(v)), z.number().int().min(0).default(0)),
  attributes: z.array(attributeSchema).default([]),
  images: z.array(z.string()).default([]),
});

const schema = z.object({
  productName: z.string().min(2, "Product name is required").max(200),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  unit: z.enum(["PIECE", "KG", "GRAM", "LITER", "ML", "PACK", "DOZEN"]).default("PIECE"),
  storageRequirement: z.enum(["AMBIENT", "REFRIGERATED", "FROZEN"]).default("AMBIENT"),
  taxRate: z.preprocess((v) => (v === "" ? 0 : Number(v)), z.number().min(0).max(100).default(0)),
  variants: z.array(variantSchema).min(1, "At least one variant required"),
});

type FormData = z.infer<typeof schema>;

interface ProductFormProps {
  initialData?: Product;
  onSubmit: (data: ProductPayload) => Promise<void>;
  isLoading: boolean;
  isEditing: boolean;
  onCancel?: () => void;
}

// ──────────────────────────────────────────
// Step indicator
// ──────────────────────────────────────────
function StepBar({ step }: { step: number }) {
  const steps = ["Product Info", "Variants"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
              i < step ? "bg-primary text-primary-foreground" :
              i === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
              "bg-muted text-muted-foreground"
            }`}>
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-sm font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px mx-4 transition-colors ${i < step ? "bg-primary" : "bg-border"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────
// Field wrapper
// ──────────────────────────────────────────
function Field({ label, required, error, children, hint }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ──────────────────────────────────────────
// Variant card
// ──────────────────────────────────────────
function VariantCard({
  index,
  control,
  register,
  errors,
  onRemove,
  onDuplicate,
  isEditing,
  watch,
  setValue,
}: any) {
  const [expanded, setExpanded] = useState(index === 0);
  const [imgUrl, setImgUrl] = useState("");
  const [addingImg, setAddingImg] = useState(false);

  const images: string[] = watch(`variants.${index}.images`) || [];
  const sku: string = watch(`variants.${index}.sku`) || `Variant ${index + 1}`;
  const attrs: { key: string; value: string }[] = watch(`variants.${index}.attributes`) || [];

  const displayName = attrs.length > 0
    ? attrs.map(a => `${a.key}: ${a.value}`).join(" · ")
    : sku;

  const addImage = () => {
    if (!imgUrl.trim()) return;
    setValue(`variants.${index}.images`, [...images, imgUrl.trim()]);
    setImgUrl("");
    setAddingImg(false);
  };

  const removeImage = (i: number) => {
    setValue(`variants.${index}.images`, images.filter((_, idx) => idx !== i));
  };

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${expanded ? "border-primary/40 shadow-sm" : "border-border"}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground font-mono">Variant #{index + 1}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Duplicate"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-6 border-t border-border/60">
          {/* Identification */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-3">Identification</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="SKU" required error={errors?.variants?.[index]?.sku?.message}>
                <Input {...register(`variants.${index}.sku`)}
                  onChange={(e) => {
                    const el = e.target;
                    el.value = el.value.toUpperCase();
                    register(`variants.${index}.sku`).onChange(e);
                  }}
                  placeholder="e.g. PROD-RED-M" className="font-mono text-sm" />
              </Field>
              <Field label="Barcode">
                <Input {...register(`variants.${index}.barcode`)} placeholder="Optional" />
              </Field>
              <Field label="QR Code URL">
                <Input {...register(`variants.${index}.qrCode`)} placeholder="https://..." />
              </Field>
            </div>
          </div>

          {/* Pricing */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pricing</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Buying Price" error={errors?.variants?.[index]?.buyingPrice?.message}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input type="number" step="0.01" min="0" {...register(`variants.${index}.buyingPrice`)} placeholder="0.00" className="pl-7" />
                </div>
              </Field>
              <Field label="Selling Price" required error={errors?.variants?.[index]?.sellingPrice?.message}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input type="number" step="0.01" min="0" {...register(`variants.${index}.sellingPrice`)} placeholder="0.00" className="pl-7" />
                </div>
              </Field>
              <Field label={isEditing ? "Stock (read-only)" : "Initial Stock"}>
                <Input type="number" min="0" {...register(`variants.${index}.stock`)} placeholder="0" disabled={isEditing} />
              </Field>
              <div className="col-span-1" />
              <Field label="Min Stock">
                <Input type="number" min="0" {...register(`variants.${index}.minStockLevel`)} placeholder="0" />
              </Field>
              <Field label="Max Stock">
                <Input type="number" min="0" {...register(`variants.${index}.maxStockLevel`)} placeholder="0" />
              </Field>
            </div>
          </div>

          {/* Attributes */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Attributes</p>
            <Controller
              control={control}
              name={`variants.${index}.attributes`}
              render={({ field }) => (
                <AttributeSelector
                  attributes={field.value || []}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          {/* Images */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Images</p>
            <div className="flex flex-wrap gap-3 items-end">
              {images.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
              {addingImg ? (
                <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                  <Input
                    autoFocus
                    placeholder="https://example.com/image.jpg"
                    value={imgUrl}
                    onChange={(e) => setImgUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImage())}
                    className="flex-1 text-sm"
                  />
                  <Button type="button" size="sm" onClick={addImage}>Add</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setAddingImg(false); setImgUrl(""); }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingImg(true)}
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-[10px] font-medium">Add</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// Main form
// ──────────────────────────────────────────
const ProductForm: React.FC<ProductFormProps> = ({ initialData, onSubmit, isLoading, isEditing, onCancel }) => {
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const [step, setStep] = useState(0);

  const categoryOptions = useMemo(
    () => categories.map((c: Category) => ({ value: String(c.id), label: `${c.name} (${c.code})` })),
    [categories]
  );
  const brandOptions = useMemo(
    () => brands.map((b: Brand) => ({ value: String(b.id), label: `${b.name} (${b.code})` })),
    [brands]
  );

  const defaultValues = useMemo((): FormData => {
    if (initialData) {
      return {
        productName: initialData.product_name,
        description: initialData.description || "",
        category: initialData.category_id || null,
        brand: initialData.brand_id || null,
        unit: initialData.unit as FormData["unit"],
        storageRequirement: initialData.storage_requirement as FormData["storageRequirement"],
        taxRate: parseFloat(initialData.tax_rate),
        variants: initialData.variants.map((v) => ({
          sku: v.sku,
          barcode: v.barcode || "",
          qrCode: v.qr_code || "",
          buyingPrice: parseFloat(v.buying_price),
          sellingPrice: parseFloat(v.selling_price),
          stock: 0,
          minStockLevel: v.min_stock_level,
          maxStockLevel: v.max_stock_level,
          attributes: v.variant_attributes.map((a) => ({ key: a.attribute_key, value: a.attribute_value })),
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
      variants: [{
        sku: "", barcode: "", qrCode: "",
        buyingPrice: 0, sellingPrice: 0,
        stock: 0, minStockLevel: 0, maxStockLevel: 0,
        attributes: [], images: [],
      }],
    };
  }, [initialData]);

  const {
    register, control, handleSubmit, watch, setValue, trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues,
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({ control, name: "variants" });

  const productName = watch("productName");

  const addVariant = () => {
    const base = productName.replace(/\s+/g, "-").toUpperCase() || "PROD";
    append({
      sku: `${base}-VAR${fields.length + 1}`,
      barcode: "", qrCode: "",
      buyingPrice: 0, sellingPrice: 0,
      stock: 0, minStockLevel: 0, maxStockLevel: 0,
      attributes: [], images: [],
    });
  };

  const duplicateVariant = (i: number) => {
    const vals = watch(`variants.${i}`);
    append({ ...vals, sku: vals.sku + "-COPY" });
  };

  const goNext = async () => {
    const ok = await trigger(["productName", "category", "description", "unit", "storageRequirement", "taxRate"]);
    if (ok) setStep(1);
  };

  const onFormSubmit = async (data: FormData) => {
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
    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-0">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/60">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold">{isEditing ? "Edit Product" : "New Product"}</h2>
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
        <StepBar step={step} />
      </div>

      <div className="px-6 py-6">
        {/* ── Step 0: Product Info ── */}
        {step === 0 && (
          <div className="space-y-6 ">
            <Field label="Product Name" required error={errors.productName?.message}>
              <Input
                {...register("productName")}
                placeholder="e.g. Organic Cotton T-Shirt"
                className="text-base"
              />
            </Field>

            <Field label="Description" hint="Detailed description shown on product pages">
              <Textarea
                {...register("description")}
                placeholder="What makes this product special..."
                rows={3}
                className="resize-none"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Category" required error={errors.category?.message}>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value || ""}
                      onChange={(v) => field.onChange(v || null)}
                      options={categoryOptions}
                      placeholder="Select category"
                    />
                  )}
                />
              </Field>
              <Field label="Brand">
                <Controller
                  control={control}
                  name="brand"
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value || ""}
                      onChange={(v) => field.onChange(v || null)}
                      options={brandOptions}
                      placeholder="Select brand"
                    />
                  )}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Unit">
                <Controller control={control} name="unit" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[
                        ["PIECE", "Piece"], ["KG", "Kilogram"], ["GRAM", "Gram"],
                        ["LITER", "Liter"], ["ML", "Milliliter"], ["PACK", "Pack"], ["DOZEN", "Dozen"],
                      ].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </Field>
              <Field label="Storage">
                <Controller control={control} name="storageRequirement" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AMBIENT">Ambient</SelectItem>
                      <SelectItem value="REFRIGERATED">Refrigerated</SelectItem>
                      <SelectItem value="FROZEN">Frozen</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </Field>
              <Field label="Tax Rate (%)" error={errors.taxRate?.message}>
                <Input type="number" step="0.01" min="0" max="100" {...register("taxRate")} placeholder="0" />
              </Field>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" onClick={goNext} className="gap-2 px-6">
                Next: Variants <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 1: Variants ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold">Variants <span className="text-muted-foreground font-normal">({fields.length})</span></h3>
                <p className="text-sm text-muted-foreground">Each variant has its own SKU, price, and attributes</p>
              </div>
              <Button type="button" size="sm" onClick={addVariant} className="gap-1.5">
                <Plus className="w-4 h-4" /> Add Variant
              </Button>
            </div>

            {errors.variants && !Array.isArray(errors.variants) && (
              <p className="text-sm text-destructive">{(errors.variants as any).message}</p>
            )}

            <div className="space-y-3">
              {fields.map((field, i) => (
                <VariantCard
                  key={field.id}
                  index={i}
                  control={control}
                  register={register}
                  errors={errors}
                  watch={watch}
                  setValue={setValue}
                  isEditing={isEditing}
                  onRemove={() => fields.length > 1 && remove(i)}
                  onDuplicate={() => duplicateVariant(i)}
                />
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border/60">
              <Button type="button" variant="outline" onClick={() => setStep(0)} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button type="submit" disabled={isLoading} className="gap-2 px-8">
                {isLoading ? "Saving..." : isEditing ? "Update Product" : "Create Product"}
                {!isLoading && <Check className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
};

export default ProductForm;