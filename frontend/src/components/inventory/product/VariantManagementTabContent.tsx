"use client";

import React, { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label"; // Fixed import
import { PlusCircle, ArrowLeft, Trash2, X, Plus } from "lucide-react";
import { toast } from "sonner";

interface VariantManagementTabContentProps {
  fields: Record<"id", string>[];
  handleAddVariant: () => void;
  handleRemoveImage: (variantIndex: number, imageIndex: number) => void;
  handleAddImageUrl: (variantIndex: number, url: string) => void;
  isEditing: boolean;
  setActiveTab: (tab: "product-details" | "variants") => void;
  removeVariant: (index: number) => void;
  isLoading: boolean;
}

const VariantManagementTabContent: React.FC<VariantManagementTabContentProps> = ({
  fields,
  handleAddVariant,
  handleRemoveImage,
  handleAddImageUrl,
  isEditing,
  setActiveTab,
  removeVariant,
  isLoading,
}) => {
  const { control, watch, handleSubmit } = useFormContext();
  const [newImageUrl, setNewImageUrl] = useState("");
  const [currentImageVariant, setCurrentImageVariant] = useState<number | null>(null);

  const onFormSubmit = () => {
    const submitHandler = handleSubmit(() => {});
    submitHandler();
    document.querySelector("form")?.requestSubmit();
  };

  const addImageUrl = (variantIndex: number) => {
    if (!newImageUrl.trim()) return;
    handleAddImageUrl(variantIndex, newImageUrl.trim());
    setNewImageUrl("");
    setCurrentImageVariant(null);
    toast.success("Image URL added");
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Variants ({fields.length})</h3>
          <p className="text-muted-foreground text-sm">Define variations (size, color, etc.) with unique SKU, price, stock, and images.</p>
        </div>
        <Button type="button" onClick={handleAddVariant} size="sm" className="gap-2">
          <PlusCircle className="h-4 w-4" /> Add Variant
        </Button>
      </div>

      {fields.map((_, idx) => (
        <div key={idx} className="bg-card rounded-xl border border-border overflow-hidden shadow-sm transition-all hover:shadow-md">
          <div className="bg-muted/30 px-6 py-3 border-b border-border flex justify-between items-center">
            <h4 className="font-medium">Variant #{idx + 1}</h4>
            {fields.length > 1 && (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(idx)} className="text-destructive hover:text-destructive h-8 w-8">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="p-6 space-y-6">
            {/* Basic fields grid */}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={control}
                name={`variants.${idx}.sku`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU *</FormLabel>
                    <FormControl>
                      <Input placeholder="Unique SKU" {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`variants.${idx}.barcode`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode</FormLabel>
                    <FormControl>
                      <Input placeholder="Barcode" {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`variants.${idx}.qrCode`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>QR Code URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`variants.${idx}.buyingPrice`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buying Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`variants.${idx}.sellingPrice`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling Price *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`variants.${idx}.stock`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isEditing ? "Current Stock (read‑only)" : "Initial Stock"}</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} disabled={isEditing} className="h-10" />
                    </FormControl>
                    <FormDescription>{isEditing ? "Stock changes are handled separately" : "Starting quantity"}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`variants.${idx}.minStockLevel`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Stock Level</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`variants.${idx}.maxStockLevel`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Stock Level</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Attributes section */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Attributes</Label>
              <VariantAttributes variantIndex={idx} control={control} />
            </div>

            {/* Images section */}
            <div>
              <Label className="text-base font-medium">Images (URLs)</Label>
              <div className="mt-3 flex flex-wrap gap-3 p-4 border rounded-lg bg-muted/10 min-h-[100px] items-center">
                {(watch(`variants.${idx}.images`) || []).map((url: string, imgIdx: number) => (
                  <div key={imgIdx} className="relative w-24 h-24 rounded-md overflow-hidden group border border-border shadow-sm">
                    <img src={url} alt={`Variant ${idx + 1} image`} className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveImage(idx, imgIdx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {currentImageVariant === idx ? (
                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder="https://example.com/image.jpg"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      className="w-64 h-10"
                    />
                    <Button size="sm" onClick={() => addImageUrl(idx)}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setCurrentImageVariant(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentImageVariant(idx)}
                    className="gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Image URL
                  </Button>
                )}
              </div>
              {/* Fixed: replaced FormDescription with plain paragraph */}
              <p className="text-sm text-muted-foreground mt-1">
                Enter publicly accessible image URLs (max 5 per variant).
              </p>
            </div>
          </div>
        </div>
      ))}

      <div className="flex justify-between items-center pt-6 border-t border-border">
        <Button type="button" variant="outline" onClick={() => setActiveTab("product-details")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        <Button type="button" onClick={onFormSubmit} disabled={isLoading} className="px-8">
          {isLoading ? "Saving..." : isEditing ? "Update Product" : "Create Product"}
        </Button>
      </div>
    </div>
  );
};

// Helper component for attributes array
const VariantAttributes = ({ variantIndex, control }: { variantIndex: number; control: any }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `variants.${variantIndex}.attributes`,
  });

  return (
    <div className="space-y-3">
      {fields.map((field, attrIdx) => (
        <div key={field.id} className="flex gap-3 items-start">
          <FormField
            control={control}
            name={`variants.${variantIndex}.attributes.${attrIdx}.key`}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input placeholder="Key (e.g., Color)" {...field} className="h-10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`variants.${variantIndex}.attributes.${attrIdx}.value`}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input placeholder="Value (e.g., Red)" {...field} className="h-10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(attrIdx)} className="h-10 w-10 text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => append({ key: "", value: "" })} className="gap-1">
        <PlusCircle className="h-3 w-3" /> Add Attribute
      </Button>
    </div>
  );
};

export default VariantManagementTabContent;