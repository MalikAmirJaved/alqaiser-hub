"use client";
import { useState, useEffect } from "react";
import { ls } from "@/services/localStorageService";
import PageHeader from "@/components/PageHeader";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { Building2, Globe, Receipt, Info, Briefcase, Mail, Phone, MapPin, Building, CheckCircle, CalendarDays } from "lucide-react";

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
    // New Leave Config Fields
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    leaveTypes: "Casual Leave, Sick Leave, Annual Leave, Maternity Leave",
    carryForward: "false",
    probationLeave: "false"
  });

  useEffect(() => {
    if (isReady && settings) {
      setFormData({
        companyName: settings.companyName || "",
        email: settings.email || "",
        phone: settings.phone || "",
        address: settings.address || "",
        city: settings.city || "",
        country: settings.country || "",
        currency: settings.currency || "PKR",
        taxRate: settings.taxRate?.toString() || "0",
        timezone: settings.timezone || "UTC",
        fiscalYearStart: settings.fiscalYearStart || "January",
        workingDays: settings.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        leaveTypes: settings.leaveTypes || "Casual Leave, Sick Leave, Annual Leave",
        carryForward: settings.carryForward || "false",
        probationLeave: settings.probationLeave || "false"
      });
    }
  }, [isReady, settings]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      updateSettings({
        ...formData,
        taxRate: parseFloat(formData.taxRate) || 0,
        leaveConfigured: true // Mark as configured
      });
      setSuccessMsg("Settings updated successfully!");
      setLoading(false);
      setTimeout(() => setSuccessMsg(""), 3000);
    }, 500);
  };

  const toggleWorkingDay = (day) => {
    const days = formData.workingDays.includes(day)
      ? formData.workingDays.filter(d => d !== day)
      : [...formData.workingDays, day];
    setFormData({ ...formData, workingDays: days });
  };

  if (!isReady) return <div className="p-10 flex justify-center">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <PageHeader title="Company Settings" subtitle="Manage organization core configuration & leave policies" actions={null} />
      
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
            <label className="block text-sm">
              <span className="text-muted-foreground mb-1.5 block">Primary Currency</span>
              <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background">
                <option value="PKR">PKR</option><option value="USD">USD</option><option value="AED">AED</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground mb-1.5 block">Default Tax Rate (%)</span>
              <input type="number" step="0.01" name="taxRate" value={formData.taxRate} onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background" required />
            </label>
          </div>
        </div>

        {/* Leave Policy Configuration - NEW SECTION */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-primary/10 px-6 py-4 border-b border-border flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Leave Policy Configuration</h3>
          </div>
          <div className="p-6 space-y-5">
            <label className="block text-sm">
              <span className="text-muted-foreground mb-1.5 block">Working Days</span>
              <div className="flex gap-3 flex-wrap">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWorkingDay(day)}
                    className={`px-3 py-1.5 rounded-md text-xs border transition ${formData.workingDays.includes(day) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border"}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </label>
            
            <label className="block text-sm">
              <span className="text-muted-foreground mb-1.5 block">Default Leave Types (Comma separated)</span>
              <input type="text" value={formData.leaveTypes} onChange={(e) => setFormData({ ...formData, leaveTypes: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background" placeholder="e.g., Casual, Sick, Annual" />
            </label>

            <div className="grid sm:grid-cols-2 gap-5">
              <label className="block text-sm">
                <span className="text-muted-foreground mb-1.5 block">Allow Carry Forward?</span>
                <select value={formData.carryForward} onChange={(e) => setFormData({ ...formData, carryForward: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background">
                  <option value="false">No</option><option value="true">Yes</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground mb-1.5 block">Leave During Probation?</span>
                <select value={formData.probationLeave} onChange={(e) => setFormData({ ...formData, probationLeave: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background">
                  <option value="false">No (Unpaid Only)</option><option value="true">Yes</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {/* Company Details */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Company Details</h3>
          </div>
          <div className="p-6 space-y-5">
            <label className="block text-sm">
              <span className="text-muted-foreground mb-1.5 block">Company Name</span>
              <input type="text" name="companyName" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background" required />
            </label>
            <div className="grid sm:grid-cols-2 gap-5">
              <label className="block text-sm">
                <span className="text-muted-foreground mb-1.5 block">Email</span>
                <input type="email" name="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background" />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground mb-1.5 block">Phone</span>
                <input type="tel" name="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background" />
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" disabled={loading} className="px-6 h-11 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 flex items-center justify-center min-w-[150px] transition-all disabled:opacity-70 shadow-sm">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}