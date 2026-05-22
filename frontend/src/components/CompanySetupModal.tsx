// src/components/CompanySetupModal.tsx
"use client";

import { useState, useEffect } from "react";
import { useCompanySettings, useSetupDesignations } from "@/hooks/useCompanySettings";
import { useCreateWarehouse } from "@/hooks/useWarehouses";
import { Button } from "@/components/ui/button";
import {
  Building2, Globe, CalendarDays, Briefcase,
  CheckCircle, AlertCircle, Warehouse, Clock,
  DollarSign, Users, ArrowRight, ArrowLeft, Sparkles,
  Phone, Mail, MapPin, Plus, Trash2, Package
} from "lucide-react";
import { DEPARTMENT_CHOICES } from "@/lib/departments";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5 | 6;

type DesignationForm = {
  name: string;
  department: string;
  isActive: boolean;
};

type WarehouseForm = {
  warehouse_name: string;
  code: string;
  manager_name: string;
  phone: string;
  email: string;
  capacity: number | string;
  current_occupancy: number;
  country: string;
  state: string;
  city: string;
  address_line: string;
  postal_code: string;
  is_active: boolean;
  description: string;
};

// ─── Step meta ────────────────────────────────────────────────────────────────

const STEPS: { id: Step; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 1, label: "Company",    icon: <Building2 className="w-4 h-4" />,    description: "Basic info" },
  { id: 2, label: "Schedule",   icon: <CalendarDays className="w-4 h-4" />, description: "Working days" },
  { id: 3, label: "Financial",  icon: <DollarSign className="w-4 h-4" />,   description: "Currency & tax" },
  { id: 4, label: "Roles",      icon: <Briefcase className="w-4 h-4" />,    description: "Designations" },
  { id: 5, label: "Warehouse",  icon: <Warehouse className="w-4 h-4" />,    description: "Storage" },
  { id: 6, label: "Complete",   icon: <Sparkles className="w-4 h-4" />,     description: "All done!" },
];

// ─── Shared field styles ──────────────────────────────────────────────────────

const inputCls =
  "w-full mt-1 h-10 px-3 rounded-lg border border-border bg-background/60 " +
  "focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition text-sm " +
  "placeholder:text-muted-foreground/50";

const selectCls =
  "w-full mt-1 h-10 px-3 rounded-lg border border-border bg-background/60 " +
  "focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition text-sm";

