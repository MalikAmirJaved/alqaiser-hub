// frontend/src/components/inventory/warehouse/WarehouseDetail.tsx

import { X, MapPin, Mail, Package, Edit, Trash2, User, Phone, FileText } from "lucide-react";
import { Warehouse } from "@/hooks/useWarehouses";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface WarehouseDetailProps {
  warehouse: Warehouse | null;
  onClose: () => void;
  onEdit?: (warehouse: Warehouse) => void;
  onDelete?: (warehouse: Warehouse) => void;
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
          <div className="p-6 space-y-6">
            {/* Employee Info */}
            {warehouse.employee_name && (
              <div className="bg-muted/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <User className="w-4 h-4" />
                  <span>Responsible Employee</span>
                </div>
                <p className="text-foreground font-medium">{warehouse.employee_name}</p>
              </div>
            )}

            {/* Landline */}
            {warehouse.landline_number && (
              <div className="bg-muted/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Phone className="w-4 h-4" />
                  <span>Landline</span>
                </div>
                <p className="text-foreground">{warehouse.landline_number}</p>
              </div>
            )}

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

            {/* Email */}
            {warehouse.email && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </div>
                <p className="text-sm text-muted-foreground pl-6">{warehouse.email}</p>
              </div>
            )}

            {/* Description */}
            {warehouse.description && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FileText className="w-4 h-4" />
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
        {(onEdit || onDelete) && (
          <div className="sticky bottom-0 bg-card border-t border-border p-4 flex gap-3">
            {onEdit && (
              <button
                onClick={() => onEdit(warehouse)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 h-9 rounded-md border border-border bg-transparent text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(warehouse)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 h-9 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}