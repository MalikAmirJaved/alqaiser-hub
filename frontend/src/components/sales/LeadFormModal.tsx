"use client";

import { useEffect, useState } from "react";
import { X, UserPlus } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import CustomerForm from "@/components/inventory/customers/CustomerForm";
import { useCreateLead, useUpdateLead, Lead } from "@/hooks/sales/useLeads";

interface LeadFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: Lead | null;
  onSuccess?: () => void;
}

export default function LeadFormModal({ open, onClose, initialData, onSuccess }: LeadFormModalProps) {
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState<any>(null);
  const { data: customers = [] } = useCustomers("");
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
    setNewCustomerData(null);
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...formData };
    if (newCustomerData) {
      delete payload.customer;
      payload.new_customer = newCustomerData;
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
          <div className="flex items-center justify-between border-b border-border p-4">
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
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
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
                <select
                  value={formData.source}
                  onChange={e => setFormData({ ...formData, source: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="MANUAL">Manual</option>
                  <option value="FACEBOOK">Facebook</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="WEBSITE">Website</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="OTHER">Other</option>
                </select>
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
                <label className="block text-sm font-medium mb-1">Existing Customer</label>
                <div className="flex gap-2">
                  <select
                    value={formData.customer}
                    onChange={e => handleCustomerSelect(e.target.value)}
                    disabled={!!newCustomerData}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">None / Select</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCustomerForm(true)}
                    className="p-2 rounded-lg border border-border hover:bg-muted text-primary"
                    title="Add New Customer"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
                {newCustomerData && (
                  <div className="mt-1 text-xs text-success flex items-center gap-1">
                    New Customer: {newCustomerData.name}
                    <button type="button" onClick={() => setNewCustomerData(null)} className="text-destructive hover:underline ml-2">
                      Clear
                    </button>
                  </div>
                )}
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
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

      {showCustomerForm && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-semibold mb-4">New Customer</h2>
            <CustomerForm
              onSubmit={async (data) => {
                setNewCustomerData(data);
                setShowCustomerForm(false);
              }}
              onCancel={() => setShowCustomerForm(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}