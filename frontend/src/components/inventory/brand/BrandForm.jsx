// ============================================
// FILE: src/components/inventory/BrandForm.jsx
// ============================================

"use client";

import { useState } from "react";
import { X, Upload } from "lucide-react";
import { CountrySelect } from "@/components/reuseable/LocationSelectors";

export default function BrandForm({ initialData, onSubmit, onCancel, isEditing }) {
  const [formData, setFormData] = useState({
    name: initialData.name || "",
    code: initialData.code || "",
    logo_url: initialData.logo_url || "",
    cover_image_url: initialData.cover_image_url || "",
    website: initialData.website || "",
    email: initialData.email || "",
    phone: initialData.phone || "",
    country_of_origin: initialData.country_of_origin || "",
    address: initialData.address || "",
    tax_id: initialData.tax_id || "",
    registration_number: initialData.registration_number || "",
    year_founded: initialData.year_founded || "",
    description: initialData.description || "",
    meta_description: initialData.meta_description || "",
    status: initialData.status || "active",
    is_featured: initialData.is_featured || "false",
    priority: initialData.priority || "",
    seo_title: initialData.seo_title || "",
    seo_keywords: initialData.seo_keywords || "",
    slug: initialData.slug || "",
  });

  const updateField = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Brand name is required");
      return;
    }
    if (!formData.code.trim()) {
      alert("Brand code is required");
      return;
    }
    // Auto-generate slug if empty
    if (!formData.slug && formData.name) {
      formData.slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold">{isEditing ? "Edit Brand" : "Add New Brand"}</h2>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Basic Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm block mb-1">
                  Brand Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Apple, Samsung, Nike"
                  required
                />
              </div>
              <div>
                <label className="text-sm block mb-1">
                  Brand Code <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => updateField("code", e.target.value.toUpperCase())}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., APPL, SAMS, NKE"
                  required
                />
              </div>
              <div>
                <label className="text-sm block mb-1">URL Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => updateField("slug", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="auto-generated-from-name"
                />
              </div>
              <div>
                <label className="text-sm block mb-1">Year Founded</label>
                <input
                  type="number"
                  value={formData.year_founded}
                  onChange={(e) => updateField("year_founded", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="YYYY"
                />
              </div>
            </div>
          </div>

          {/* Media */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Media</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm block mb-1">Logo URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.logo_url}
                    onChange={(e) => updateField("logo_url", e.target.value)}
                    className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="https://..."
                  />
                  {formData.logo_url && (
                    <div className="w-12 h-12 rounded-lg border border-border overflow-hidden">
                      <img src={formData.logo_url} alt="Logo" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm block mb-1">Cover Image</label>
                <input
                  type="text"
                  value={formData.cover_image_url}
                  onChange={(e) => updateField("cover_image_url", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* Contact & Location */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Contact & Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm block mb-1">Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://www.example.com"
                />
              </div>
              <div>
                <label className="text-sm block mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="contact@brand.com"
                />
              </div>
              <div>
                <label className="text-sm block mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+1 234 567 8900"
                />
              </div>
              <div>
                <label className="text-sm block mb-1">Country of Origin</label>
                <CountrySelect
                  value={formData.country_of_origin}
                  onChange={(val) => updateField("country_of_origin", val)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm block mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  rows={2}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Full address"
                />
              </div>
            </div>
          </div>

          {/* Business Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Business Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm block mb-1">Tax ID / VAT Number</label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={(e) => updateField("tax_id", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm block mb-1">Registration Number</label>
                <input
                  type="text"
                  value={formData.registration_number}
                  onChange={(e) => updateField("registration_number", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Description</h3>
            <div>
              <label className="text-sm block mb-1">Brand Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={4}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Brand description, history, etc."
              />
            </div>
            <div>
              <label className="text-sm block mb-1">Meta Description (SEO)</label>
              <textarea
                value={formData.meta_description}
                onChange={(e) => updateField("meta_description", e.target.value)}
                rows={2}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="SEO meta description (150-160 characters)"
              />
            </div>
          </div>

          {/* Status & Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Status & Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm block mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
              <div>
                <label className="text-sm block mb-1">Featured Brand</label>
                <select
                  value={formData.is_featured}
                  onChange={(e) => updateField("is_featured", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div>
                <label className="text-sm block mb-1">Display Priority</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => updateField("priority", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="1 (highest)"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 sticky bottom-0 bg-card">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
          >
            {isEditing ? "Update Brand" : "Create Brand"}
          </button>
        </div>
      </form>
    </div>
  );
}