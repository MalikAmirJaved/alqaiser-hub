"use client";

import { useState, useEffect } from "react";
import { Lead } from "@/hooks/sales/useLeads";
import { useCustomers } from "@/hooks/useCustomers";
import { UserPlus } from "lucide-react";
import CustomerForm from "@/components/inventory/customers/CustomerForm";

interface LeadFormProps {
  initialData?: Partial<Lead>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function LeadForm({ initialData, onSubmit, onCancel, isLoading }: LeadFormProps) {
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState<any>(null);
  const { data: customers = [] } = useCustomers("");

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    first_name: initialData?.first_name || "",
    last_name: initialData?.last_name || "",
    company_name: initialData?.company_name || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    source: initialData?.source || "MANUAL",
    customer: initialData?.customer || "",
    notes: initialData?.notes || "",
  });

  // Auto-fill from selected existing customer
  useEffect(() => {
    if (formData.customer) {
      const selectedCustomer = customers.find(c => c.id === formData.customer);
      if (selectedCustomer) {
        const nameParts = selectedCustomer.name.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        setFormData(prev => ({
          ...prev,
          first_name: prev.first_name || firstName,
          last_name: prev.last_name || lastName,
          email: prev.email || selectedCustomer.email || "",
          phone: prev.phone || selectedCustomer.phone || "",
          company_name: prev.company_name || selectedCustomer.name || "",
        }));
      }
    }
  }, [formData.customer, customers]);

  // Auto-fill from newly created customer
  useEffect(() => {
    if (newCustomerData) {
      const nameParts = (newCustomerData.name || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      setFormData(prev => ({
        ...prev,
        first_name: firstName,
        last_name: lastName,
        email: newCustomerData.email || "",
        phone: newCustomerData.phone || "",
        company_name: newCustomerData.name || "",
      }));
    }
  }, [newCustomerData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build final payload
    const payload: any = { ...formData };

    // Remove empty customer if new customer is being created
    if (newCustomerData) {
      delete payload.customer;
    } else if (!payload.customer) {
      delete payload.customer;
    }

    // Remove empty strings that backend might reject
    Object.keys(payload).forEach(key => {
      if (payload[key] === "") delete payload[key];
    });

    // Add new_customer if applicable
    if (newCustomerData) {
      payload.new_customer = newCustomerData;
    }

    await onSubmit(payload);
  };

  const sourceOptions = [
    { value: "MANUAL", label: "Manual" },
    { value: "FACEBOOK", label: "Facebook" },
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "INSTAGRAM", label: "Instagram" },
    { value: "WEBSITE", label: "Website" },
    { value: "REFERRAL", label: "Referral" },
    { value: "OTHER", label: "Other" },
  ];

  const handleInlineCustomerSubmit = async (data: any) => {
    setNewCustomerData(data);
    setShowCustomerForm(false);
    setFormData(prev => ({ ...prev, customer: "" }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-full">
          <label className="block text-sm font-medium mb-1">Lead Title *</label>
          <input
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="e.g., Interested in Cloud ERP"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">First Name *</label>
          <input
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Last Name</label>
          <input
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Company Name</label>
          <input
            name="company_name"
            value={formData.company_name}
            onChange={handleChange}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Source</label>
          <select
            name="source"
            value={formData.source}
            onChange={handleChange}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {sourceOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Existing Customer</label>
          <div className="flex gap-2">
            <select
              name="customer"
              value={formData.customer}
              onChange={handleChange}
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
              New Customer Linked: {newCustomerData.name}
              <button type="button" onClick={() => setNewCustomerData(null)} className="text-destructive hover:underline ml-2">
                Clear
              </button>
            </div>
          )}
        </div>
        <div className="col-span-full">
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md border border-border">
          Cancel
        </button>
        <button type="submit" disabled={isLoading} className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
          {isLoading ? "Saving..." : initialData?.id ? "Update" : "Create"}
        </button>
      </div>

      {/* Inline Customer Modal */}
      {showCustomerForm && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-semibold mb-4">New Customer</h2>
            <CustomerForm
              onSubmit={handleInlineCustomerSubmit}
              onCancel={() => setShowCustomerForm(false)}
            />
          </div>
        </div>
      )}
    </form>
  );
}