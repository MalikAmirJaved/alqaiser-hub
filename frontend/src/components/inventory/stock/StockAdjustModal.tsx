// src/components/inventory/StockAdjustModal.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAdjustStock } from "@/hooks/useStockManagement";
import { useWarehouses } from "@/hooks/useWarehouses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PlusCircle, MinusCircle } from "lucide-react";

const adjustSchema = z.object({
  warehouse_id: z.string().min(1, "Warehouse required"),
  direction: z.enum(["add", "remove"]),
  quantity: z.number().int().positive("Quantity must be positive"),
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
  warehouseId: string;
}

export function StockAdjustModal({
  open,
  onClose,
  variantId,
  variantName,
  currentStock = 0,
  warehouseId,
}: StockAdjustModalProps) {
  const { data: warehouses } = useWarehouses({ is_active: true });
  const adjustStock = useAdjustStock();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<AdjustForm>({
    resolver: zodResolver(adjustSchema),
    defaultValues: {
      direction: "add",
      quantity: 1,
      transaction_type: "ADJUSTMENT",
      warehouse_id: warehouseId, // initial attempt – may be overwritten after data loads
    },
  });

  const direction = watch("direction");
  const quantity = watch("quantity");
  const transactionType = watch("transaction_type");
  const selectedWarehouseId = watch("warehouse_id");

  // ✅ Auto-select warehouse once data is loaded and matches the provided warehouseId
  useEffect(() => {
    if (warehouses && warehouses.length > 0 && warehouseId) {
      const exists = warehouses.some(wh => String(wh.id) === warehouseId);
      if (exists && selectedWarehouseId !== warehouseId) {
        setValue("warehouse_id", warehouseId);
      }
    }
  }, [warehouses, warehouseId, setValue, selectedWarehouseId]);

  // Find the warehouse name for read-only display
  const selectedWarehouse = warehouses?.find(wh => String(wh.id) === selectedWarehouseId);

  const onSubmit = async (data: AdjustForm) => {
    const signedChange = data.direction === "add" ? data.quantity : -data.quantity;
    setIsSubmitting(true);
    try {
      await adjustStock.mutateAsync({
        variant_id: variantId,
        warehouse_id: data.warehouse_id,
        quantity_change: signedChange,
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

  const newStockAfter = currentStock + (direction === "add" ? quantity : -quantity);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-all ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <div className="bg-card rounded-xl border border-border w-full max-w-md p-6 shadow-xl">
        <h2 className="text-xl font-semibold mb-1">Adjust Stock</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {variantName} · Current: <span className="font-mono">{currentStock}</span>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Warehouse field – disabled when locked */}
          <div>
            <Label>Warehouse</Label>
              <div className="px-3 py-2 border rounded-md bg-muted/20 text-sm">
                {selectedWarehouse?.warehouse_name || "Loading..."}
              </div>
            {errors.warehouse_id && <p className="text-xs text-destructive mt-1">{errors.warehouse_id.message}</p>}
            {/* Hidden input ensures the value is submitted even when locked */}
            <input type="hidden" {...register("warehouse_id")} />
          </div>

          {/* Direction Toggle */}
          <div>
            <Label className="mb-2 block">Operation</Label>
            <ToggleGroup type="single" value={direction} onValueChange={(val) => val && setValue("direction", val as "add" | "remove")} className="justify-start gap-2">
              <ToggleGroupItem value="add" aria-label="Add stock" className="flex items-center gap-2 px-4">
                <PlusCircle className="w-4 h-4" /> Add Stock
              </ToggleGroupItem>
              <ToggleGroupItem value="remove" aria-label="Remove stock" className="flex items-center gap-2 px-4">
                <MinusCircle className="w-4 h-4" /> Remove Stock
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Quantity */}
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              {...register("quantity", { valueAsNumber: true })}
              min={1}
              className="font-mono"
            />
            {errors.quantity && <p className="text-xs text-destructive mt-1">{errors.quantity.message}</p>}
          </div>

          {/* Transaction Type */}
          <div>
            <Label>Transaction Type</Label>
            <Select value={transactionType} onValueChange={(val: any) => setValue("transaction_type", val)}>
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
            <Input {...register("reason")} placeholder="e.g., Physical count adjustment" />
            {errors.reason && <p className="text-xs text-destructive mt-1">{errors.reason.message}</p>}
          </div>

          {/* Preview of new stock level */}
          <div className="rounded-md bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">New stock level:</span>
              <span className={`font-mono font-medium ${newStockAfter < 0 ? "text-destructive" : ""}`}>
                {newStockAfter < 0 ? `⚠️ ${newStockAfter} (negative)` : newStockAfter}
              </span>
            </div>
          </div>

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
  );
}