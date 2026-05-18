"use client";
import { useState, useEffect } from "react";
import { Customer } from "@/hooks/useCustomers";

interface CustomerFormProps {
  initialData?: Customer;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function CustomerForm({ initialData, onSubmit, onCancel, isLoading }: CustomerFormProps) {
  const [formData, setFormData] = useState({
    customer_code: "",
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address_line: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    is_active: true,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        customer_code: initialData.customer_code || "",
        name: initialData.name || "",
        contact_person: initialData.contact_person || "",
        email: initialData.email || "",
        phone: initialData.phone || "",
        address_line: initialData.address_line || "",
        city: initialData.city || "",
        state: initialData.state || "",
        postal_code: initialData.postal_code || "",
        country: initialData.country || "",
        is_active: initialData.is_active ?? true,
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Customer Code</label>
          <input name="customer_code" value={formData.customer_code} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input name="name" value={formData.name} onChange={handleChange} required className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Contact Person</label>
          <input name="contact_person" value={formData.contact_person} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input name="phone" value={formData.phone} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        </div>
        <div className="col-span-full">
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea name="address_line" value={formData.address_line} onChange={handleChange} rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">City</label>
          <input name="city" value={formData.city} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">State</label>
          <input name="state" value={formData.state} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Postal Code</label>
          <input name="postal_code" value={formData.postal_code} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Country</label>
          <input name="country" value={formData.country} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="h-4 w-4" />
          <label className="text-sm font-medium">Active</label>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md border border-border">Cancel</button>
        <button type="submit" disabled={isLoading} className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
          {isLoading ? "Saving..." : initialData ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}