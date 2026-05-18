// src/app/inventory/transfers/[id]/page.tsx
"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTransfer, useConfirmTransfer, useCancelTransfer } from "@/hooks/useTransfers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle, XCircle, Calendar, Package, Warehouse, Hash, FileText } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import ConfirmationModal from "@/components/reuseable/ConfirmationModal";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  PENDING: { label: "Pending", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

export default function TransferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data: transfer, isLoading, refetch } = useTransfer(id);
  const confirmMutation = useConfirmTransfer();
  const cancelMutation = useCancelTransfer();

  const handleConfirm = async () => {
    if (!transfer) return;
    try {
      await confirmMutation.mutateAsync(transfer.id);
      refetch();
    } catch (error: any) {
    } finally {
      setShowConfirmModal(false);
    }
  };

  const handleCancel = async () => {
    if (!transfer) return;
    try {
      await cancelMutation.mutateAsync(transfer.id);
      refetch();
    } catch (error: any) {
    } finally {
      setShowCancelModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Transfer not found</p>
            <div className="flex justify-center mt-4">
              <Link href="/inventory/transfers">
                <Button variant="outline">Back to Transfers</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[transfer.status] || { label: transfer.status, variant: "default" };
  const isPending = transfer.status === "PENDING";

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory/transfers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Transfer #{transfer.transfer_number}</h1>
          <Badge variant={status.variant as any}>{status.label}</Badge>
        </div>
        {isPending && (
          <div className="flex gap-2">
            <Button onClick={() => setShowConfirmModal(true)} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="mr-2 h-4 w-4" /> Confirm Transfer
            </Button>
            <Button onClick={() => setShowCancelModal(true)} variant="destructive">
              <XCircle className="mr-2 h-4 w-4" /> Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Product Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Product:</span>
              <span className="font-medium">{transfer.variant_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SKU:</span>
              <span className="font-mono text-sm">{transfer.variant_sku}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantity:</span>
              <span className="font-semibold">{transfer.quantity}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" /> Warehouse Transfer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">From:</span>
              <span className="font-medium">{transfer.source_warehouse_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">To:</span>
              <span className="font-medium">{transfer.destination_warehouse_name}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Planned Date:</span>
              <span>{transfer.planned_date ? format(new Date(transfer.planned_date), "PPP") : "Not set"}</span>
            </div>
            {transfer.completed_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed At:</span>
                <span>{format(new Date(transfer.completed_at), "PPP p")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Additional Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <span className="text-muted-foreground">Notes:</span>
                <p className="mt-1 text-sm">{transfer.notes || "No notes provided"}</p>
              </div>
              <Separator />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Created: {format(new Date(transfer.created_at), "PPP p")}</span>
                <span>Last Updated: {format(new Date(transfer.updated_at), "PPP p")}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirm}
        title="Confirm Stock Transfer"
        message={`Are you sure you want to confirm transfer #${transfer.transfer_number}? This will immediately move ${transfer.quantity} units from ${transfer.source_warehouse_name} to ${transfer.destination_warehouse_name}.`}
        confirmText="Confirm"
        isLoading={confirmMutation.isPending}
      />

      <ConfirmationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
        title="Cancel Stock Transfer"
        message={`Are you sure you want to cancel transfer #${transfer.transfer_number}? This action cannot be undone.`}
        confirmText="Cancel Transfer"
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}