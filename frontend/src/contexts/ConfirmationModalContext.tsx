// src/contexts/ConfirmationModalContext.tsx
"use client";

import { createContext, useContext, ReactNode } from "react";
import { useConfirmationModal, ConfirmationModalProps } from "@/components/reuseable/ConfirmationModal";

interface ConfirmationContextType {
  confirm: (options: {
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    type?: "danger" | "warning" | "info" | "success";
    confirmText?: string;
    cancelText?: string;
    showCancelButton?: boolean;
    icon?: React.ReactNode;
  }) => void;
}

const ConfirmationContext = createContext<ConfirmationContextType | null>(null);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const { confirm, Modal } = useConfirmationModal();

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}
      <Modal />
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error("useConfirmation must be used within a ConfirmationProvider");
  }
  return context;
}