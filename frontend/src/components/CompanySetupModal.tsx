"use client";
import { useState } from "react";
import { useCompanySettings, CompanySettings } from "@/hooks/useCompanySettings";
import { Button } from "@/components/ui/button";  // adjust to your button

export default function CompanySetupModal() {
  const { settings, isReady, updateSettings } = useCompanySettings();
  const [form, setForm] = useState<Partial<CompanySettings>>({
    currency: "USD",
    taxRate: 0,
    timezone: "UTC",
  });

  // Only show if ready, user is admin (checked after login), and setup not completed
  if (!isReady || !settings || settings.isSetupCompleted) return null;

  const handleChange = (field: keyof CompanySettings, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Send data + mark setup completed
    await updateSettings({ ...form, isSetupCompleted: true });
  };

  // Modal with backdrop, no close button, no escape dismiss
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold mb-1">Welcome! Let’s set up your company</h2>
        <p className="text-sm text-muted-foreground mb-4">
          You’re the first admin. Please configure your company settings to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Currency */}
          <label className="block">
            <span className="text-xs text-muted-foreground">Currency</span>
            <select
              value={form.currency}
              onChange={e => handleChange("currency", e.target.value)}
              className="w-full bg-muted/40 border border-border rounded-md h-10 px-3"
            >
              {["USD", "EUR", "GBP", "PKR", "SAR", "AED"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          {/* Tax Rate */}
          <label className="block">
            <span className="text-xs text-muted-foreground">Tax Rate (%)</span>
            <input
              type="number"
              value={form.taxRate}
              onChange={e => handleChange("taxRate", parseFloat(e.target.value))}
              className="w-full bg-muted/40 border border-border rounded-md h-10 px-3"
              step="0.01"
            />
          </label>

          {/* Timezone */}
          <label className="block">
            <span className="text-xs text-muted-foreground">Timezone</span>
            <select
              value={form.timezone}
              onChange={e => handleChange("timezone", e.target.value)}
              className="w-full bg-muted/40 border border-border rounded-md h-10 px-3"
            >
              {["UTC", "America/New_York", "Europe/London", "Asia/Karachi", "Asia/Dubai"].map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </label>

          <Button type="submit" className="w-full">
            Save & Continue
          </Button>
        </form>
      </div>
    </div>
  );
}