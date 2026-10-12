// src/components/reuseable/ReceiptUpload.tsx
// Compact single-image uploader for payment receipts (payroll, POS, invoice/bill payments).
// Uploads immediately on select via the shared /api/common/upload/ endpoint and reports
// the stored relative URL (e.g. "/upload/general/abc.jpg") through onChange.
"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2, Receipt } from "lucide-react";
import { BASE_URL } from "@/lib/api";
import { toast } from "sonner";

export interface ReceiptUploadProps {
  /** Stored receipt URL (relative, e.g. "/upload/general/abc.jpg") */
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
}

const MAX_FILE_SIZE_MB = 10;
const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

export default function ReceiptUpload({
  value = "",
  onChange,
  label = "Receipt image",
  hint,
  disabled = false,
}: ReceiptUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file?: File | null) => {
    if (!file || disabled || uploading) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Receipt must be a JPG, PNG, GIF or WEBP image");
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Receipt image must be under ${MAX_FILE_SIZE_MB} MB`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("module", "general");
      formData.append("type", "image");
      const res = await fetch(`${BASE_URL}/api/common/upload/`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      onChange(data.url);
    } catch (error: any) {
      toast.error(`Failed to upload receipt: ${error.message}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Receipt className="w-3 h-3" /> {label}
        {hint && <span className="font-normal text-muted-foreground/70">{hint}</span>}
      </span>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {value ? (
        <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-border group">
          <img
            src={`${BASE_URL}${value}`}
            alt="Receipt"
            className="w-full h-full object-cover"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove receipt"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" /> Upload receipt image
            </>
          )}
        </button>
      )}
      {value && !disabled && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-[11px] text-primary hover:underline disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Replace image"}
        </button>
      )}
    </div>
  );
}