const labelCls = "text-xs font-medium text-muted-foreground uppercase tracking-wide";
const requiredLabelCls = "text-xs font-medium text-muted-foreground uppercase tracking-wide after:content-['*'] after:text-destructive after:ml-1";

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompanySetupModal() {
  const { settings, isReady, updateSettings, updateWorkingDays, isUpdating } = useCompanySettings();
  const setupDesignations = useSetupDesignations();
  const createWarehouse   = useCreateWarehouse();

  const [step, setStep]         = useState<Step>(1);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving]     = useState(false);

  // ── Form state ──

  const [formData, setFormData] = useState({
    companyName:       "",
    companyShortName:  "",
    address:           "",
    city:              "",
    country:           "PK",
    phone:             "",
    email:             "",
    currency:          "PKR",
    taxRate:           "17",
    taxId:             "",
    timezone:          "Asia/Karachi",
    defaultStartTime:  "09:00",
    defaultEndTime:    "18:00",
    workingHoursPerDay:"8.00",
  });

  const [workingDays, setWorkingDays] = useState([
    { day: 0, label: "Mon", isWorking: true  },
    { day: 1, label: "Tue", isWorking: true  },
    { day: 2, label: "Wed", isWorking: true  },
    { day: 3, label: "Thu", isWorking: true  },
    { day: 4, label: "Fri", isWorking: true  },
    { day: 5, label: "Sat", isWorking: false },
    { day: 6, label: "Sun", isWorking: false },
  ]);

  const [designations, setDesignations] = useState<DesignationForm[]>([
    { name: "", department: "", isActive: true },
  ]);

  const [warehouse, setWarehouse] = useState<WarehouseForm>({
    warehouse_name:    "",
    code:              "",
    manager_name:      "",
    phone:             "",
    email:             "",
    capacity:          "",
    current_occupancy: 0,
    country:           "PK",
    state:             "",
    city:              "",
    address_line:      "",
    postal_code:       "",
    is_active:         true,
    description:       "",
  });

  // ── Prefill from existing partial settings ──

  useEffect(() => {
    if (isReady && settings && !settings.isSetupCompleted) {
      setFormData(prev => ({
        ...prev,
        companyName:      settings.companyName      || prev.companyName,
        companyShortName: settings.companyShortName || prev.companyShortName,
        email:            settings.email            || prev.email,
        currency:         settings.currency         || prev.currency,
        timezone:         settings.timezone         || prev.timezone,
        address:          settings.address          || prev.address,
        city:             settings.city             || prev.city,
        country:          settings.country          || prev.country,
        phone:            settings.phone            || prev.phone,
      }));
    }
  }, [isReady, settings]);

  if (!isReady || (settings && settings.isSetupCompleted)) return null;

  // ── Helpers ──

  const set = (field: string, value: unknown) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const toggleDay = (day: number) =>
    setWorkingDays(prev => prev.map(d => d.day === day ? { ...d, isWorking: !d.isWorking } : d));

  const addDesignation = () =>
    setDesignations(prev => [...prev, { name: "", department: "", isActive: true }]);

  const updateDes = (i: number, field: string, val: unknown) =>
    setDesignations(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d));

  const removeDes = (i: number) =>
    setDesignations(prev => prev.filter((_, idx) => idx !== i));

  const setW = (field: string, val: unknown) =>
    setWarehouse(prev => ({ ...prev, [field]: val }));

  // ── Validation ──

  const validate = (): boolean => {
    setErrorMsg("");

    if (step === 1) {
      if (!formData.companyName.trim()) { setErrorMsg("Company name is required."); return false; }
      if (!formData.companyShortName.trim()) { setErrorMsg("Company short name is required."); return false; }
      if (!formData.email.trim()) { setErrorMsg("Company email is required."); return false; }
      if (!formData.phone.trim()) { setErrorMsg("Phone number is required."); return false; }
      if (!formData.city.trim()) { setErrorMsg("City is required."); return false; }
      if (!formData.country) { setErrorMsg("Country is required."); return false; }
      if (!formData.address.trim()) { setErrorMsg("Address is required."); return false; }
      if (!formData.timezone) { setErrorMsg("Timezone is required."); return false; }
    }

    if (step === 2) {
      if (!workingDays.some(d => d.isWorking)) { setErrorMsg("Select at least one working day."); return false; }
      if (!formData.defaultStartTime) { setErrorMsg("Start time is required."); return false; }
      if (!formData.defaultEndTime) { setErrorMsg("End time is required."); return false; }
      if (!formData.workingHoursPerDay || Number(formData.workingHoursPerDay) <= 0) { 
        setErrorMsg("Working hours per day must be greater than 0."); 
        return false; 
      }
    }

    if (step === 3) {
      if (!formData.currency) { setErrorMsg("Currency is required."); return false; }
      if (formData.taxRate === "" || Number(formData.taxRate) < 0) { 
        setErrorMsg("Tax rate is required and cannot be negative."); 
        return false; 
      }
      if (!formData.taxId.trim()) { setErrorMsg("Tax ID / GST number is required."); return false; }
    }

    if (step === 4) {
      const valid = designations.filter(d => d.name.trim());
      if (valid.length === 0) { setErrorMsg("Add at least one designation."); return false; }
      
      // Check each designation has a department selected
      for (let i = 0; i < designations.length; i++) {
        const des = designations[i];
        if (des.name.trim() && !des.department) {
          setErrorMsg(`Designation "${des.name}" requires a department selection.`);
          return false;
        }
      }
    }

    if (step === 5) {
      if (!warehouse.warehouse_name.trim()) { setErrorMsg("Warehouse name is required."); return false; }
      if (!warehouse.code.trim()) { setErrorMsg("Warehouse code is required."); return false; }
      if (!warehouse.manager_name.trim()) { setErrorMsg("Warehouse manager name is required."); return false; }
      if (!warehouse.phone.trim()) { setErrorMsg("Warehouse phone number is required."); return false; }
      if (!warehouse.email.trim()) { setErrorMsg("Warehouse email is required."); return false; }
      if (!warehouse.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { 
        setErrorMsg("Please enter a valid warehouse email address."); 
        return false; 
      }
      if (!warehouse.city.trim()) { setErrorMsg("Warehouse city is required."); return false; }
      if (!warehouse.country) { setErrorMsg("Warehouse country is required."); return false; }
      if (!warehouse.state.trim()) { setErrorMsg("Warehouse state/province is required."); return false; }
      if (!warehouse.address_line.trim()) { setErrorMsg("Warehouse address is required."); return false; }
      if (!warehouse.postal_code.trim()) { setErrorMsg("Warehouse postal code is required."); return false; }
      if (!warehouse.capacity || Number(warehouse.capacity) <= 0) {
        setErrorMsg("Warehouse capacity must be greater than 0.");
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (!validate()) return;
    setStep(prev => Math.min(prev + 1, 6) as Step);
  };

  const handlePrev = () => {
    setErrorMsg("");
    setStep(prev => Math.max(prev - 1, 1) as Step);
  };

  // ── Submit all ──

  const handleSubmit = async () => {
  setErrorMsg("");
  
  // STEP 5 VALIDATION - All fields required except description
  if (!warehouse.warehouse_name.trim()) { setErrorMsg("Warehouse name is required."); return; }
  if (!warehouse.code.trim()) { setErrorMsg("Warehouse code is required."); return; }
  if (!warehouse.manager_name.trim()) { setErrorMsg("Warehouse manager name is required."); return; }
  if (!warehouse.phone.trim()) { setErrorMsg("Warehouse phone number is required."); return; }
  if (!warehouse.email.trim()) { setErrorMsg("Warehouse email is required."); return; }
  if (!warehouse.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { 
    setErrorMsg("Please enter a valid warehouse email address."); 
    return; 
  }
  if (!warehouse.city.trim()) { setErrorMsg("Warehouse city is required."); return; }
  if (!warehouse.country) { setErrorMsg("Warehouse country is required."); return; }
  if (!warehouse.state.trim()) { setErrorMsg("Warehouse state/province is required."); return; }
  if (!warehouse.address_line.trim()) { setErrorMsg("Warehouse address is required."); return; }
  if (!warehouse.postal_code.trim()) { setErrorMsg("Warehouse postal code is required."); return; }
  if (!warehouse.capacity || Number(warehouse.capacity) <= 0) {
    setErrorMsg("Warehouse capacity must be greater than 0.");
    return;
  }

  setSaving(true);

    try {
      // 1. Company settings
      await updateSettings({
        ...formData,
        taxRate:         parseFloat(formData.taxRate) || 0,
        isSetupCompleted: true,
      });

      // 2. Working days
      await updateWorkingDays(workingDays);

      // 3. Designations
      const validDes = designations.filter(d => d.name.trim());
      if (validDes.length > 0) {
        await setupDesignations.mutateAsync(
          validDes.map(d => ({
            name:       d.name.trim(),
            department: d.department || undefined,
            isActive:   d.isActive,
          }))
        );
      }

      // 4. Warehouse
      await createWarehouse.mutateAsync({
        ...warehouse,
        capacity:          Number(warehouse.capacity),
        current_occupancy: Number(warehouse.current_occupancy) || 0,
      } as any);

      setStep(6);
      setTimeout(() => window.location.reload(), 2000);

    } catch (err) {
      setErrorMsg("Something went wrong. Please check your inputs and try again.");
    } finally {
      setSaving(false);
    }
  };

  const currentStepMeta = STEPS.find(s => s.id === step)!;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh] overflow-hidden">

        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 border-b border-border flex items-start gap-4 shrink-0">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold leading-tight">Welcome — Let's get set up</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Complete these {STEPS.length - 1} steps to configure your workspace.
            </p>
          </div>
          {/* Step badge */}
          <span className="text-xs font-mono bg-muted px-2.5 py-1 rounded-full text-muted-foreground shrink-0 mt-1">
            {step < 6 ? `${step} / 5` : "Done"}
          </span>
        </div>

        {/* ── Step Tracker ── */}
        <div className="px-6 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-1">
            {STEPS.filter(s => s.id < 6).map((s, idx) => (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                {/* Circle */}
                <button
                  type="button"
                  onClick={() => { if (s.id < step) { setErrorMsg(""); setStep(s.id as Step); } }}
                  className={`
                    relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold shrink-0 transition-all
                    ${step > s.id  ? "bg-primary text-primary-foreground cursor-pointer hover:opacity-80" : ""}
                    ${step === s.id ? "bg-primary/20 text-primary ring-2 ring-primary/40" : ""}
                    ${step < s.id  ? "bg-muted text-muted-foreground cursor-default" : ""}
                  `}
                >
                  {step > s.id ? <CheckCircle className="w-4 h-4" /> : s.id}
                </button>
                {/* Connector line */}
                {idx < STEPS.filter(s => s.id < 6).length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 rounded transition-all ${step > s.id ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
          {/* Current step label */}
          <p className="text-xs text-muted-foreground mt-2">
            <span className="text-foreground font-medium">{currentStepMeta.label}</span>
            {" — "}{currentStepMeta.description}
          </p>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Error */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── STEP 1: Company Info ── */}
          {step === 1 && (
            <div className="space-y-5">
              <SectionTitle icon={<Building2 />} title="Company Information" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Company Name" required>
                  <input className={inputCls} placeholder="Acme Corporation"
                    value={formData.companyName}
                    onChange={e => set("companyName", e.target.value)} />
                </Field>

                <Field label="Short Name / Abbreviation" required>
                  <input className={inputCls} placeholder="ACME"
                    value={formData.companyShortName}
                    onChange={e => set("companyShortName", e.target.value)} />
                </Field>

                <Field label="Business Email" required>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <input className={inputCls + " pl-8"} type="email" placeholder="info@company.com"
                      value={formData.email}
                      onChange={e => set("email", e.target.value)} />
                  </div>
                </Field>

                <Field label="Phone" required>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <input className={inputCls + " pl-8"} type="tel" placeholder="+92 300 0000000"
                      value={formData.phone}
                      onChange={e => set("phone", e.target.value)} />
                  </div>
                </Field>

                <Field label="City" required>
                  <input className={inputCls} placeholder="Karachi"
                    value={formData.city}
                    onChange={e => set("city", e.target.value)} />
                </Field>

                <Field label="Country" required>
                  <select className={selectCls} value={formData.country}
                    onChange={e => set("country", e.target.value)}>
                    <option value="PK">🇵🇰 Pakistan</option>
                    <option value="AE">🇦🇪 UAE</option>
                    <option value="SA">🇸🇦 Saudi Arabia</option>
                    <option value="US">🇺🇸 United States</option>
                    <option value="GB">🇬🇧 United Kingdom</option>
                    <option value="IN">🇮🇳 India</option>
                  </select>
                </Field>

                <Field label="Address" required className="sm:col-span-2">
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-3.5 h-3.5 text-muted-foreground" />
                    <textarea className={inputCls + " pl-8 pt-2 h-auto resize-none"} rows={2}
                      placeholder="Street address, area…"
                      value={formData.address}
                      onChange={e => set("address", e.target.value)} />
                  </div>
                </Field>

                <Field label="Timezone" required>
                  <select className={selectCls} value={formData.timezone}
                    onChange={e => set("timezone", e.target.value)}>
                    <option value="Asia/Karachi">Asia/Karachi (PKT, UTC+5)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                    <option value="Asia/Riyadh">Asia/Riyadh (AST, UTC+3)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* ── STEP 2: Working Schedule ── */}
          {step === 2 && (
            <div className="space-y-5">
              <SectionTitle icon={<CalendarDays />} title="Working Schedule" />

              <div>
                <p className={labelCls + " mb-3 after:content-['*'] after:text-destructive after:ml-1"}>Working Days</p>
                <div className="flex flex-wrap gap-2">
                  {workingDays.map(day => (
                    <button key={day.day} type="button" onClick={() => toggleDay(day.day)}
                      className={`
                        px-4 py-2 rounded-xl text-sm font-medium border transition-all select-none
                        ${day.isWorking
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/40 border-border text-muted-foreground hover:border-primary/40"}
                      `}>
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Start Time" required>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <input className={inputCls + " pl-8"} type="time"
                      value={formData.defaultStartTime}
                      onChange={e => set("defaultStartTime", e.target.value)} />
                  </div>
                </Field>

                <Field label="End Time" required>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <input className={inputCls + " pl-8"} type="time"
                      value={formData.defaultEndTime}
                      onChange={e => set("defaultEndTime", e.target.value)} />
                  </div>
                </Field>

                <Field label="Hours / Day" required>
                  <input className={inputCls} type="number" step="0.5" min="1" max="24"
                    value={formData.workingHoursPerDay}
                    onChange={e => set("workingHoursPerDay", e.target.value)} />
                </Field>
              </div>

              {/* Preview */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border text-sm flex gap-3 items-start">
                <CalendarDays className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="text-muted-foreground">
                  <span className="text-foreground font-medium">
                    {workingDays.filter(d => d.isWorking).length} working days
                  </span>{" "}
                  · {formData.defaultStartTime} – {formData.defaultEndTime}
                  · {formData.workingHoursPerDay} hrs/day
                </span>
              </div>
            </div>
          )}

          {/* ── STEP 3: Financial ── */}
          {step === 3 && (
            <div className="space-y-5">
              <SectionTitle icon={<DollarSign />} title="Financial Settings" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Currency" required>
                  <select className={selectCls} value={formData.currency}
                    onChange={e => set("currency", e.target.value)}>
                    <option value="PKR">PKR — Pakistani Rupee (₨)</option>
                    <option value="USD">USD — US Dollar ($)</option>
                    <option value="AED">AED — UAE Dirham (د.إ)</option>
                    <option value="SAR">SAR — Saudi Riyal (﷼)</option>
                    <option value="GBP">GBP — British Pound (£)</option>
                    <option value="EUR">EUR — Euro (€)</option>
                    <option value="INR">INR — Indian Rupee (₹)</option>
                  </select>
                </Field>

                <Field label="Tax Rate (%)" required>
                  <input className={inputCls} type="number" step="0.01" min="0" max="100"
                    placeholder="17"
                    value={formData.taxRate}
                    onChange={e => set("taxRate", e.target.value)} />
                </Field>

                <Field label="Tax ID / GST No." required className="sm:col-span-2">
                  <input className={inputCls} placeholder="e.g., 0000000-0"
                    value={formData.taxId}
                    onChange={e => set("taxId", e.target.value)} />
                </Field>
              </div>

              <InfoBox>
                Tax rate is applied globally to all transactions by default. You can override it
                per-product or per-invoice later in your settings.
              </InfoBox>
            </div>
          )}

          {/* ── STEP 4: Designations ── */}
          {step === 4 && (
            <div className="space-y-5">
              <SectionTitle icon={<Briefcase />} title="Job Designations" />
              <p className="text-sm text-muted-foreground -mt-2">
                Define at least one designation. All fields are required for each designation.
              </p>

              <div className="space-y-3">
                {designations.map((des, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Designation #{idx + 1}</span>
                      <button type="button" onClick={() => removeDes(idx)}
                        disabled={designations.length === 1}
                        className="text-xs text-destructive hover:bg-destructive/10 px-2 py-1 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={requiredLabelCls}>Title</label>
                        <input className={inputCls} placeholder="e.g., Software Engineer"
                          value={des.name}
                          onChange={e => updateDes(idx, "name", e.target.value)} />
                      </div>
                      <div>
                        <label className={requiredLabelCls}>Department</label>
                        <select className={selectCls} value={des.department}
                          onChange={e => updateDes(idx, "department", e.target.value)}>
                          <option value="">— Select a department —</option>
                          {DEPARTMENT_CHOICES.map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" onClick={addDesignation}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-sm text-muted-foreground hover:text-primary transition-all">
                <Plus className="w-4 h-4" /> Add Another Designation
              </button>
            </div>
          )}

          {/* ── STEP 5: Warehouse ── */}
          {step === 5 && (
            <div className="space-y-5">
              <SectionTitle icon={<Warehouse />} title="Primary Warehouse" />
              <p className="text-sm text-muted-foreground -mt-2">
                Set up your first storage location. All fields are required.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Warehouse Name" required>
                  <input className={inputCls} placeholder="Main Warehouse"
                    value={warehouse.warehouse_name}
                    onChange={e => setW("warehouse_name", e.target.value)} />
                </Field>

                <Field label="Warehouse Code" required>
                  <input className={inputCls} placeholder="WH-001"
                    value={warehouse.code}
                    onChange={e => setW("code", e.target.value.toUpperCase())} />
                </Field>

                <Field label="Manager Name" required>
                  <input className={inputCls} placeholder="Ali Khan"
                    value={warehouse.manager_name}
                    onChange={e => setW("manager_name", e.target.value)} />
                </Field>

                <Field label="Manager Phone" required>
                  <input className={inputCls} type="tel" placeholder="+92 300 0000000"
                    value={warehouse.phone}
                    onChange={e => setW("phone", e.target.value)} />
                </Field>

                <Field label="Manager Email" required>
                  <input className={inputCls} type="email" placeholder="warehouse@company.com"
                    value={warehouse.email}
                    onChange={e => setW("email", e.target.value)} />
                </Field>

                <Field label="Capacity (sq ft / m³)" required>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <input className={inputCls + " pl-8"} type="number" min="1" placeholder="5000"
                      value={warehouse.capacity}
                      onChange={e => setW("capacity", e.target.value)} />
                  </div>
                </Field>

                <Field label="Country" required>
                  <select className={selectCls} value={warehouse.country}
                    onChange={e => setW("country", e.target.value)}>
                    <option value="PK">🇵🇰 Pakistan</option>
                    <option value="AE">🇦🇪 UAE</option>
                    <option value="SA">🇸🇦 Saudi Arabia</option>
                    <option value="US">🇺🇸 United States</option>
                    <option value="GB">🇬🇧 United Kingdom</option>
                    <option value="IN">🇮🇳 India</option>
                  </select>
                </Field>

                <Field label="City" required>
                  <input className={inputCls} placeholder="Karachi"
                    value={warehouse.city}
                    onChange={e => setW("city", e.target.value)} />
                </Field>

                <Field label="State / Province" required>
                  <input className={inputCls} placeholder="Sindh"
                    value={warehouse.state}
                    onChange={e => setW("state", e.target.value)} />
                </Field>

                <Field label="Postal Code" required>
                  <input className={inputCls} placeholder="75000"
                    value={warehouse.postal_code}
                    onChange={e => setW("postal_code", e.target.value)} />
                </Field>

                <Field label="Address" required className="sm:col-span-2">
                  <textarea className={inputCls + " h-auto resize-none pt-2"} rows={2}
                    placeholder="Street / area"
                    value={warehouse.address_line}
                    onChange={e => setW("address_line", e.target.value)} />
                </Field>

                <Field label="Description" className="sm:col-span-2">
                  <textarea className={inputCls + " h-auto resize-none pt-2"} rows={2}
                    placeholder="Optional notes about this warehouse…"
                    value={warehouse.description}
                    onChange={e => setW("description", e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {/* ── STEP 6: Complete ── */}
          {step === 6 && (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle className="w-9 h-9 text-success" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">You're all set!</h3>
                <p className="text-muted-foreground mt-1 text-sm max-w-xs mx-auto">
                  Your workspace is configured. Redirecting you to the dashboard…
                </p>
              </div>
              <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                <div className="h-full bg-primary rounded-full animate-[progress_2s_ease-in-out_forwards]"
                  style={{ animation: "width 2s ease forwards", width: "100%" }} />
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        {step < 6 && (
          <div className="px-6 py-4 border-t border-border flex justify-between items-center bg-muted/20 shrink-0 gap-3">
            <Button variant="outline" onClick={handlePrev} disabled={step === 1}
              className="gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>

            <div className="flex-1 text-center">
              <span className="text-xs text-muted-foreground">Step {step} of 5</span>
            </div>

            {step < 5 ? (
              <Button onClick={handleNext} className="gap-1.5">
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={saving}
                className="gap-1.5 min-w-[130px]">
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Saving…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Finish Setup</>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tiny helper components ────────────────────────────────────────────────────

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 [&>svg]:w-4 [&>svg]:h-4">
        {icon}
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
    </div>
  );
}

function Field({
  label,
  children,
  required = false,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={required ? requiredLabelCls : labelCls}>{label}</label>
      {children}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl bg-info/10 border border-info/25 text-sm text-muted-foreground flex gap-2.5 items-start">
      <AlertCircle className="w-4 h-4 text-info shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}