// src/components/inventory/product/ImportUploadModal.tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { X, Upload, FileSpreadsheet, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImportParse } from "@/hooks/useProductExportImport";
import type { ImportRow } from "@/hooks/useProductExportImport";

const ACCEPTED_TYPES = ".xlsx,.xls,.csv";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const TEMPLATE_COLUMNS = [
  "Product Name",
  "Product Description",
  "Category",
  "Brand",
  "Unit",
  "Storage Requirement",
  "Tax Rate (%)",
  "Variant SKU",
  "Variant Title",
  "Variant Barcode",
  "Buying Price",
  "Selling Price",
  "Min Stock Level",
  "Max Stock Level",
];

// Note: Status is removed from import — imported products always get status='active'.

interface ImportUploadModalProps {
  open: boolean;
  onClose: () => void;
  onParsed: (rows: ImportRow[], source: string) => void;
}

export default function ImportUploadModal({
  open,
  onClose,
  onParsed,
}: ImportUploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importParse = useImportParse();

  const isParsing = importParse.isPending;

  const validateFile = useCallback((file: File): string | null => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
      return "Invalid file format. Please upload .xlsx, .xls, or .csv files only.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size exceeds 10 MB limit.";
    }
    return null;
  }, []);

  const handleUploadAndParse = useCallback(async (file: File) => {
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "xlsx";
    const source = ext === "csv" ? "csv" : "excel";

    try {
      const result = await importParse.mutateAsync(file);
      const parsedRows = result.data?.rows;
      if (parsedRows && parsedRows.length > 0) {
        onParsed(parsedRows, source);
      } else {
        setSelectedFile(null);
        setError("The file contains no data rows to import. Check your file and try again.");
      }
    } catch (err: any) {
      setSelectedFile(null);
      setError(err.message || "Failed to parse file");
    }
  }, [importParse, onParsed]);

  const handleFileSelect = useCallback((file: File) => {
    if (isParsing) return;
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSelectedFile(file);
    handleUploadAndParse(file);
  }, [validateFile, handleUploadAndParse, isParsing]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleBrowse = () => {
    if (isParsing) return;
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isParsing) return;
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDownloadTemplate = async () => {
    const ext = "xlsx";
    const params = new URLSearchParams({ format: ext });
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
    let downloaded = false;

    try {
      // First try the server endpoint
      const res = await fetch(
        `${BASE_URL}/api/inventory/products/import/template/?${params.toString()}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `product_import_template.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        downloaded = true;
      }
    } catch {
      // Server unavailable - fall through to client-side generation
    }

    // Client-side fallback if server didn't work
    if (!downloaded) {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS]);
      XLSX.utils.book_append_sheet(wb, ws, "Products");
      const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbOut], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "product_import_template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Import Products</h2>
              <p className="text-xs text-muted-foreground">
                Upload an Excel or CSV file
              </p>
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
          {/* File Format Info */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Expected Format</h3>
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                Download Sample Template
              </button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Required columns (in any order):</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                {TEMPLATE_COLUMNS.map((col) => (
                  <span key={col} className="font-mono text-[11px]">
                    • {col}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Drop Zone */}
          <div
            onDrop={isParsing ? undefined : handleDrop}
            onDragOver={isParsing ? undefined : handleDragOver}
            onDragLeave={isParsing ? undefined : handleDragLeave}
            onClick={handleBrowse}
            className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              isParsing
                ? "border-muted/40 bg-muted/10 cursor-wait"
                : dragOver
                ? "border-primary bg-primary/5 scale-[1.02] cursor-pointer"
                : selectedFile
                ? "border-success/50 bg-success/5 cursor-pointer"
                : "border-border hover:border-muted-foreground/40 hover:bg-muted/10 cursor-pointer"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleInputChange}
              className="hidden"
              disabled={isParsing}
            />

            {isParsing ? (
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Parsing file...</p>
                <p className="text-xs text-muted-foreground/60">{selectedFile?.name}</p>
              </div>
            ) : selectedFile ? (
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                  <FileSpreadsheet className="w-5 h-5 text-success" />
                </div>
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">
                  Drop your file here, or{" "}
                  <span className="text-primary hover:underline">browse</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports .xlsx, .xls, and .csv files
                </p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-border bg-muted/20">
          <Button type="button" variant="outline" onClick={onClose} disabled={isParsing}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
