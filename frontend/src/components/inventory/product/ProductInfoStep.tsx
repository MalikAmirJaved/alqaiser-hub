// src/components/inventory/product/ProductInfoStep.tsx
"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Controller } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import FormField from "@/components/reuseable/FormField";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { useCategories, Category } from "@/hooks/useCategories";
import { useBrands, Brand } from "@/hooks/useBrands";
import CategoryFormModal from "@/components/inventory/category/CategoryFormModal";
import BrandFormModal from "@/components/inventory/brand/BrandFormModal";

interface ProductInfoStepProps {
  control: any;
  register: any;
  errors: any;
  onNext: () => void;
}

export default function ProductInfoStep({
  control,
  register,
  errors,
  onNext,
}: ProductInfoStepProps) {
  const { data: categories = [], refetch: refetchCategories } = useCategories();
  const { data: brands = [], refetch: refetchBrands } = useBrands();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);

  const categoryOptions = useMemo(
    () =>
      categories.map((c: Category) => ({ value: String(c.id), label: `${c.name} (${c.code})` })),
    [categories],
  );
  const brandOptions = useMemo(
    () => brands.map((b: Brand) => ({ value: String(b.id), label: `${b.name} (${b.code})` })),
    [brands],
  );

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Category" required error={errors.category?.message}>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value || ""}
                  onChange={(v) => field.onChange(v || null)}
                  options={categoryOptions}
                  placeholder="Select category"
                  onAddNew={() => setShowCategoryModal(true)}
                  addNewLabel="+ Add New Category"
                />
              )}
            />
          </FormField>
          <FormField label="Brand">
            <Controller
              control={control}
              name="brand"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value || ""}
                  onChange={(v) => field.onChange(v || null)}
                  options={brandOptions}
                  placeholder="Select brand"
                  onAddNew={() => setShowBrandModal(true)}
                  addNewLabel="+ Add New Brand"
                />
              )}
            />
          </FormField>
        </div>

        <FormField label="Product Name" required error={errors.productName?.message}>
          <Input
            {...register("productName")}
            placeholder="e.g. Organic Cotton T-Shirt"
            className="text-base"
          />
        </FormField>

        <FormField label="Description" hint="Detailed description shown on product pages">
          <Textarea
            {...register("description")}
            placeholder="What makes this product special..."
            rows={3}
            className="resize-none"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Unit">
            <Controller
              control={control}
              name="unit"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      ["PIECE", "Piece"],
                      ["KG", "Kilogram"],
                      ["GRAM", "Gram"],
                      ["LITER", "Liter"],
                      ["ML", "Milliliter"],
                      ["PACK", "Pack"],
                      ["DOZEN", "Dozen"],
                    ].map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Storage">
            <Controller
              control={control}
              name="storageRequirement"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AMBIENT">Ambient</SelectItem>
                    <SelectItem value="REFRIGERATED">Refrigerated</SelectItem>
                    <SelectItem value="FROZEN">Frozen</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Tax Rate (%)" error={errors.taxRate?.message}>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              {...register("taxRate")}
              placeholder="0"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Status">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Active">
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="is-active"
                  />
                  <label htmlFor="is-active" className="text-sm text-muted-foreground">
                    Product is available for sale
                  </label>
                </div>
              )}
            />
          </FormField>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={onNext} className="gap-2 px-6">
            Next: Variants <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <CategoryFormModal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          refetchCategories();
        }}
      />
      <BrandFormModal
        isOpen={showBrandModal}
        onClose={() => {
          setShowBrandModal(false);
          refetchBrands();
        }}
      />
    </>
  );
}
