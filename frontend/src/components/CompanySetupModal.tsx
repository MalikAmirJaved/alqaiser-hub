// src/components/CompanySetupModal.tsx
"use client";

import { useState, useEffect } from "react";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { Button } from "@/components/ui/button";
import { Building2, Globe, CalendarDays, Briefcase, CheckCircle, AlertCircle } from "lucide-react";

export default function CompanySetupModal() {
  const { settings, isReady, updateSettings, updateWorkingDays, isUpdating } = useCompanySettings();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    companyName: "",
    address: "",
    city: "",
    country: "PK",
    phone: "",
    email: "",
    currency: "PKR",
    taxRate: "0",
    taxId: "",
    timezone: "Asia/Karachi",
    defaultStartTime: "09:00",
    defaultEndTime: "18:00",
    workingHoursPerDay: "8.00",
    leaveDuringProbation: false,
    allowCarryForward: false,
    maxCarryForwardDays: 0,
  });

  const [workingDays, setWorkingDays] = useState([
    { day: 0, label: "Monday", isWorking: true },
    { day: 1, label: "Tuesday", isWorking: true },
    { day: 2, label: "Wednesday", isWorking: true },
    { day: 3, label: "Thursday", isWorking: true },
    { day: 4, label: "Friday", isWorking: true },
    { day: 5, label: "Saturday", isWorking: false },
    { day: 6, label: "Sunday", isWorking: false },
  ]);

  // Load any existing partial data
  useEffect(() => {
    if (isReady && settings && !settings.isSetupCompleted) {
      setFormData(prev => ({
        ...prev,
        companyName: settings.companyName || prev.companyName,
        currency: settings.currency || prev.currency,
        timezone: settings.timezone || prev.timezone,
        // ... add more if needed
      }));
    }
  }, [isReady, settings]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleWorkingDay = (day: number) => {
    setWorkingDays(prev =>
      prev.map(d => (d.day === day ? { ...d, isWorking: !d.isWorking } : d))
    );
  };

  const handleSubmit = async () => {
    setErrorMsg("");
    try {
      await updateSettings({
        ...formData,
        taxRate: parseFloat(formData.taxRate) || 0,
        isSetupCompleted: true,
      });

      await updateWorkingDays(workingDays);

      setSuccessMsg("Company setup completed successfully! 🎉");
      
      // Auto close after success
      setTimeout(() => {
        window.location.reload(); // Refresh to load full app
      }, 1500);
    } catch (error) {
      setErrorMsg("Failed to save setup. Please try again.");
      console.error(error);
    }
  };

  if (!isReady || (settings && settings.isSetupCompleted)) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-3xl shadow-xl w-full max-w-2xl mx-4 max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Welcome to Your ERP</h2>
              <p className="text-muted-foreground">Let’s configure your company to get started</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="px-8 py-3 bg-muted/50 border-b border-border flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                s <= step ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>

        <div className="p-8 overflow-auto max-h-[calc(95vh-180px)]">
          {errorMsg && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex gap-2 text-destructive text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-success/10 border border-success/30 rounded-lg flex gap-2 text-success">
              <CheckCircle className="w-5 h-5" /> {successMsg}
            </div>
          )}

          {/* STEP 1: Company Details */}
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5" /> Company Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <label className="block">
                  <span className="text-sm text-muted-foreground">Company Name <span className="text-destructive">*</span></span>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => handleChange("companyName", e.target.value)}
                    className="w-full mt-1 h-10 px-4 rounded-xl border border-border bg-muted/40 focus:border-primary outline-none"
                    placeholder="Acme Corporation"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <input type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} className="w-full mt-1 h-10 px-4 rounded-xl border border-border bg-muted/40" />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm text-muted-foreground">Address</span>
                  <textarea value={formData.address} onChange={(e) => handleChange("address", e.target.value)} rows={2} className="w-full mt-1 px-4 py-3 rounded-xl border border-border bg-muted/40" />
                </label>

                <label className="block">
                  <span className="text-sm text-muted-foreground">City</span>
                  <input type="text" value={formData.city} onChange={(e) => handleChange("city", e.target.value)} className="w-full mt-1 h-10 px-4 rounded-xl border border-border bg-muted/40" />
                </label>

                <label className="block">
                  <span className="text-sm text-muted-foreground">Country</span>
                  <select value={formData.country} onChange={(e) => handleChange("country", e.target.value)} className="w-full mt-1 h-10 px-4 rounded-xl border border-border bg-muted/40">
                    <option value="PK">Pakistan</option>
                    <option value="AE">UAE</option>
                    <option value="SA">Saudi Arabia</option>
                    <option value="US">United States</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: Working Schedule */}
          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CalendarDays className="w-5 h-5" /> Working Schedule
              </h3>

              <div>
                <p className="text-sm text-muted-foreground mb-3">Which days are working days?</p>
                <div className="flex flex-wrap gap-2">
                  {workingDays.map((day) => (
                    <button
                      key={day.day}
                      type="button"
                      onClick={() => toggleWorkingDay(day.day)}
                      className={`px-5 py-2.5 rounded-2xl text-sm font-medium border transition-all ${
                        day.isWorking ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <label>
                  <span className="text-sm text-muted-foreground">Start Time</span>
                  <input type="time" value={formData.defaultStartTime} onChange={(e) => handleChange("defaultStartTime", e.target.value)} className="w-full mt-1 h-10 px-4 rounded-xl border border-border bg-muted/40" />
                </label>
                <label>
                  <span className="text-sm text-muted-foreground">End Time</span>
                  <input type="time" value={formData.defaultEndTime} onChange={(e) => handleChange("defaultEndTime", e.target.value)} className="w-full mt-1 h-10 px-4 rounded-xl border border-border bg-muted/40" />
                </label>
                <label>
                  <span className="text-sm text-muted-foreground">Hours/Day</span>
                  <input type="number" step="0.5" value={formData.workingHoursPerDay} onChange={(e) => handleChange("workingHoursPerDay", e.target.value)} className="w-full mt-1 h-10 px-4 rounded-xl border border-border bg-muted/40" />
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: Financial & Policies */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Globe className="w-5 h-5" /> Financial & Policies
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <label>
                  <span className="text-sm text-muted-foreground">Currency</span>
                  <select value={formData.currency} onChange={(e) => handleChange("currency", e.target.value)} className="w-full mt-1 h-10 px-4 rounded-xl border border-border bg-muted/40">
                    <option value="PKR">PKR (₨)</option>
                    <option value="USD">USD ($)</option>
                    <option value="AED">AED</option>
                    <option value="SAR">SAR</option>
                  </select>
                </label>

                <label>
                  <span className="text-sm text-muted-foreground">Tax Rate (%)</span>
                  <input type="number" step="0.01" value={formData.taxRate} onChange={(e) => handleChange("taxRate", e.target.value)} className="w-full mt-1 h-10 px-4 rounded-xl border border-border bg-muted/40" />
                </label>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium flex items-center gap-2"><Briefcase className="w-4 h-4" /> Leave Policies</h4>

                <label className="flex items-center justify-between">
                  <div>
                    <p>Allow leave during probation</p>
                    <p className="text-xs text-muted-foreground">New employees can apply for leave</p>
                  </div>
                  <input type="checkbox" checked={formData.leaveDuringProbation} onChange={(e) => handleChange("leaveDuringProbation", e.target.checked)} className="w-5 h-5 accent-primary" />
                </label>

                <label className="flex items-center justify-between">
                  <div>
                    <p>Allow carry forward unused leaves</p>
                  </div>
                  <input type="checkbox" checked={formData.allowCarryForward} onChange={(e) => handleChange("allowCarryForward", e.target.checked)} className="w-5 h-5 accent-primary" />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-6 border-t border-border flex justify-between items-center bg-muted/30">
          <Button
            variant="outline"
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            disabled={step === 1}
          >
            Previous
          </Button>

          {step < 3 ? (
            <Button onClick={() => setStep(prev => prev + 1 as 1|2|3)}>
              Continue
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isUpdating || !formData.companyName}>
              {isUpdating ? "Saving..." : "Finish Setup & Continue"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}