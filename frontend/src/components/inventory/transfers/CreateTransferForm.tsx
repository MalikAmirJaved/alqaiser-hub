// src/components/transfers/CreateTransferForm.tsx
"use client";

import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateTransfer, } from "@/hooks/useTransfers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useAllVariantsSimple } from "@/hooks/useAllVariants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";

const transferSchema = z.object({
  variant_id: z.string().uuid("Select a valid product variant"),
  source_warehouse_id: z.string().uuid("Select source warehouse"),
  destination_warehouse_id: z.string().uuid("Select destination warehouse"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  planned_date: z.date().nullable().optional(),
  notes: z.string().optional(),
});

type TransferFormValues = z.infer<typeof transferSchema>;

interface CreateTransferFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CreateTransferForm({ onSuccess, onCancel }: CreateTransferFormProps) {
  const createTransfer = useCreateTransfer();
  const { data: warehouses = [] } = useWarehouses({ is_active: true });
  const { data: variants = [], isLoading: variantsLoading } = useAllVariantsSimple({ active_only: true });

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      quantity: 1,
      planned_date: null,
      notes: "",
    },
  });

  const selectedVariantId = watch("variant_id");
  const selectedSourceId = watch("source_warehouse_id");

  const availableVariants = variants.filter(v => !v.is_deleted);

  const onSubmit = async (data: TransferFormValues) => {
    try {
      await createTransfer.mutateAsync({
        variant_id: data.variant_id,
        source_warehouse_id: data.source_warehouse_id,
        destination_warehouse_id: data.destination_warehouse_id,
        quantity: data.quantity,
        planned_date: data.planned_date ? format(data.planned_date, "yyyy-MM-dd") : undefined,
        notes: data.notes,
      });
      onSuccess();
    } catch (error: any) {
      
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Product Variant *</Label>
        <Controller
          name="variant_id"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Select product variant" />
              </SelectTrigger>
              <SelectContent>
                {variantsLoading ? (
                  <div className="p-2 text-center">Loading...</div>
                ) : (
                  availableVariants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.product_name} - {variant.sku}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Select source warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={String(wh.id)}>
                    {wh.warehouse_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={String(wh.id)}>
                    {wh.warehouse_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {...field}
              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
            />
          )}
        />
        {errors.quantity && <p className="text-sm text-red-500">{errors.quantity.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Planned Date</Label>
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