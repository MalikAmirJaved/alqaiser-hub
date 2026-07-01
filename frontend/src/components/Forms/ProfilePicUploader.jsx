"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, CheckCircle2, AlertCircle, Loader2, ImageIcon } from "lucide-react";
import { BASE_URL } from "@/lib/api";
import { toast } from "sonner";

/**
 * ProfilePicUploader
 * 
 * - Sends file to server for VALIDATION only (face detection + resolution check)
 * - Server saves to temp → detects → deletes temp → returns {valid, message}
 * - If valid: file is kept in-component state (as a pending file with blob preview)
 * - The actual file upload to permanent storage happens in EmployeeForm.handleSubmit
 * - If user closes form without saving → no orphaned files on server
 */

export default function ProfilePicUploader({
  value = [],
  onChange,
  maxFiles = 5,
}) {
  const [dragActive, setDragActive] = useState(false);
  const [validating, setValidating] = useState({});
  const inputRef = useRef(null);

  // Cleanup blob URLs when component unmounts or value changes
  useEffect(() => {
    return () => {
      value.forEach((pic) => {
        if (pic.preview && pic.preview.startsWith("blob:")) {
          URL.revokeObjectURL(pic.preview);
        }
      });
    };
  }, []);

  const handleFiles = async (files) => {
    const fileArray = Array.from(files);
    
    if (value.length + fileArray.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} images allowed`);
      return;
    }

    for (const file of fileArray) {
      // Client-side validation
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10MB limit`);
        continue;
      }

      const validationId = `val-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      
      // Show loading state
      setValidating((prev) => ({ ...prev, [validationId]: true }));

      try {
        // Send file to server-side validation endpoint
        // The server saves to temp, runs face detection, then DELETES the temp file
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`${BASE_URL}/api/hr/employees/upload-profile-pic/`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        let data;
        try {
          data = await res.json();
        } catch {
          toast.error(`${file.name}: Server returned an invalid response`);
          continue;
        }

        if (!data || !data.valid) {
          // Validation failed — show error toast with server message
          const msg = (data && data.message) || "Failed to validate image";
          toast.error(`${file.name}: ${msg}`);
          continue;
        }

        // Validation passed — keep the file in memory (blob preview)
        const previewUrl = URL.createObjectURL(file);
        const pendingPic = {
          id: validationId,
          file: file,                    // actual File object for later upload
          preview: previewUrl,           // blob URL for preview
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
        };

        onChange([...value, pendingPic]);
        toast.success(`"${file.name}" accepted ✓`);
      } catch (error) {
        toast.error(`${file.name}: Validation failed - ${error.message}`);
      } finally {
        setValidating((prev) => {
          const next = { ...prev };
          delete next[validationId];
          return next;
        });
      }
    }

    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = (id) => {
    const toRemove = value.find((pic) => pic.id === id);
    if (toRemove && toRemove.preview?.startsWith("blob:")) {
      URL.revokeObjectURL(toRemove.preview);
    }
    onChange(value.filter((pic) => pic.id !== id));
  };

  const handleSetPrimary = (id) => {
    const reordered = value.map((pic) => ({ ...pic }));
    const idx = reordered.findIndex((p) => p.id === id);
    if (idx > 0) {
      const [item] = reordered.splice(idx, 1);
      reordered.unshift(item);
    }
    onChange(reordered);
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [value]
  );

  const hasValidatingFiles = Object.keys(validating).length > 0;

  return (
    <div>
      {/* Uploaded images grid (blob previews, no server URLs) */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {value.map((pic, idx) => (
            <div
              key={pic.id}
              className={`relative group w-24 h-24 rounded-xl overflow-hidden border-2 transition-all ${
                idx === 0
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <img
                src={pic.preview}
                alt={pic.original_filename || `Profile ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              
              {/* Primary badge */}
              {idx === 0 && (
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-primary text-[9px] font-bold text-primary-foreground shadow-md">
                  PRIMARY
                </div>
              )}

              {/* Action buttons */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(pic.id)}
                    className="p-1.5 rounded-full bg-white/90 text-primary hover:bg-white transition-all shadow-md"
                    title="Set as primary"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(pic.id)}
                  className="p-1.5 rounded-full bg-white/90 text-destructive hover:bg-white transition-all shadow-md"
                  title="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Validating indicator */}
      {hasValidatingFiles && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
          <Loader2 className="w-4 h-4 text-warning animate-spin" />
          <span className="text-xs font-medium text-warning">
            Validating profile photos (face detection, resolution check)...
          </span>
        </div>
      )}

      {/* Upload area */}
      {value.length < maxFiles && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !hasValidatingFiles && inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl transition-all cursor-pointer
            ${dragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
            }
            ${hasValidatingFiles ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.gif,.webp"
            multiple
            onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
            className="hidden"
            disabled={hasValidatingFiles}
          />

          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {dragActive ? "Drop images here" : "Click or drag profile photos"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, WebP up to 10MB each
              </p>
              <p className="text-xs text-muted-foreground">
                {value.length}/{maxFiles} validated
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info badge */}
      <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-info/5 border border-info/20">
        <AlertCircle className="w-3.5 h-3.5 text-info shrink-0 mt-0.5" />
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          <p className="font-medium text-info">Face &amp; Image Quality Validation</p>
          <p>Each photo is validated server-side for: exactly one human face, minimum 400×400px resolution, sharpness, and proper lighting. Invalid photos are rejected with an error message. Files are only saved when you submit the form.</p>
        </div>
      </div>
    </div>
  );
}
