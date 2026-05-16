// src/components/inventory/StockAdjustModal.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAdjustStock } from "@/hooks/useStockManagement";
import { useWarehouses } from "@/hooks/useWarehouses";
import { Dialog } from "@/components/ui/dialog"; // or your own modal wrapper
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const adjustSchema = z.object({
  warehouse_id: z.string().min(1, "Warehouse required"),
  quantity_change: z
  .number()
  .int()
  .refine((val) => val !== 0, {
    message: "Quantity change cannot be zero",
  }),
  reason: z.string().min(1, "Reason required"),
  transaction_type: z.enum(["DAMAGE", "ADJUSTMENT", "STOCK_TAKE"]),
});

type AdjustForm = z.infer<typeof adjustSchema>;

interface StockAdjustModalProps {
  open: boolean;
  onClose: () => void;
  variantId: string;
  variantName: string;
  currentStock?: number;
}

export function StockAdjustModal({
  open,
  onClose,
  variantId,
  variantName,
  currentStock,
}: StockAdjustModalProps) {
  const { data: warehouses } = useWarehouses({ is_active: true });
  const adjustStock = useAdjustStock();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<AdjustForm>({
    resolver: zodResolver(adjustSchema),
    defaultValues: {
      transaction_type: "ADJUSTMENT",
      quantity_change: 0,
    },
  });

  const transactionType = watch("transaction_type");
  const quantityChange = watch("quantity_change");

  const onSubmit = async (data: AdjustForm) => {
    setIsSubmitting(true);
    try {
      await adjustStock.mutateAsync({
        variant_id: variantId,
        warehouse_id: data.warehouse_id,
        quantity_change: data.quantity_change,
        reason: data.reason,
        transaction_type: data.transaction_type,
      });
      reset();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card rounded-xl border border-border w-full max-w-md p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-1">Adjust Stock</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {variantName} {currentStock !== undefined && `· Current: ${currentStock}`}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Warehouse */}
            <div>
              <Label>Warehouse</Label>
              <Select
                onValueChange={(val) => setValue("warehouse_id", val)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses?.map((wh) => (
                    <SelectItem key={wh.id} value={String(wh.id)}>
                      {wh.warehouse_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.warehouse_id && (
                <p className="text-xs text-destructive mt-1">{errors.warehouse_id.message}</p>
              )}
            </div>

            {/* Quantity Change */}
            <div>
              <Label>Quantity Change (positive = add, negative = remove)</Label>
              <Input
                type="number"
                {...register("quantity_change", { valueAsNumber: true })}
                placeholder="e.g., -5 or +10"
              />
              {errors.quantity_change && (
                <p className="text-xs text-destructive mt-1">{errors.quantity_change.message}</p>
              )}
            </div>

            {/* Transaction Type */}
            <div>
              <Label>Transaction Type</Label>
              <Select
                value={transactionType}
                onValueChange={(val: any) => setValue("transaction_type", val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                  <SelectItem value="DAMAGE">Damage / Write-off</SelectItem>
                  <SelectItem value="STOCK_TAKE">Stock Take Correction</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div>
              <Label>Reason</Label>
              <Input {...register("reason")} placeholder="e.g., Physical count correction" />
              {errors.reason && (
                <p className="text-xs text-destructive mt-1">{errors.reason.message}</p>
              )}
            </div>

            {/* Warning for negative quantity */}
            {quantityChange < 0 && currentStock !== undefined && currentStock + quantityChange < 0 && (
              <div className="rounded-md bg-warning/10 border border-warning/20 p-2 text-sm text-warning">
                ⚠️ This adjustment would make stock negative ({currentStock + quantityChange}).
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Processing..." : "Confirm Adjustment"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Dialog>
  );
}