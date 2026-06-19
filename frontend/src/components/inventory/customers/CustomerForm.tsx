"use client";
import { useState, useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Customer } from "@/hooks/useCustomers";
import { useAutoCode } from "@/hooks/useAutoCode";
import { CountrySelect, StateSelect, CitySelect } from "@/components/reuseable/LocationSelectors";

interface CustomerFormProps {
  initialData?: Customer;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function CustomerForm({ initialData, onSubmit, onCancel, isLoading }: CustomerFormProps) {
  const { generateCode, validateCode } = useAutoCode("customer");
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
    } else {
      generateCode().then(code => setFormData(prev => ({ ...prev, customer_code: code }))).catch(() => {});
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
          <div className="flex gap-2">
            <input name="customer_code" value={formData.customer_code} onChange={handleChange} onBlur={() => validateCode(formData.customer_code)} className="flex-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono" />
            <button type="button" onClick={() => generateCode().then(code => setFormData(prev => ({ ...prev, customer_code: code }))).catch(() => {})} className="h-9 w-9 flex items-center justify-center rounded-md border border-border hover:bg-muted transition flex-shrink-0" title="Generate new code">
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
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
        <div className="col-span-full">
          <label className="block text-sm font-medium mb-2">Location</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <CountrySelect
                value={formData.country}
                onChange={(val) => setFormData(prev => ({ ...prev, country: val, state: "", city: "" }))}
              />
            </div>
            <div>
              <StateSelect
                countryCode={formData.country}
                value={formData.state}
                onChange={(val) => setFormData(prev => ({ ...prev, state: val, city: "" }))}
              />
            </div>
            <div>
              <CitySelect
                countryCode={formData.country}
                stateCode={formData.state}
                value={formData.city}
                onChange={(val) => setFormData(prev => ({ ...prev, city: val }))}
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Postal Code</label>
          <input name="postal_code" value={formData.postal_code} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
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