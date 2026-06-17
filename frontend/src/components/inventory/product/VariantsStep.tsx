// src/components/inventory/product/VariantsStep.tsx
"use client";

import { ArrowLeft, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFieldArray } from "react-hook-form";
import VariantCard from "./VariantCard";
import { useAutoCode } from "@/hooks/useAutoCode";

interface VariantsStepProps {
  control: any;
  register: any;
  errors: any;
  watch: any;
  setValue: any;
  trigger: any;
  isEditing: boolean;
  isLoading: boolean;
  productName: string;
  onBack: () => void;
}

export default function VariantsStep({
  control,
  register,
  errors,
  watch,
  setValue,
  trigger,
  isEditing,
  isLoading,
  productName,
  onBack,
}: VariantsStepProps) {
  const { fields, prepend, remove } = useFieldArray({ control, name: "variants" });
  const { generateCode } = useAutoCode("product_variant");

  const addVariant = async () => {
    let code = "";
    try {
      code = await generateCode();
    } catch {
      const base = productName.replace(/\s+/g, "-").toUpperCase() || "PROD";
      code = `${base}-VAR${fields.length + 1}`;
    }
    prepend({
      sku: code,
      variantTitle: "",
      barcode: "",
      sellingPrice: 0,
      minStockLevel: 0,
      maxStockLevel: 0,
      attributes: [],
      images: [],
    });
  };

  const duplicateVariant = async (i: number) => {
    const vals = watch(`variants.${i}`);
    let code = vals.sku;
    try {
      code = await generateCode();
    } catch {
      code = vals.sku + "-COPY";
    }
    prepend({ ...vals, sku: code, id: undefined });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-semibold">
            Variants{" "}
            <span className="text-muted-foreground font-normal">({fields.length})</span>
          </h3>
          <p className="text-sm text-muted-foreground">
            Each variant has its own SKU, price, and attributes
          </p>
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
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Button type="submit" disabled={isLoading} className="gap-2 px-8">
          {isLoading ? "Saving..." : isEditing ? "Update Product" : "Create Product"}
          {!isLoading && <Check className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
