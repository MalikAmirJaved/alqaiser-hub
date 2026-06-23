// src/components/reuseable/ReasonInputModal.tsx
"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, MessageSquare } from "lucide-react";

interface ReasonInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  title: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
  initialValue?: string;
}

export function ReasonInputModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  placeholder = "Enter reason...",
  confirmText = "Confirm",
  cancelText = "Cancel",
  required = false,
  initialValue = "",
}: ReasonInputModalProps) {
  const [reason, setReason] = useState(initialValue);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setReason(initialValue);
      setError("");
      setAnimateOut(false);
    }
  }, [isOpen, initialValue]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !submitting) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, submitting]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleClose = () => {
    if (submitting) return;
    setAnimateOut(true);
    setTimeout(() => {
      setAnimateOut(false);
      onClose();
    }, 200);
  };

  const handleConfirm = async () => {
    if (required && !reason.trim()) {
      setError("This field is required");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      handleClose();
    } catch {
      // Error handled by caller
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-all duration-200",
          animateOut ? "opacity-0" : "opacity-100"
        )}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "fixed left-1/2 top-0 z-50 w-full max-w-md -translate-x-1/2 transform px-4 transition-all duration-300",
          animateOut
            ? "-translate-y-full opacity-0"
            : "translate-y-8 opacity-100 sm:translate-y-12"
        )}
      >
        <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />

          {/* Close button */}
          <button
            onClick={handleClose}
            disabled={submitting}
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="p-6 pt-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {title}
                </h3>
              </div>
            </div>

            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={e => { setReason(e.target.value); if (error) setError(""); }}
                placeholder={placeholder}
                rows={4}
                disabled={submitting}
                className={cn(
                  "w-full bg-muted/40 border rounded-xl p-3 text-sm outline-none resize-none transition-colors",
                  "focus:ring-2 focus:ring-ring",
                  error ? "border-destructive ring-1 ring-destructive" : "border-border"
                )}
                autoFocus
              />
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleClose}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-md border border-border bg-transparent text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {submitting && (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ReasonInputModal;
