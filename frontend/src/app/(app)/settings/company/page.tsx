"use client";
import { useState, useEffect } from "react";
import { useCompanySettings, type CompanySettings } from "@/hooks/useCompanySettings";
import PageHeader from "@/components/PageHeader";
import { 
  Building2, Globe, CalendarDays, 
  CheckCircle, Save, Briefcase, Mail, 
  Phone, MapPin, Hash, AlertCircle
} from "lucide-react";

// Define proper types matching your API
interface WorkingDayDisplay {
  id?: number;
  day: number;
  label: string;
  isWorking: boolean;
  startTime?: string | null;
  endTime?: string | null;
  isHalfDay?: boolean;
}

interface FormData {
  // Company Details
  companyName: string;
  companyShortName: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  
  // Financial
  currency: string;
  taxRate: string;
  taxId: string;
  
  // Time
  timezone: string;
  
  // Working Hours
  defaultStartTime: string;
  defaultEndTime: string;
  workingHoursPerDay: string;
  
}

export default function CompanyProfile() {
  const { 
    settings, 
    isReady, 
    updateSettings, 
    updateWorkingDays,
    isUpdating 
  } = useCompanySettings();
  
  const [loading, setLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  
  const [formData, setFormData] = useState<FormData>({
    companyName: "",
    companyShortName: "",
    address: "",
    city: "",
    country: "",
    phone: "",
    email: "",
    currency: "USD",
    taxRate: "0",
    taxId: "",
    timezone: "UTC",
    defaultStartTime: "09:00",
    defaultEndTime: "18:00",
    workingHoursPerDay: "8.00",
  });

  const [workingDays, setWorkingDays] = useState<WorkingDayDisplay[]>([
    { id: 1, day: 0, label: "Monday", isWorking: true },
    { id: 2, day: 1, label: "Tuesday", isWorking: true },
    { id: 3, day: 2, label: "Wednesday", isWorking: true },
    { id: 4, day: 3, label: "Thursday", isWorking: true },
    { id: 5, day: 4, label: "Friday", isWorking: true },
    { id: 6, day: 5, label: "Saturday", isWorking: false },
    { id: 7, day: 6, label: "Sunday", isWorking: false },
  ]);

  // Load settings when ready
  useEffect(() => {
    if (isReady && settings) {
      // Use settings directly without casting
      setFormData({
        companyName: settings.companyName || "",
        companyShortName: settings.companyShortName || "",
        address: settings.address || "",
        city: settings.city || "",
        country: settings.country || "",
        phone: settings.phone || "",
        email: settings.email || "",
        currency: settings.currency || "USD",
        taxRate: settings.taxRate?.toString() || "0",
        taxId: settings.taxId || "",
        timezone: settings.timezone || "UTC",
        defaultStartTime: settings.defaultStartTime || "09:00",
        defaultEndTime: settings.defaultEndTime || "18:00",
        workingHoursPerDay: settings.workingHoursPerDay || "8.00",
      });

      if (settings.workingDays && Array.isArray(settings.workingDays)) {
        setWorkingDays(
          settings.workingDays.map((wd) => ({
            id: wd.id,
            day: wd.day,
            label: wd.label,
            isWorking: wd.isWorking,
            startTime: wd.startTime,
            endTime: wd.endTime,
            isHalfDay: wd.isHalfDay,
          }))
        );
      }
    }
  }, [isReady, settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    
    try {
      // Update main settings + company details
      await updateSettings({
        ...formData,
        taxRate: parseFloat(formData.taxRate) || 0,
      });
      
      // Update working days - match the API expected format
      const workingDaysForApi = workingDays.map(wd => ({
        id: wd.id,
        day: wd.day,
        label: wd.label,
        isWorking: wd.isWorking,
        startTime: wd.startTime || null,
        endTime: wd.endTime || null,
        isHalfDay: wd.isHalfDay || false,
      }));
      
      await updateWorkingDays(workingDaysForApi);
      
      setSuccessMsg("Settings updated successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error) {
      setErrorMsg("Failed to update settings. Please try again.");
      console.error("Update error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleWorkingDay = (dayIndex: number) => {
    setWorkingDays(prev =>
      prev.map(d =>
        d.day === dayIndex ? { ...d, isWorking: !d.isWorking } : d
      )
    );
  };

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <PageHeader 
        title="Company Settings" 
        subtitle="Manage organization details and financials" 
        actions={null}
      />
      
      {/* Success Message */}
      {successMsg && (
        <div className="bg-success/10 border border-success/20 text-success-foreground px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive-foreground px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Details */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-muted px-6 py-4 border-b border-border flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg text-card-foreground">Company Details</h3>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <label className="block">
                <span className="text-sm text-muted-foreground mb-1.5 block">
                  Company Name <span className="text-destructive">*</span>
                </span>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={e => handleChange("companyName", e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted-foreground mb-1.5 block">
                  Short Name
                </span>
                <input
                  type="text"
                  value={formData.companyShortName}
                  onChange={e => handleChange("companyShortName", e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  placeholder="e.g., ABC Corp"
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <label className="block">
                <span className="text-sm text-muted-foreground mb-1.5 block flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5" /> Tax ID / VAT
                </span>
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={e => handleChange("taxId", e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  placeholder="e.g., GST123456789"
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted-foreground mb-1.5 block flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> Email
                </span>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => handleChange("email", e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  placeholder="company@example.com"
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <label className="block">
                <span className="text-sm text-muted-foreground mb-1.5 block flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> Phone
                </span>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => handleChange("phone", e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  placeholder="+1 234 567 890"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm text-muted-foreground mb-1.5 block flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Address
              </span>
              <textarea
                value={formData.address}
                onChange={e => handleChange("address", e.target.value)}
                className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-y"
                placeholder="Street address..."
              />
            </label>

            <div className="grid sm:grid-cols-2 gap-5">
              <label className="block">
                <span className="text-sm text-muted-foreground mb-1.5 block">City</span>
                <input
                  type="text"
                  value={formData.city}
                  onChange={e => handleChange("city", e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted-foreground mb-1.5 block">Country</span>
                <select
                  value={formData.country}
                  onChange={e => handleChange("country", e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                >
                  <option value="">Select country</option>
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                  <option value="IN">India</option>
                  <option value="PK">Pakistan</option>
                  <option value="AE">UAE</option>
                  <option value="SA">Saudi Arabia</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {/* Financial & Localization */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-muted px-6 py-4 border-b border-border flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg text-card-foreground">Financial & Localization</h3>
          </div>
          <div className="p-6 grid sm:grid-cols-2 gap-5">
            <label className="block">
              <span className="text-sm text-muted-foreground mb-1.5 block">
                Primary Currency
              </span>
              <select
                value={formData.currency}
                onChange={e => handleChange("currency", e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              >
                <option value="USD">USD ($)</option>
                <option value="PKR">PKR (₨)</option>
                <option value="AED">AED (د.إ)</option>
                <option value="GBP">GBP (£)</option>
                <option value="EUR">EUR (€)</option>
                <option value="INR">INR (₹)</option>
                <option value="SAR">SAR (﷼)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-muted-foreground mb-1.5 block">
                Default Tax Rate (%)
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.taxRate}
                onChange={e => handleChange("taxRate", e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-sm text-muted-foreground mb-1.5 block">Timezone</span>
              <select
                value={formData.timezone}
                onChange={e => handleChange("timezone", e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (US)</option>
                <option value="America/Chicago">Central Time (US)</option>
                <option value="America/Denver">Mountain Time (US)</option>
                <option value="America/Los_Angeles">Pacific Time (US)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Asia/Dubai">Dubai (GST)</option>
                <option value="Asia/Karachi">Karachi (PKT)</option>
                <option value="Asia/Kolkata">Mumbai (IST)</option>
              </select>
            </label>
          </div>
        </div>

        {/* Working Days & Hours */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-muted px-6 py-4 border-b border-border flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg text-card-foreground">Working Days & Hours</h3>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <span className="text-sm text-muted-foreground mb-2 block">
                Working Days
              </span>
              <div className="flex gap-2 flex-wrap">
                {workingDays.map(day => (
                  <button
                    key={day.id || day.day}
                    type="button"
                    onClick={() => toggleWorkingDay(day.day)}
                    className={`px-4 py-2 rounded-md text-sm font-medium border transition-all ${
                      day.isWorking
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-5">
              <label className="block">
                <span className="text-sm text-muted-foreground mb-1.5 block">Start Time</span>
                <input
                  type="time"
                  value={formData.defaultStartTime}
                  onChange={e => handleChange("defaultStartTime", e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted-foreground mb-1.5 block">End Time</span>
                <input
                  type="time"
                  value={formData.defaultEndTime}
                  onChange={e => handleChange("defaultEndTime", e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted-foreground mb-1.5 block">Hours Per Day</span>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="24"
                  value={formData.workingHoursPerDay}
                  onChange={e => handleChange("workingHoursPerDay", e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="submit"
            disabled={loading || isUpdating}
            className="px-6 h-11 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 flex items-center gap-2 min-w-[140px] justify-center transition-all disabled:opacity-70 shadow-sm"
          >
            {loading || isUpdating ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}