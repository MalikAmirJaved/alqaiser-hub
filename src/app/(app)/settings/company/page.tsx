"use client";

import { useState, useEffect } from "react";
import { ls } from "@/services/localStorageService";
import PageHeader from "@/components/PageHeader";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { Building2, Globe, Receipt, Info, Briefcase, Mail, Phone, MapPin, Building, CheckCircle } from "lucide-react";

export default function CompanyProfile() {
  const { settings, updateSettings, isReady } = useCompanySettings();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    currency: "PKR",
    taxRate: "0",
    timezone: "UTC",
    fiscalYearStart: "January",
  });

  useEffect(() => {
    if (isReady && settings) {
      setFormData({
        companyName: settings.companyName || "",
        email: settings.email || "",
        phone: settings.phone || "",
        address: settings.address || "",
        city: (settings as any).city || "",
        country: (settings as any).country || "",
        currency: settings.currency || "PKR",
        taxRate: settings.taxRate?.toString() || "0",
        timezone: (settings as any).timezone || "UTC",
        fiscalYearStart: (settings as any).fiscalYearStart || "January",
      });
    }
  }, [isReady, settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    setTimeout(() => {
      updateSettings({
        ...formData,
        taxRate: parseFloat(formData.taxRate) || 0,
      });
      setSuccessMsg("Settings updated successfully!");
      setLoading(false);
      
      setTimeout(() => setSuccessMsg(""), 3000);
    }, 500);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (!isReady) return <div className="p-10 flex justify-center">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <PageHeader title="Company Settings" subtitle="Manage your organization's core configuration" actions={null} />

      {successMsg && (
        <div className="bg-success/15 border border-success/30 text-success px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Core Settings */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Localization & Financials</h3>
          </div>
          
          <div className="p-6 grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Primary Currency</label>
              <SearchableSelect
                value={formData.currency}
                onChange={(val: string) => handleSelectChange("currency", val)}
                options={[
                  { value: "PKR", label: "PKR - Pakistani Rupee" },
                  { value: "USD", label: "USD - US Dollar" },
                  { value: "EUR", label: "EUR - Euro" },
                  { value: "GBP", label: "GBP - British Pound" },
                  { value: "AED", label: "AED - UAE Dirham" },
                  { value: "SAR", label: "SAR - Saudi Riyal" },
                  { value: "INR", label: "INR - Indian Rupee" },
                ]}
                placeholder="Select currency"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Default Tax Rate (%)</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  name="taxRate"
                  value={formData.taxRate} 
                  onChange={handleInputChange}
                  className="w-full h-10 px-3 pl-8 rounded-md border border-input bg-background"
                  required
                />
                <Receipt className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Timezone</label>
              <SearchableSelect
                value={formData.timezone}
                onChange={(val: string) => handleSelectChange("timezone", val)}
                options={[
                  { value: "UTC", label: "UTC" },
                  { value: "Asia/Karachi", label: "Asia/Karachi (PKT)" },
                  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
                  { value: "America/New_York", label: "America/New_York (EST)" },
                  { value: "Europe/London", label: "Europe/London (GMT)" },
                ]}
                placeholder="Select timezone"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Fiscal Year Start</label>
              <select 
                name="fiscalYearStart"
                value={formData.fiscalYearStart} 
                onChange={handleInputChange}
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
              >
                <option value="January">January</option>
                <option value="April">April</option>
                <option value="July">July</option>
                <option value="October">October</option>
              </select>
            </div>
          </div>
        </div>

        {/* Company Profile */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Company Details</h3>
          </div>
          
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Company Name</label>
              <div className="relative">
                <input 
                  type="text" 
                  name="companyName"
                  value={formData.companyName} 
                  onChange={handleInputChange}
                  className="w-full h-10 px-3 pl-9 rounded-md border border-input bg-background"
                  placeholder="Acme Corp"
                />
                <Briefcase className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Contact Email</label>
                <div className="relative">
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email} 
                    onChange={handleInputChange}
                    className="w-full h-10 px-3 pl-9 rounded-md border border-input bg-background"
                    placeholder="contact@company.com"
                  />
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Phone Number</label>
                <div className="relative">
                  <input 
                    type="tel" 
                    name="phone"
                    value={formData.phone} 
                    onChange={handleInputChange}
                    className="w-full h-10 px-3 pl-9 rounded-md border border-input bg-background"
                    placeholder="+1 234 567 890"
                  />
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Street Address</label>
              <div className="relative">
                <input 
                  type="text" 
                  name="address"
                  value={formData.address} 
                  onChange={handleInputChange}
                  className="w-full h-10 px-3 pl-9 rounded-md border border-input bg-background"
                  placeholder="123 Business Avenue"
                />
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">City / Region</label>
                <div className="relative">
                  <input 
                    type="text" 
                    name="city"
                    value={formData.city} 
                    onChange={handleInputChange}
                    className="w-full h-10 px-3 pl-9 rounded-md border border-input bg-background"
                    placeholder="Metropolis"
                  />
                  <Building className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Country</label>
                <div className="relative">
                  <input 
                    type="text" 
                    name="country"
                    value={formData.country} 
                    onChange={handleInputChange}
                    className="w-full h-10 px-3 pl-9 rounded-md border border-input bg-background"
                    placeholder="Country Name"
                  />
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button 
            type="submit" 
            disabled={loading}
            className="px-6 h-11 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 flex items-center justify-center min-w-[150px] transition-all disabled:opacity-70 shadow-sm"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
