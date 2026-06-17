"use client";

import { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import CustomerCreationModal from "@/components/sales/CustomerCreationModal";
import { useCreateLead, useUpdateLead, Lead } from "@/hooks/sales/useLeads";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

interface LeadFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: Lead | null;
  onSuccess?: () => void;
}

export default function LeadFormModal({ open, onClose, initialData, onSuccess }: LeadFormModalProps) {
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomerInfo, setNewCustomerInfo] = useState<any>(null);
  const { data: customers = [], refetch: refetchCustomers } = useCustomers("");
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();

  const [formData, setFormData] = useState({
    title: "",
    first_name: "",
    last_name: "",
    company_name: "",
    email: "",
    phone: "",
    source: "MANUAL",
    customer: "",
    notes: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        first_name: initialData.first_name || "",
        last_name: initialData.last_name || "",
        company_name: initialData.company_name || "",
        email: initialData.email || "",
        phone: initialData.phone || "",
        source: initialData.source || "MANUAL",
        customer: initialData.customer || "",
        notes: initialData.notes || "",
      });
    } else {
      resetForm();
    }
  }, [initialData, open]);

  const resetForm = () => {
    setFormData({
      title: "",
      first_name: "",
      last_name: "",
      company_name: "",
      email: "",
      phone: "",
      source: "MANUAL",
      customer: "",
      notes: "",
    });
    setNewCustomerInfo(null);
  };

  const handleCustomerCreated = async (customerId: string, customerName: string, customerData: any) => {
    // Refresh customer list
    await refetchCustomers();
    
    // Store new customer info for display
    setNewCustomerInfo(customerData);
    
    // Auto-select the newly created customer
    setFormData(prev => ({
      ...prev,
      customer: customerId,
      // Auto-fill lead info from customer data
      first_name: prev.first_name || customerData.contact_person?.split(" ")[0] || customerData.name.split(" ")[0] || "",
      last_name: prev.last_name || customerData.contact_person?.split(" ").slice(1).join(" ") || customerData.name.split(" ").slice(1).join(" ") || "",
      email: prev.email || customerData.email || "",
      phone: prev.phone || customerData.phone || "",
      company_name: prev.company_name || customerData.name || "",
    }));
  };

  const handleCustomerSelect = (customerId: string) => {
    setFormData(prev => ({ ...prev, customer: customerId }));
    const selected = customers.find(c => c.id === customerId);
    if (selected) {
      const nameParts = selected.name.split(" ");
      setFormData(prev => ({
        ...prev,
        first_name: prev.first_name || nameParts[0] || "",
        last_name: prev.last_name || nameParts.slice(1).join(" ") || "",
        email: prev.email || selected.email || "",
        phone: prev.phone || selected.phone || "",
        company_name: prev.company_name || selected.name || "",
      }));
    }
    // Clear new customer info if switching to existing
    if (customerId) {
      setNewCustomerInfo(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...formData };
    
    // If we have a newly created customer, use it
    if (newCustomerInfo) {
      payload.new_customer = newCustomerInfo;
      delete payload.customer;
    } else if (!payload.customer) {
      delete payload.customer;
    }
    
    Object.keys(payload).forEach(k => payload[k] === "" && delete payload[k]);

    if (initialData) {
      await updateLead.mutateAsync({ id: initialData.id, data: payload });
    } else {
      await createLead.mutateAsync(payload);
    }
    onSuccess?.();
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border p-4 sticky top-0 bg-card z-10">
            <h2 className="text-lg font-semibold">{initialData ? "Edit Lead" : "New Lead"}</h2>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Lead Title */}
            <div>
              <label className="block text-sm font-medium mb-1">Lead Title *</label>
              <input
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="e.g., Q4 Software Purchase"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            {/* Customer Selection with Creation */}
            <div className="col-span-full">
              <label className="block text-sm font-medium mb-1">Customer</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    value={formData.customer}
                    onChange={handleCustomerSelect}
                    options={customers.map(c => ({ value: c.id, label: c.name }))}
                    placeholder="Select existing customer"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border hover:bg-muted text-primary text-sm shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  New
                </button>
              </div>
              {newCustomerInfo && (
                <div className="mt-2 p-2 rounded-lg bg-success/10 border border-success/20 text-sm">
                  <p className="text-success-foreground font-medium">✓ New customer created: {newCustomerInfo.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Contact info auto-filled below</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name *</label>
                <input
                  value={formData.first_name}
                  onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input
                  value={formData.last_name}
                  onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Company Name</label>
                <input
                  value={formData.company_name}
                  onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Source</label>
                <SearchableSelect
                  value={formData.source}
                  onChange={val => setFormData({ ...formData, source: val })}
                  options={[
                    { value: "MANUAL", label: "Manual" },
                    { value: "FACEBOOK", label: "Facebook" },
                    { value: "WHATSAPP", label: "WhatsApp" },
                    { value: "INSTAGRAM", label: "Instagram" },
                    { value: "WEBSITE", label: "Website" },
                    { value: "REFERRAL", label: "Referral" },
                    { value: "OTHER", label: "Other" },
                  ]}
                  placeholder="Select source"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              
              <div className="col-span-full">
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Additional information about this lead..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
                Cancel
              </button>
              <button type="submit" disabled={createLead.isPending || updateLead.isPending} className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50">
                {createLead.isPending || updateLead.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <CustomerCreationModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onCustomerCreated={handleCustomerCreated}
      />
    </>
  );
}