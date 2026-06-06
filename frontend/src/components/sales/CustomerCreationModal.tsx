// components/sales/CustomerCreationModal.tsx
"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useCreateCustomer } from "@/hooks/useCustomers";
import CustomerForm from "@/components/inventory/customers/CustomerForm";

interface CustomerCreationModalProps {
  open: boolean;
  onClose: () => void;
  onCustomerCreated: (customerId: string, customerName: string, customerData: any) => void;
}

export default function CustomerCreationModal({ 
  open, 
  onClose, 
  onCustomerCreated 
}: CustomerCreationModalProps) {
  const createCustomer = useCreateCustomer();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const result = await createCustomer.mutateAsync(data);
      // Extract customer data from response
      const customerData = result;
      onCustomerCreated(
        customerData.id, 
        customerData.name,
        {
          id: customerData.id,
          name: customerData.name,
          email: customerData.email || "",
          phone: customerData.phone || "",
          contact_person: customerData.contact_person || "",
          address_line: customerData.address_line || "",
          city: customerData.city || "",
          state: customerData.state || "",
          postal_code: customerData.postal_code || "",
          country: customerData.country || "",
        }
      );
      onClose();
    } catch (error) {
      console.error("Failed to create customer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border p-4 sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">Create New Customer</h2>
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="p-1 rounded-md hover:bg-muted disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <CustomerForm
            onSubmit={handleSubmit}
            onCancel={onClose}
            isLoading={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}