// ============================================
// FILE: src/components/inventory/ProductForm.jsx (Enhanced with tabs)
// ============================================

"use client";

import { useState, useEffect } from "react";
import { X, Upload, Trash2, Plus, Image as ImageIcon } from "lucide-react";

export default function ProductForm({ 
  initialData = {}, 
  onSubmit, 
  onCancel,
  categories = [],
  brands = [],
  isEditing = false 
}) {
  const [activeTab, setActiveTab] = useState("basic");
  const [formData, setFormData] = useState(initialData);
  const [galleryImages, setGalleryImages] = useState([]);
  const [specifications, setSpecifications] = useState({});

  useEffect(() => {
    if (initialData.gallery_images) {
      try {
        setGalleryImages(JSON.parse(initialData.gallery_images));
      } catch {
        setGalleryImages([]);
      }
    }
    if (initialData.specifications) {
      try {
        setSpecifications(JSON.parse(initialData.specifications));
      } catch {
        setSpecifications({});
      }
    }
  }, [initialData]);

  const updateField = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const addSpecification = () => {
    setSpecifications(prev => ({ ...prev, "": "" }));
  };

  const updateSpecification = (oldKey, newKey, value) => {
    const updated = { ...specifications };
    if (oldKey !== newKey) {
      delete updated[oldKey];
    }
    updated[newKey] = value;
    setSpecifications(updated);
    updateField("specifications", JSON.stringify(updated));
  };

  const removeSpecification = (key) => {
    const updated = { ...specifications };
    delete updated[key];
    setSpecifications(updated);
    updateField("specifications", JSON.stringify(updated));
  };

  const addGalleryImage = (url) => {
    const newImages = [...galleryImages, url];
    setGalleryImages(newImages);
    updateField("gallery_images", JSON.stringify(newImages));
  };

  const removeGalleryImage = (index) => {
    const newImages = galleryImages.filter((_, i) => i !== index);
    setGalleryImages(newImages);
    updateField("gallery_images", JSON.stringify(newImages));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const tabs = [
    { id: "basic", label: "Basic Info", icon: "📝" },
    { id: "pricing", label: "Pricing & Tax", icon: "💰" },
    { id: "inventory", label: "Inventory", icon: "📦" },
    { id: "media", label: "Media Gallery", icon: "🖼️" },
    { id: "specifications", label: "Specifications", icon: "⚙️" },
    { id: "seo", label: "SEO", icon: "🔍" },
  ];

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl">
      {/* Tabs */}
      <div className="border-b border-border px-4">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-5 max-h-[60vh] overflow-y-auto">
        {/* Basic Information Tab */}
        {activeTab === "basic" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  SKU <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.sku || ""}
                  onChange={(e) => updateField("sku", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Unique product SKU"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Barcode / EAN
                </label>
                <input
                  type="text"
                  value={formData.barcode || ""}
                  onChange={(e) => updateField("barcode", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Barcode number"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Product Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.name || ""}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Product name"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Category <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.category_id || ""}
                  onChange={(e) => updateField("category_id", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Brand</label>
                <select
                  value={formData.brand_id || ""}
                  onChange={(e) => updateField("brand_id", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select Brand</option>
                  {brands.map(brand => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Short Description</label>
              <textarea
                value={formData.short_description || ""}
                onChange={(e) => updateField("short_description", e.target.value)}
                rows={2}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Brief description for listings (150-200 characters)"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Full Description</label>
              <textarea
                value={formData.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                rows={4}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Complete product details"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Product Type</label>
                <select
                  value={formData.product_type || "simple"}
                  onChange={(e) => updateField("product_type", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="simple">Simple Product</option>
                  <option value="variable">Variable Product (with variants)</option>
                  <option value="bundle">Bundle Product</option>
                  <option value="digital">Digital Product</option>
                  <option value="service">Service</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Unit of Measure</label>
                <select
                  value={formData.unit_of_measure || "PCS"}
                  onChange={(e) => updateField("unit_of_measure", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="PCS">Pieces (PCS)</option>
                  <option value="KG">Kilograms (KG)</option>
                  <option value="LTR">Liters (LTR)</option>
                  <option value="MTR">Meters (MTR)</option>
                  <option value="BOX">Box (BOX)</option>
                  <option value="SET">Set (SET)</option>
                  <option value="PAIR">Pair (PAIR)</option>
                  <option value="DOZEN">Dozen (DOZEN)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Tags</label>
              <input
                type="text"
                value={formData.tags || ""}
                onChange={(e) => updateField("tags", e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="comma, separated, tags"
              />
            </div>
          </div>
        )}

        {/* Pricing & Tax Tab */}
        {activeTab === "pricing" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Cost Price <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost_price || ""}
                  onChange={(e) => updateField("cost_price", parseFloat(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Selling Price <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.selling_price || ""}
                  onChange={(e) => updateField("selling_price", parseFloat(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Special Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.special_price || ""}
                  onChange={(e) => updateField("special_price", parseFloat(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">MSRP (List Price)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.msrp || ""}
                  onChange={(e) => updateField("msrp", parseFloat(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Special Price Start Date</label>
                <input
                  type="date"
                  value={formData.special_price_from || ""}
                  onChange={(e) => updateField("special_price_from", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Special Price End Date</label>
                <input
                  type="date"
                  value={formData.special_price_to || ""}
                  onChange={(e) => updateField("special_price_to", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Tax Class</label>
                <select
                  value={formData.tax_class_id || "standard"}
                  onChange={(e) => updateField("tax_class_id", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="standard">Standard Rate</option>
                  <option value="reduced">Reduced Rate</option>
                  <option value="zero">Zero Rate</option>
                  <option value="exempt">Exempt</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.tax_rate || ""}
                  onChange={(e) => updateField("tax_rate", parseFloat(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.weight || ""}
                  onChange={(e) => updateField("weight", parseFloat(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Shipping Class</label>
                <select
                  value={formData.shipping_class || "standard"}
                  onChange={(e) => updateField("shipping_class", e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="standard">Standard Shipping</option>
                  <option value="express">Express Shipping</option>
                  <option value="heavy">Heavy Items</option>
                  <option value="fragile">Fragile Items</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Length (cm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.length || ""}
                  onChange={(e) => updateField("length", parseFloat(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Width (cm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.width || ""}
                  onChange={(e) => updateField("width", parseFloat(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Height (cm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.height || ""}
                  onChange={(e) => updateField("height", parseFloat(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Inventory Tab */}
        {activeTab === "inventory" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Stock Quantity <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  value={formData.stock_quantity || 0}
                  onChange={(e) => updateField("stock_quantity", parseInt(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Reserved Quantity</label>
                <input
                  type="number"
                  value={formData.reserved_quantity || 0}
                  disabled
                  className="w-full bg-muted/20 border border-border rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Reorder Point</label>
                <input
                  type="number"
                  value={formData.reorder_point || ""}
                  onChange={(e) => updateField("reorder_point", parseInt(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Minimum stock before reorder"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Reorder Quantity</label>
                <input
                  type="number"
                  value={formData.reorder_quantity || ""}
                  onChange={(e) => updateField("reorder_quantity", parseInt(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Quantity to reorder"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Maximum Stock Level</label>
                <input
                  type="number"
                  value={formData.max_stock_level || ""}
                  onChange={(e) => updateField("max_stock_level", parseInt(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Maximum allowed stock"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Lead Time (Days)</label>
                <input
                  type="number"
                  value={formData.lead_time_days || ""}
                  onChange={(e) => updateField("lead_time_days", parseInt(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Days from order to delivery"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Shelf Life (Days)</label>
                <input
                  type="number"
                  value={formData.shelf_life_days || ""}
                  onChange={(e) => updateField("shelf_life_days", parseInt(e.target.value))}
                  className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Days until expiry"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium mb-3">Tracking Options</h4>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.track_by_batch === "true"}
                    onChange={(e) => updateField("track_by_batch", e.target.checked ? "true" : "false")}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Track by Batch Number</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.track_by_serial === "true"}
                    onChange={(e) => updateField("track_by_serial", e.target.checked ? "true" : "false")}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Track by Serial Number</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.expiry_required === "true"}
                    onChange={(e) => updateField("expiry_required", e.target.checked ? "true" : "false")}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Require Expiry Date</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Media Gallery Tab */}
        {activeTab === "media" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Main Image URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.main_image || ""}
                  onChange={(e) => updateField("main_image", e.target.value)}
                  className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://example.com/main-image.jpg"
                />
                {formData.main_image && (
                  <div className="w-16 h-16 rounded-lg border border-border overflow-hidden">
                    <img src={formData.main_image} alt="Main" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Video URL (YouTube/Vimeo)</label>
              <input
                type="text"
                value={formData.video_url || ""}
                onChange={(e) => updateField("video_url", e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Gallery Images</label>
                <button
                  type="button"
                  onClick={() => addGalleryImage("")}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Image
                </button>
              </div>
              
              <div className="space-y-2">
                {galleryImages.map((url, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => {
                        const newImages = [...galleryImages];
                        newImages[index] = e.target.value;
                        setGalleryImages(newImages);
                        updateField("gallery_images", JSON.stringify(newImages));
                      }}
                      className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="https://example.com/image.jpg"
                    />
                    {url && (
                      <div className="w-12 h-12 rounded border border-border overflow-hidden">
                        <img src={url} alt={`Gallery ${index}`} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(index)}
                      className="p-1.5 text-destructive hover:bg-destructive/10 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              {galleryImages.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                  <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No gallery images added yet</p>
                  <p className="text-xs text-muted-foreground">Click "Add Image" to add product photos</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Specifications Tab */}
        {activeTab === "specifications" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-medium">Product Specifications</h4>
              <button
                type="button"
                onClick={addSpecification}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Specification
              </button>
            </div>
            
            <div className="space-y-2">
              {Object.entries(specifications).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => updateSpecification(key, e.target.value, value)}
                    className="w-1/3 bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Attribute name (e.g., Material)"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => updateSpecification(key, key, e.target.value)}
                    className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Value (e.g., Stainless Steel)"
                  />
                  <button
                    type="button"
                    onClick={() => removeSpecification(key)}
                    className="p-1.5 text-destructive hover:bg-destructive/10 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            
            {Object.keys(specifications).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No specifications added yet</p>
                <p className="text-xs">Add technical specs like weight, dimensions, material, etc.</p>
              </div>
            )}
          </div>
        )}

        {/* SEO Tab */}
        {activeTab === "seo" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">SEO Title</label>
              <input
                type="text"
                value={formData.seo_title || ""}
                onChange={(e) => updateField("seo_title", e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="SEO optimized title (50-60 characters)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: 50-60 characters
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Meta Description</label>
              <textarea
                value={formData.seo_description || ""}
                onChange={(e) => updateField("seo_description", e.target.value)}
                rows={3}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="SEO meta description (150-160 characters)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: 150-160 characters
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Meta Keywords</label>
              <input
                type="text"
                value={formData.seo_keywords || ""}
                onChange={(e) => updateField("seo_keywords", e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="comma, separated, keywords"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">URL Slug</label>
              <input
                type="text"
                value={formData.slug || ""}
                onChange={(e) => updateField("slug", e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="auto-generated-from-name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to auto-generate from product name
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="border-t border-border p-4 flex justify-end gap-3">
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
          {isEditing ? "Update Product" : "Create Product"}
        </button>
      </div>
    </form>
  );
}