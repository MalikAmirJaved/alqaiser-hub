// src/components/transfers/CreateTransferForm.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateTransfer } from "@/hooks/useTransfers";
import { useApi } from "@/hooks/useApi";
import { useWarehouses } from "@/hooks/useWarehouses";
import type { Product } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";

const transferSchema = z.object({
  product_id: z.string().uuid("Select a product"),
  variant_id: z.string().uuid("Select a variant"),
  source_warehouse_id: z.string().uuid("Select source warehouse"),
  destination_warehouse_id: z.string().uuid("Select destination warehouse"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  planned_date: z.date({ required_error: "Planned date is required" }),
  notes: z.string().optional(),
});

type TransferFormValues = z.infer<typeof transferSchema>;

interface CreateTransferFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  fetchProducts?: (params: { search: string; page: number; pageSize: number }) => Promise<{ options: { value: string; label: string }[]; hasMore: boolean; totalCount: number }>;
  fetchWarehouses?: (params: { search: string; page: number; pageSize: number }) => Promise<{ options: { value: string; label: string }[]; hasMore: boolean; totalCount: number }>;
}

export default function CreateTransferForm({ onSuccess, onCancel, fetchProducts, fetchWarehouses }: CreateTransferFormProps) {
  const createTransfer = useCreateTransfer();
  const api = useApi();
  const [fullProduct, setFullProduct] = useState<Product | null>(null);
  const { data: allWarehouses = [] } = useWarehouses({ is_active: true });

  const {
    control,
    handleSubmit,
    watch,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      quantity: 1,
      planned_date: new Date(),
      notes: "",
    },
  });

  const selectedProductId = watch("product_id");
  const selectedVariantId = watch("variant_id");
  const selectedSourceId = watch("source_warehouse_id");

  const selectedProduct = fullProduct;

  const productVariants = useMemo(
    () => selectedProduct?.variants.filter((v) => !v.is_deleted) ?? [],
    [selectedProduct]
  );

  const selectedVariant = useMemo(
    () => productVariants.find((v) => v.id === selectedVariantId),
    [productVariants, selectedVariantId]
  );

  const warehousesWithStock = useMemo(() => {
    if (!selectedVariant) return [];
    const stockMap = new Map(
      selectedVariant.stock_by_warehouse.map((sw) => [sw.warehouse_id, sw.quantity_on_hand])
    );
    return allWarehouses.map((wh) => ({
      warehouse_id: wh.id,
      warehouse_name: wh.warehouse_name,
      quantity_on_hand: stockMap.get(wh.id) ?? 0,
    }));
  }, [selectedVariant, allWarehouses]);

  const sourceWarehouses = warehousesWithStock;

  const destinationWarehouses = useMemo(
    () => warehousesWithStock.filter((sw) => sw.warehouse_id !== selectedSourceId),
    [warehousesWithStock, selectedSourceId]
  );

  const getSourceStock = (warehouseId: string) => {
    const entry = warehousesWithStock.find((sw) => sw.warehouse_id === warehouseId);
    return entry?.quantity_on_hand ?? 0;
  };

  const handleProductChange = (value: string) => {
    resetField("variant_id");
    resetField("source_warehouse_id");
    resetField("destination_warehouse_id");
  };

  const handleVariantChange = (value: string) => {
    resetField("source_warehouse_id");
    resetField("destination_warehouse_id");
  };

  const handleSourceChange = (value: string) => {
    resetField("destination_warehouse_id");
  };

  const onSubmit = async (data: TransferFormValues) => {
    try {
      await createTransfer.mutateAsync({
        variant_id: data.variant_id,
        source_warehouse_id: data.source_warehouse_id,
        destination_warehouse_id: data.destination_warehouse_id,
        quantity: data.quantity,
        planned_date: format(data.planned_date, "yyyy-MM-dd"),
        notes: data.notes,
      });
      onSuccess();
    } catch (error: any) {
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Product *</Label>
        <Controller
          name="product_id"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value || ""}
              onChange={async (value) => {
                field.onChange(value);
                handleProductChange(value);
                if (value) {
                  try {
                    const data: Product = await api(`/api/inventory/products/${value}/`);
                    setFullProduct(data);
                  } catch {
                    setFullProduct(null);
                  }
                } else {
                  setFullProduct(null);
                }
              }}
              fetchOptions={fetchProducts}
              placeholder="Select product"
            />
          )}
        />
        {errors.product_id && <p className="text-sm text-red-500">{errors.product_id.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Variant *</Label>
        <Controller
          name="variant_id"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value || ""}
              onChange={(value) => {
                field.onChange(value);
                handleVariantChange(value);
              }}
              options={productVariants.map((variant) => ({ value: variant.id, label: `${variant.sku} - ${variant.variant_title}` }))}
              placeholder={selectedProductId ? "Select variant" : "Select product first"}
              disabled={!selectedProductId}
            />
          )}
        />
        {errors.variant_id && <p className="text-sm text-red-500">{errors.variant_id.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Source Warehouse *</Label>
        <Controller
          name="source_warehouse_id"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value || ""}
              onChange={(value) => {
                field.onChange(value);
                handleSourceChange(value);
              }}
              options={sourceWarehouses.map((sw) => ({ value: sw.warehouse_id, label: `${sw.warehouse_name} — Stock: ${sw.quantity_on_hand}` }))}
              placeholder={selectedVariantId ? "Select source warehouse" : "Select variant first"}
              disabled={!selectedVariantId}
            />
          )}
        />
        {errors.source_warehouse_id && <p className="text-sm text-red-500">{errors.source_warehouse_id.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Destination Warehouse *</Label>
        <Controller
          name="destination_warehouse_id"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value || ""}
              onChange={field.onChange}
              options={destinationWarehouses.map((sw) => ({ value: sw.warehouse_id, label: sw.warehouse_name }))}
              placeholder={selectedSourceId ? "Select destination warehouse" : "Select source first"}
              disabled={!selectedSourceId}
            />
          )}
        />
        {errors.destination_warehouse_id && <p className="text-sm text-red-500">{errors.destination_warehouse_id.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Quantity *</Label>
        <Controller
          name="quantity"
          control={control}
          render={({ field }) => (
            <Input
              type="number"
              min={1}
              max={selectedSourceId ? getSourceStock(selectedSourceId) : undefined}
              {...field}
              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
            />
          )}
        />
        {errors.quantity && <p className="text-sm text-red-500">{errors.quantity.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Planned Date *</Label>
        <Controller
          name="planned_date"
          control={control}
          render={({ field }) => (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value ? format(field.value, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus />
              </PopoverContent>
            </Popover>
          )}
        />
        {errors.planned_date && <p className="text-sm text-red-500">{errors.planned_date.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Controller
          name="notes"
          control={control}
          render={({ field }) => <Input {...field} placeholder="Optional notes" />}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Transfer
        </Button>
      </div>
    </form>
  );
}
