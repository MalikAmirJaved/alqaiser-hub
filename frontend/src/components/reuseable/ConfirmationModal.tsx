// src/components/reuseable/ConfirmationModal.tsx
"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Trash2, RefreshCw, CheckCircle, X, AlertCircle } from "lucide-react";

export type ConfirmationType = "danger" | "warning" | "info" | "success";

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  type?: ConfirmationType;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  showCancelButton?: boolean;
  icon?: React.ReactNode;
}

const typeConfig: Record<ConfirmationType, {
  icon: React.ReactNode;
  confirmButtonClass: string;
  iconBgClass: string;
  iconColorClass: string;
}> = {
  danger: {
    icon: <Trash2 className="w-5 h-5" />,
    confirmButtonClass: "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
    iconBgClass: "bg-destructive/15",
    iconColorClass: "text-destructive",
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" />,
    confirmButtonClass: "bg-warning hover:bg-warning/90 text-warning-foreground",
    iconBgClass: "bg-warning/15",
    iconColorClass: "text-warning",
  },
  info: {
    icon: <AlertCircle className="w-5 h-5" />,
    confirmButtonClass: "bg-info hover:bg-info/90 text-info-foreground",
    iconBgClass: "bg-info/15",
    iconColorClass: "text-info",
  },
  success: {
    icon: <CheckCircle className="w-5 h-5" />,
    confirmButtonClass: "bg-success hover:bg-success/90 text-success-foreground",
    iconBgClass: "bg-success/15",
    iconColorClass: "text-success",
  },
};

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = "danger",
  confirmText = "Confirm",
  cancelText = "Cancel",
  isLoading = false,
  showCancelButton = true,
  icon,
}: ConfirmationModalProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);

  const config = typeConfig[type];
  const isLoadingState = isLoading || internalLoading;

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoadingState) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isLoadingState]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    if (isLoadingState) return;
    setAnimateOut(true);
    setTimeout(() => {
      setAnimateOut(false);
      onClose();
    }, 200);
  };

  const handleConfirm = async () => {
    if (isLoadingState) return;
    
    try {
      setInternalLoading(true);
      await onConfirm();
      handleClose();
    } catch (error) {
      console.error("Confirmation action failed:", error);
    } finally {
      setInternalLoading(false);
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

      {/* Modal - Top Center Position */}
      <div
        className={cn(
          "fixed left-1/2 top-0 z-50 w-full max-w-md -translate-x-1/2 transform px-4 transition-all duration-300",
          animateOut 
            ? "-translate-y-full opacity-0" 
            : "translate-y-8 opacity-100 sm:translate-y-12"
        )}
      >
        <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* Decorative top accent line */}
          <div className={cn(
            "absolute top-0 left-0 right-0 h-1",
            type === "danger" && "bg-destructive",
            type === "warning" && "bg-warning",
            type === "info" && "bg-info",
            type === "success" && "bg-success"
          )} />

          {/* Close button */}
          <button
            onClick={handleClose}
            disabled={isLoadingState}
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="p-6 pt-8">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={cn(
                "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                config.iconBgClass
              )}>
                {icon || config.icon}
              </div>

              {/* Text content */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 mt-6">
              {showCancelButton && (
                <button
                  onClick={handleClose}
                  disabled={isLoadingState}
                  className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-md border border-border bg-transparent text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  {cancelText}
                </button>
              )}
              <button
                onClick={handleConfirm}
                disabled={isLoadingState}
                className={cn(
                  "inline-flex items-center justify-center gap-2 px-4 h-9 rounded-md text-sm font-medium transition-colors disabled:opacity-50",
                  config.confirmButtonClass
                )}
              >
                {isLoadingState && (
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

// Custom hook for managing confirmation modal state
export function useConfirmationModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<Omit<ConfirmationModalProps, "isOpen" | "onClose" | "onConfirm"> & {
    onConfirm: () => void | Promise<void>;
  }>({
    title: "",
    message: "",
    onConfirm: async () => {},
    type: "danger",
  });

  const confirm = (options: {
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    type?: ConfirmationType;
    confirmText?: string;
    cancelText?: string;
    showCancelButton?: boolean;
    icon?: React.ReactNode;
  }) => {
    setConfig({
      title: options.title,
      message: options.message,
      onConfirm: options.onConfirm,
      type: options.type || "danger",
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      showCancelButton: options.showCancelButton,
      icon: options.icon,
    });
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  const Modal = () => (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={close}
      onConfirm={config.onConfirm}
      title={config.title}
      message={config.message}
      type={config.type}
      confirmText={config.confirmText}
      cancelText={config.cancelText}
      showCancelButton={config.showCancelButton}
      icon={config.icon}
    />
  );

  return { confirm, close, Modal, isOpen };
}

export default ConfirmationModal;