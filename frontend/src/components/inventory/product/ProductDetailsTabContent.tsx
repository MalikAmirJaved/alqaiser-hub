"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface ProductDetailsTabContentProps {
  categoryOptions: { label: string; value: string }[];
  brandOptions: { label: string; value: string }[];
  setActiveTab: (tab: "product-details" | "variants") => void;
}

const ProductDetailsTabContent: React.FC<ProductDetailsTabContentProps> = ({
  categoryOptions,
  brandOptions,
  setActiveTab,
}) => {
  const { control, trigger } = useFormContext();

  const handleNext = async () => {
    const isValid = await trigger([
      "productName",
      "brand",
      "category",
      "unit",
      "storageRequirement",
      "taxRate",
      "description",
    ]);
    if (isValid) setActiveTab("variants");
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <FormField
          control={control}
          name="productName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Organic Apples" className="h-11" {...field} />
              </FormControl>
              <FormDescription>The name of your product.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="brand"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brand</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select a brand" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {brandOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>The brand of the product.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categoryOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>The category this product belongs to.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unit</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="PIECE">Piece</SelectItem>
                  <SelectItem value="KG">Kilogram (KG)</SelectItem>
                  <SelectItem value="GRAM">Gram (G)</SelectItem>
                  <SelectItem value="LITER">Liter (L)</SelectItem>
                  <SelectItem value="ML">Milliliter (ML)</SelectItem>
                  <SelectItem value="PACK">Pack</SelectItem>
                  <SelectItem value="DOZEN">Dozen</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>Unit of measure.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="storageRequirement"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Storage Requirement</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select storage type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="AMBIENT">Ambient</SelectItem>
                  <SelectItem value="REFRIGERATED">Refrigerated</SelectItem>
                  <SelectItem value="FROZEN">Frozen</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>Required storage condition.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="taxRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tax Rate (%)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="e.g., 5, 12.5" className="h-11" {...field} />
              </FormControl>
              <FormDescription>Applicable tax rate.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                placeholder="A detailed description of the product..."
                rows={4}
                className="resize-none"
                {...field}
              />
            </FormControl>
            <FormDescription>Provide a detailed description.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex justify-end pt-4">
        <Button type="button" onClick={handleNext} className="gap-2 px-6">
          Next <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ProductDetailsTabContent;