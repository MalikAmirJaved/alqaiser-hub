// src/components/transfers/TransferList.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useTransfers, useTransferStats, useConfirmTransfer, useCancelTransfer } from "@/hooks/useTransfers";
import {TableView} from "@/components/reuseable/TableGridView";
import {StatsCards} from "@/components/reuseable/StatsCards";
import ConfirmationModal from "@/components/reuseable/ConfirmationModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import type { PermissionActions } from "@/lib/permissions";

interface TransferListProps {
  refreshTrigger?: number;
  onTransferCompleted?: () => void;
  permissions?: PermissionActions;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  PENDING: { label: "Pending", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

export default function TransferList({ refreshTrigger, onTransferCompleted, permissions }: TransferListProps) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<"confirm" | "cancel" | null>(null);

  const { data: transfers = [], isLoading, refetch } = useTransfers({
  status: statusFilter === "all" ? undefined : statusFilter
});
  const { data: stats, refetch: refetchStats } = useTransferStats();

  const confirmMutation = useConfirmTransfer();
  const cancelMutation = useCancelTransfer();

  useEffect(() => {
    refetch();
    refetchStats();
  }, [refreshTrigger, statusFilter, refetch, refetchStats]);

  const handleConfirm = async () => {
    if (!selectedTransfer) return;
    try {
      await confirmMutation.mutateAsync(selectedTransfer.id);
      refetch();
      refetchStats();
      onTransferCompleted?.();
    } catch (error: any) {
    } finally {
      setSelectedTransfer(null);
      setConfirmAction(null);
    }
  };

  const handleCancel = async () => {
    if (!selectedTransfer) return;
    try {
      await cancelMutation.mutateAsync(selectedTransfer.id);
      refetch();
      refetchStats();
      onTransferCompleted?.();
    } catch (error: any) {
    } finally {
      setSelectedTransfer(null);
      setConfirmAction(null);
    }
  };

const statsData = stats
  ? [
      {
        id: "pending",
        label: "Pending",
        value: stats.pending,
        valueClassName: "text-yellow-600",
      },
      {
        id: "completed",
        label: "Completed",
        value: stats.completed,
        valueClassName: "text-green-600",
      },
      {
        id: "cancelled",
        label: "Cancelled",
        value: stats.cancelled,
        valueClassName: "text-red-600",
      },
      {
        id: "total",
        label: "Total",
        value: stats.total,
        valueClassName: "text-blue-600",
      },
    ]
  : [];

const columns = [
  { key: "transfer_number", label: "Transfer #", sortable: true },
{
  key: "variant_name",
  label: "Product",
  render: (_value: any, row: any) =>
    `${row.variant_name} (${row.variant_sku})`,
},
  { key: "source_warehouse_name", label: "From" },
  { key: "destination_warehouse_name", label: "To" },
  { key: "quantity", label: "Qty", className: "text-right" },
  {
    key: "status",
    label: "Status",
    render: (row: any) => {
      const config = statusConfig[row.status] || {
        label: row.status,
        variant: "default",
      };
      return <Badge variant={config.variant as any}>{config.label}</Badge>;
    },
  },
  {
    key: "planned_date",
    label: "Planned Date",
    render: (value: any) =>
      value ? format(new Date(value), "dd MMM yyyy") : "-",
  },
];

  const actions = (row: any) => (
    <div className="flex items-center gap-2">
      <Link href={`/inventory/transfers/${row.id}`}>
        <Button variant="ghost" size="icon" title="View Details">
          <Eye className="h-4 w-4" />
        </Button>
      </Link>
      {row.status === "PENDING" && (
        <>
          {permissions?.confirm && (
            <Button
              variant="ghost"
              size="icon"
              className="text-green-600"
              onClick={() => {
                setSelectedTransfer(row);
                setConfirmAction("confirm");
              }}
              title="Confirm Transfer"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
    </div>
  );

  const filterBar = (
    <div className="flex items-center gap-4 mb-4">
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="PENDING">Pending</SelectItem>
          <SelectItem value="COMPLETED">Completed</SelectItem>
          <SelectItem value="CANCELLED">Cancelled</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      {statsData.length > 0 && <StatsCards stats={statsData} />}

      {filterBar}

     <TableView
  columns={columns}
  data={transfers}
  actions={actions}
  loading={isLoading}
  emptyMessage="No stock transfers found"
/>

      <ConfirmationModal
        isOpen={confirmAction !== null}
        onClose={() => {
          setSelectedTransfer(null);
          setConfirmAction(null);
        }}
        onConfirm={confirmAction === "confirm" ? handleConfirm : handleCancel}
        title={confirmAction === "confirm" ? "Confirm Transfer" : "Cancel Transfer"}
        message={
          confirmAction === "confirm"
            ? `Are you sure you want to confirm transfer ${selectedTransfer?.transfer_number}? This will move stock immediately.`
            : `Are you sure you want to cancel transfer ${selectedTransfer?.transfer_number}?`
        }
        confirmText={confirmAction === "confirm" ? "Confirm" : "Cancel"}
        isLoading={confirmMutation.isPending || cancelMutation.isPending}
      />
    </div>
  );
}