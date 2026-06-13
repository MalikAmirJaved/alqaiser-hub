// src/components/inventory/WarehouseDetail.tsx
"use client";

import { useState } from "react";
import { X, MapPin, Phone, Mail, Package, TrendingUp, Edit, Trash2, Activity } from "lucide-react";
import { Warehouse } from "@/hooks/useWarehouses";
import { cn } from "@/lib/utils";

interface WarehouseDetailProps {
  warehouse: Warehouse | null;
  onClose: () => void;
  onEdit: (warehouse: Warehouse) => void;
  onDelete: (warehouse: Warehouse) => void;
  isOpen: boolean;
}

export function WarehouseDetail({ warehouse, onClose, onEdit, onDelete, isOpen }: WarehouseDetailProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClose = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsAnimating(false);
      onClose();
    }, 200);
  };

  if (!warehouse) return null;

  const getStatusColor = (percentage: number) => {
    if (percentage < 60) return "text-success bg-success/10";
    if (percentage < 85) return "text-warning bg-warning/10";
    return "text-destructive bg-destructive/10";
  };

  const getOccupancyStatus = (percentage: number) => {
    if (percentage < 60) return "Optimal";
    if (percentage < 85) return "Moderate";
    if (percentage < 95) return "High";
    return "Critical";
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-all duration-200",
          isOpen && !isAnimating ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-full max-w-md bg-card border-l border-border shadow-2xl transition-transform duration-300",
          isOpen && !isAnimating ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{warehouse.warehouse_name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{warehouse.code}</p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-73px)]">
          {/* Stats Cards */}
          <div className="p-6 space-y-6">
            {/* Occupancy Status */}
            <div className="bg-muted/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="w-4 h-4" />
                  <span>Occupancy Rate</span>
                </div>
                <span className={cn("text-sm font-semibold px-2 py-1 rounded-full", getStatusColor(warehouse.occupancy_percentage))}>
                  {getOccupancyStatus(warehouse.occupancy_percentage)}
                </span>
              </div>
              <div className="relative">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(warehouse.occupancy_percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>{warehouse.occupancy_percentage.toFixed(1)}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Capacity Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Package className="w-4 h-4" />
                  <span className="text-xs">Capacity</span>
                </div>
                <div className="text-xl font-semibold">{warehouse.capacity.toLocaleString()} sq ft</div>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs">Available</span>
                </div>
                <div className="text-xl font-semibold text-success">{warehouse.available_capacity.toLocaleString()} sq ft</div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MapPin className="w-4 h-4" />
                <span>Location</span>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground pl-6">
                {warehouse.address_line && <p>{warehouse.address_line}</p>}
                <p>
                  {warehouse.city}
                  {warehouse.state && `, ${warehouse.state}`}
                  {warehouse.country && `, ${warehouse.country}`}
                </p>
                {warehouse.postal_code && <p>Postal Code: {warehouse.postal_code}</p>}
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Phone className="w-4 h-4" />
                <span>Contact Information</span>
              </div>
              <div className="space-y-2 text-sm pl-6">
                <p>
                  <span className="text-muted-foreground">Manager:</span>{" "}
                  <span className="text-foreground">{warehouse.manager_name}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Phone:</span>{" "}
                  <span className="text-foreground">{warehouse.phone}</span>
                </p>
                {warehouse.email && (
                  <p>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    <span className="text-foreground">{warehouse.email}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            {warehouse.description && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span>Description</span>
                </div>
                <p className="text-sm text-muted-foreground pl-6">{warehouse.description}</p>
              </div>
            )}

            {/* Metadata */}
            <div className="pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
              <p>Created: {new Date(warehouse.created_at).toLocaleDateString()}</p>
              <p>Last Updated: {new Date(warehouse.updated_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-card border-t border-border p-4 flex gap-3">
          <button
            onClick={() => onEdit(warehouse)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 h-9 rounded-md border border-border bg-transparent text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => onDelete(warehouse)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 h-9 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </>
  );
}