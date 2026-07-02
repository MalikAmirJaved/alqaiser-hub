"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useCreateLead, useUpdateLead, Lead } from "@/hooks/sales/useLeads";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { CountrySelect, StateSelect, CitySelect } from "@/components/reuseable/LocationSelectors";

interface LeadFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: Lead | null;
  onSuccess?: () => void;
}

const defaultForm = {
  title: "",
  first_name: "",
  last_name: "",
  company_name: "",
  email: "",
  phone: "",
  source: "MANUAL",
  priority: "" as string,
  notes: "",
  address_line: "",
  country: "",
  state: "",
  city: "",
  score: null as number | null,
};

export default function LeadFormModal({ open, onClose, initialData, onSuccess }: LeadFormModalProps) {
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const [formData, setFormData] = useState(defaultForm);

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
        priority: initialData.priority || "",
        notes: initialData.notes || "",
        address_line: initialData.address_line || "",
        country: initialData.country || "",
        state: initialData.state || "",
        city: initialData.city || "",
        score: initialData.score ?? null,
      });
    } else {
      setFormData(defaultForm);
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...formData };
    Object.keys(payload).forEach(k => (payload[k] === "" || payload[k] === null) && delete payload[k]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border p-4 sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">{initialData ? "Edit Lead" : "New Lead"}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Lead Title *</label>
            <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
              required placeholder="e.g., Q4 Software Purchase"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">First Name *</label>
              <input value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <input value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Company Name</label>
              <input value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Source</label>
              <SearchableSelect value={formData.source} onChange={val => setFormData({ ...formData, source: val })}
                options={[
                  { value: "MANUAL", label: "Manual" },
                  { value: "FACEBOOK", label: "Facebook" },
                  { value: "WHATSAPP", label: "WhatsApp" },
                  { value: "INSTAGRAM", label: "Instagram" },
                  { value: "WEBSITE", label: "Website" },
                  { value: "REFERRAL", label: "Referral" },
                  { value: "OTHER", label: "Other" },
                ]} placeholder="Select source" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <SearchableSelect value={formData.priority} onChange={val => setFormData({ ...formData, priority: val })}
                options={[
                  { value: "HOT", label: "🔥 Hot" },
                  { value: "WARM", label: "🟡 Warm" },
                  { value: "COLD", label: "🔵 Cold" },
                ]} placeholder="Select priority" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Score (1-100)</label>
              <input type="number" min="1" max="100" value={formData.score ?? ""}
                onChange={e => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  if (val !== null && (val < 1 || val > 100)) return;
                  setFormData({ ...formData, score: val });
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Address</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <textarea rows={2} value={formData.address_line}
                  onChange={e => setFormData({ ...formData, address_line: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <span className="text-muted-foreground text-xs">Country</span>
                  <CountrySelect
                    value={formData.country}
                    onChange={(val) => {
                      setFormData({ ...formData, country: val, state: "", city: "" });
                    }}
                  />
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">State/Region</span>
                  <StateSelect
                    countryCode={formData.country}
                    value={formData.state}
                    onChange={(val) => {
                      setFormData({ ...formData, state: val, city: "" });
                    }}
                  />
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">City</span>
                  <CitySelect
                    countryCode={formData.country}
                    stateCode={formData.state}
                    value={formData.city}
                    onChange={(val) => setFormData({ ...formData, city: val })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-full">
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea rows={3} value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Additional information about this lead..." />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">Cancel</button>
            <button type="submit" disabled={createLead.isPending || updateLead.isPending}
              className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50">
              {createLead.isPending || updateLead.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
