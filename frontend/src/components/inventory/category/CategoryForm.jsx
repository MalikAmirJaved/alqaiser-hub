// ============================================
// FILE: src/components/inventory/CategoryForm.jsx
// ============================================

"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function CategoryForm({ initialData, categories, parentCategory, onSubmit, onCancel, isEditing }) {
  const [formData, setFormData] = useState({
    name: initialData.name || "",
    code: initialData.code || "",
    slug: initialData.slug || "",
    parent_id: initialData.parent_id || parentCategory?.id || "",
    display_order: initialData.display_order || "",
    show_in_menu: initialData.show_in_menu || "false",
    show_on_homepage: initialData.show_on_homepage || "false",
    description: initialData.description || "",
    image_url: initialData.image_url || "",
    icon: initialData.icon || "",
    meta_title: initialData.meta_title || "",
    meta_description: initialData.meta_description || "",
    meta_keywords: initialData.meta_keywords || "",
    filterable_attributes: initialData.filterable_attributes || "",
    default_sort_by: initialData.default_sort_by || "name_asc",
    status: initialData.status || "active",
  });

  const updateField = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Category name is required");
      return;
    }
    if (!formData.code.trim()) {
      alert("Category code is required");
      return;
    }
    // Auto-generate slug if empty
    if (!formData.slug && formData.name) {
      formData.slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }
    onSubmit(formData);
  };

  // Filter parent options to exclude current category and its children
  const getParentOptions = () => {
    if (isEditing) {
      return categories.filter(c => c.id !== initialData.id && c.parent_id !== initialData.id);
    }
    return categories;
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold">{isEditing ? "Edit Category" : "Add New Category"}</h2>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm block mb-1">
                Category Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Category name"
                required
              />
            </div>
            <div>
              <label className="text-sm block mb-1">
                Category Code <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => updateField("code", e.target.value.toUpperCase())}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., CAT-001"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm block mb-1">URL Slug</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => updateField("slug", e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="auto-generated"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm block mb-1">Display Order</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => updateField("display_order", parseInt(e.target.value))}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="1, 2, 3..."
              />
            </div>
            <div>
              <label className="text-sm block mb-1">Icon Class</label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => updateField("icon", e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="fa-solid fa-box"
              />
            </div>
          </div>

          <div>
            <label className="text-sm block mb-1">Category Image URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.image_url}
                onChange={(e) => updateField("image_url", e.target.value)}
                className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="https://..."
              />
              {formData.image_url && (
                <div className="w-12 h-12 rounded-lg border border-border overflow-hidden">
                  <img src={formData.image_url} alt="Category" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm block mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
              className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Category description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm block mb-1">Show in Menu</label>
              <select
                value={formData.show_in_menu}
                onChange={(e) => updateField("show_in_menu", e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
            <div>
              <label className="text-sm block mb-1">Show on Homepage</label>
              <select
                value={formData.show_on_homepage}
                onChange={(e) => updateField("show_on_homepage", e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm block mb-1">Default Sort By</label>
              <select
                value={formData.default_sort_by}
                onChange={(e) => updateField("default_sort_by", e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="price_asc">Price (Low to High)</option>
                <option value="price_desc">Price (High to Low)</option>
                <option value="newest">Newest First</option>
                <option value="popular">Most Popular</option>
              </select>
            </div>
            <div>
              <label className="text-sm block mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => updateField("status", e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          {/* SEO Section */}
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">SEO Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm block mb-1">Meta Title</label>
                <input
                  type="text"
                  value={formData.meta_title}
                  onChange={(e) => updateField("meta_title", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="SEO optimized title"
                />
              </div>
              <div>
                <label className="text-sm block mb-1">Meta Description</label>
                <textarea
                  value={formData.meta_description}
                  onChange={(e) => updateField("meta_description", e.target.value)}
                  rows={2}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="SEO meta description"
                />
              </div>
              <div>
                <label className="text-sm block mb-1">Meta Keywords</label>
                <input
                  type="text"
                  value={formData.meta_keywords}
                  onChange={(e) => updateField("meta_keywords", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="comma, separated, keywords"
                />
              </div>
              <div>
                <label className="text-sm block mb-1">Filterable Attributes (JSON)</label>
                <textarea
                  value={formData.filterable_attributes}
                  onChange={(e) => updateField("filterable_attributes", e.target.value)}
                  rows={2}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder='["size", "color", "material"]'
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
            {isEditing ? "Update Category" : "Create Category"}
          </button>
        </div>
      </form>
    </div>
  );
}