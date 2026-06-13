"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateAssetPurchaseRequest } from "@/hooks/useAssetPurchaseRequests";
import { toast } from "sonner";
import { Package } from "lucide-react";

interface AssetRequestFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: {
    id: string;
    name: string;
    brand?: string;
    serial_number?: string;
  };
}

export function AssetRequestFormModal({ isOpen, onClose, asset }: AssetRequestFormModalProps) {
  const createRequest = useCreateAssetPurchaseRequest();
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [underDate, setUnderDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || quantity < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    if (!underDate) {
      toast.error("Date is required");
      return;
    }

    try {
      await createRequest.mutateAsync({
        asset: asset.id,
        quantity,
        reason: reason.trim(),
        under_date: underDate,
      });
      toast.success("Purchase request submitted");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Asset Purchase</DialogTitle>
          <DialogDescription>
            Submit a purchase request for this asset
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
              <Package className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{asset.name}</p>
                {asset.brand && (
                  <p className="text-xs text-muted-foreground">{asset.brand}</p>
                )}
                {asset.serial_number && (
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{asset.serial_number}</code>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                placeholder="Number of units needed"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this asset needed?"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="underDate">Required By *</Label>
              <Input
                id="underDate"
                type="date"
                value={underDate}
                onChange={(e) => setUnderDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              <p className="text-xs text-muted-foreground">Date by which this asset is needed</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createRequest.isPending}>
              {createRequest.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
