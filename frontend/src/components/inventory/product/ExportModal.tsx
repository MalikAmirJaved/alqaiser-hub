// src/components/inventory/product/ExportModal.tsx
"use client";

import { useState } from "react";
import { X, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExportProducts } from "@/hooks/useProductExportImport";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

// ── Main Export Modal ──

export default function ExportModal({
  open,
  onClose,
}: ExportModalProps) {
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const exportMutation = useExportProducts();

  if (!open) return null;

  const handleExport = async () => {
    await exportMutation.mutateAsync({ format });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Export Products</h2>
              <p className="text-xs text-muted-foreground">Choose export options</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Format Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Format</label>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  format === "xlsx"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/20"
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                <div className="text-left">
                  <p className="text-sm font-medium">Excel (.xlsx)</p>
                  <p className="text-xs text-muted-foreground">Recommended</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-border bg-muted/20">
          <Button type="button" variant="outline" onClick={onClose} disabled={exportMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
