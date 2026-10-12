// src/components/reuseable/ImageLightbox.tsx
// Lightweight full-screen lightbox for previewing receipt/attachment images.
// The image box occupies 80% of the viewport width and height; object-contain
// keeps the aspect ratio inside that box. Closes on backdrop click, Escape, or X.
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export interface ImageLightboxProps {
  /** Image URL (absolute or app-relative like "/upload/general/x.jpg") */
  src: string;
  alt?: string;
  onClose: () => void;
}

export default function ImageLightbox({ src, alt = "Receipt", onClose }: ImageLightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Receipt preview"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close preview"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="w-[80vw] h-[80vh] object-contain rounded-lg shadow-2xl select-none"
      />
    </div>
  );
}
