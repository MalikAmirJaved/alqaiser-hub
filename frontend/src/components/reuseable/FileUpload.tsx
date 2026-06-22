"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, FileText, Image as ImageIcon, CheckCircle } from "lucide-react";
import { BASE_URL } from "@/lib/api";
import { toast } from "sonner";

export interface PendingFile {
  id: string;
  file: File;
  preview: string;
  fieldName: string;
}

export interface UploadDocItem {
  file_url: string;
  file_url_thumb?: string;
  original_filename?: string;
  title?: string;
  [key: string]: unknown;
}

export type UploadValue = string | UploadDocItem | (string | UploadDocItem)[];

export interface FileUploadProps {
  value?: UploadValue;
  onChange?: (urls: string | UploadDocItem | (string | UploadDocItem)[]) => void;
  module: string;
  submodule?: string;
  type?: "image" | "document" | "all";
  multiple?: boolean;
  accept?: string;
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
  maxFiles?: number;
  pendingFiles?: PendingFile[];
  onPendingFilesChange?: (files: PendingFile[]) => void;
  fieldName?: string;
}

const MAX_FILE_SIZE_MB = 10;

export function getAcceptString(type: string, accept?: string): string {
  if (accept) return accept;
  if (type === "image") return ".jpg,.jpeg,.png,.gif,.webp";
  if (type === "document") return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";
  return ".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";
}

export async function uploadFiles(
  files: PendingFile[],
  onProgress?: (uploaded: number, total: number) => void
): Promise<{ fieldName: string; url: string; url_thumb: string; url_detail: string }[]> {
  const results: { fieldName: string; url: string; url_thumb: string; url_detail: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    const pf = files[i];
    const formData = new FormData();
    formData.append("file", pf.file);
    formData.append("module", extractModuleFromFieldName(pf.fieldName));
    formData.append("submodule", extractSubmoduleFromFieldName(pf.fieldName));
    formData.append("type", "all");

    try {
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
      results.push({
        fieldName: pf.fieldName,
        url: data.url,
        url_thumb: data.url_thumb || data.url,
        url_detail: data.url_detail || data.url,
      });
      onProgress?.(i + 1, files.length);
    } catch (error: any) {
      toast.error(`Failed to upload ${pf.file.name}: ${error.message}`);
      throw error;
    }
  }

  return results;
}

export async function deleteUploadedFiles(urls: string[]): Promise<void> {
  for (const url of urls) {
    try {
      await fetch(`${BASE_URL}/api/common/upload/`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    } catch {
      // Silent fail for rollback
    }
  }
}

function extractModuleFromFieldName(fieldName: string): string {
  const parts = fieldName.split(".");
  if (parts[0] === "profile_picture") return "employee";
  if (parts[0] === "education_documents") return "employee";
  if (parts[0] === "experience_documents") return "employee";
  if (parts[0] === "variants") return "inventory";
  if (parts[0] === "logo") return "company";
  return "general";
}

function extractSubmoduleFromFieldName(fieldName: string): string {
  const parts = fieldName.split(".");
  if (parts[0] === "profile_picture") return "profile";
  if (parts[0] === "education_documents") return "education";
  if (parts[0] === "experience_documents") return "experience";
  if (parts[0] === "variants") return "product";
  if (parts[0] === "logo") return "logo";
  return "";
}

export default function FileUpload({
  value,
  onChange,
  module,
  submodule = "",
  type = "all",
  multiple = false,
  accept,
  label = "Upload File",
  description,
  className = "",
  disabled = false,
  maxFiles = 10,
  pendingFiles = [],
  onPendingFilesChange,
  fieldName = "",
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptStr = getAcceptString(type, accept);
  const existingItems: (string | UploadDocItem)[] = Array.isArray(value) ? value : value ? [value] : [];
  const existingUrls = existingItems.map((item) => (typeof item === "string" ? item : item.file_url)).filter(Boolean);
  const fieldPending = pendingFiles.filter((f) => f.fieldName === fieldName);
  const totalFiles = existingUrls.length + fieldPending.length;

  useEffect(() => {
    return () => {
      fieldPending.forEach((pf) => URL.revokeObjectURL(pf.preview));
    };
  }, []);

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    if (totalFiles + fileArray.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const newPending: PendingFile[] = fileArray.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      fieldName,
    }));

    onPendingFilesChange?.([...pendingFiles, ...newPending]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemoveExisting = (urlToRemove: string) => {
    if (multiple) {
      const filtered = existingItems.filter((item) => {
        const itemUrl = typeof item === "string" ? item : item.file_url;
        return itemUrl !== urlToRemove;
      });
      onChange?.(filtered);
    } else {
      onChange?.("");
    }
  };

  const handleRemovePending = (id: string) => {
    const toRemove = pendingFiles.find((f) => f.id === id);
    if (toRemove) URL.revokeObjectURL(toRemove.preview);
    onPendingFilesChange?.(pendingFiles.filter((f) => f.id !== id));
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (disabled) return;
      if (e.dataTransfer.files?.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, pendingFiles, existingUrls, fieldName]
  );

  const isImageFile = (file: File) => file.type.startsWith("image/");
  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  return (
    <div className={className}>
      {label && (
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
          {label}
        </label>
      )}

      {(existingItems.length > 0 || fieldPending.length > 0) && (
        <div className={`mb-3 ${multiple ? "flex flex-wrap gap-2" : ""}`}>
          {existingItems.map((item, idx) => {
            const url = typeof item === "string" ? item : item.file_url;
            const thumbUrl = typeof item === "string" ? item : (item.file_url_thumb || item.file_url);
            const displayName = typeof item === "string" ? url.split("/").pop() : (item.original_filename || item.title || url.split("/").pop());
            return (
            <div
              key={`existing-${idx}`}
              className={`relative group ${
                multiple
                  ? "w-20 h-20 rounded-lg overflow-hidden border border-border"
                  : "rounded-xl overflow-hidden border border-border max-w-xs"
              }`}
            >
              {isImageUrl(url) ? (
                <img
                  src={`${BASE_URL}${thumbUrl}`}
                  alt={`Upload ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30 p-2 min-h-[80px]">
                  <FileText className="w-8 h-8 text-muted-foreground mb-1" />
                  <span className="text-[10px] text-muted-foreground text-center truncate w-full px-1">
                    {displayName}
                  </span>
                </div>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveExisting(url)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            );
          })}

          {fieldPending.map((pf) => (
            <div
              key={pf.id}
              className={`relative group ${
                multiple
                  ? "w-20 h-20 rounded-lg overflow-hidden border border-border"
                  : "rounded-xl overflow-hidden border border-border max-w-xs"
              }`}
            >
              {isImageFile(pf.file) ? (
                <img
                  src={pf.preview}
                  alt={pf.file.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30 p-2 min-h-[80px]">
                  <FileText className="w-8 h-8 text-muted-foreground mb-1" />
                  <span className="text-[10px] text-muted-foreground text-center truncate w-full px-1">
                    {pf.file.name}
                  </span>
                </div>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemovePending(pf.id)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {(!multiple && (existingUrls.length > 0 || fieldPending.length > 0)) ? null : (
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all cursor-pointer
          ${dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptStr}
          multiple={multiple}
          onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Upload className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {dragActive ? "Drop file here" : "Click or drag to select"}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Max {MAX_FILE_SIZE_MB}MB {multiple ? `• Up to ${maxFiles} files` : ""}
            </p>
            {fieldPending.length > 0 && (
              <p className="text-xs text-warning mt-1 font-medium">
                {fieldPending.length} file(s) pending upload
              </p>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
