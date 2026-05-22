// src/components/CompanySetupModal.tsx
"use client";

import { useState, useEffect } from "react";
import { useCompanySettings, useSetupDesignations } from "@/hooks/useCompanySettings";
import { useCreateWarehouse } from "@/hooks/useWarehouses";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useBranch, useUpdateBranch } from "@/hooks/useBranches";
import { Button } from "@/components/ui/button";
import {
  Building2, Globe, CalendarDays, Briefcase,
  CheckCircle, AlertCircle, Warehouse, Clock,
  DollarSign, Users, ArrowRight, ArrowLeft, Sparkles,
  Phone, Mail, MapPin, Plus, Trash2, Package, UserCircle, Home, Eye, EyeOff, Lock
} from "lucide-react";
import { DEPARTMENT_CHOICES } from "@/lib/departments";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

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

type AdminUserForm = {
  full_name: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  department: string;
  email: string;
  designation: string;
  phone_number: string;
};

type BranchForm = {
  id?: string;
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  is_hq: boolean;
  currency_code: string;
  tax_id: string;
};

// ─── Step meta ────────────────────────────────────────────────────────────────

const STEPS: { id: Step; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 1, label: "Company",    icon: <Building2 className="w-4 h-4" />,    description: "Basic info" },
  { id: 2, label: "Admin User", icon: <UserCircle className="w-4 h-4" />,   description: "Your profile" },
  { id: 3, label: "Branch",     icon: <Home className="w-4 h-4" />,         description: "First location" },
  { id: 4, label: "Schedule",   icon: <CalendarDays className="w-4 h-4" />, description: "Working days" },
  { id: 5, label: "Financial",  icon: <DollarSign className="w-4 h-4" />,   description: "Currency & tax" },
  { id: 6, label: "Roles",      icon: <Briefcase className="w-4 h-4" />,    description: "Designations" },
  { id: 7, label: "Warehouse",  icon: <Warehouse className="w-4 h-4" />,    description: "Storage" },
  { id: 8, label: "Complete",   icon: <Sparkles className="w-4 h-4" />,     description: "All done!" },
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
  const createWarehouse = useCreateWarehouse();
  const { profile, updateProfile, isUpdating: isUpdatingProfile } = useUserProfile();
  const updateBranch = useUpdateBranch();

  const [step, setStep] = useState<Step>(1);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

const [adminUser, setAdminUser] = useState<AdminUserForm>({
  full_name: "",
  username: "",
  first_name: "",
  last_name: "",
  email: "",              
  role: "COMPANY_ADMIN",
  department: "",
  designation: "",
  phone_number: "",
});


  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [branch, setBranch] = useState<BranchForm>({
    id: undefined,
    name: "",
    code: "",
    address: "",
    city: "",
    country: "PK",
    phone: "",
    email: "",
    is_hq: true,
    currency_code: "PKR",
    tax_id: "",
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

  // ── Fetch existing branch when on step 3 ──
  const { data: existingBranch, isLoading: branchLoading } = useBranch();
  // ── Prefill from existing data ──

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

  useEffect(() => {
    if (profile) {
      setAdminUser(prev => ({
        ...prev,
        full_name: profile.full_name || prev.full_name,
        email: profile.email || prev.email,
        phone_number: profile.phone_number || prev.phone_number,
      }));
    }
  }, [profile]);

  // Pre-fill branch when existing branch loads
  useEffect(() => {
    if (existingBranch && step === 3) {
      setBranch({
        id: existingBranch.id,
        name: existingBranch.name,
        code: existingBranch.code,
        address: existingBranch.address,
        city: existingBranch.city,
        country: existingBranch.country,
        phone: existingBranch.phone,
        email: existingBranch.email,
        is_hq: existingBranch.is_hq,
        currency_code: existingBranch.currency_code,
        tax_id: existingBranch.tax_id || "",
      });
    }
  }, [existingBranch, step]);

  if (!isReady || (settings && settings.isSetupCompleted)) return null;

  // ── Helpers ──

  const setField = (field: string, value: unknown) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const setAdmin = (field: string, value: unknown) =>
    setAdminUser(prev => ({ ...prev, [field]: value }));

  const setBranchField = (field: string, value: unknown) =>
    setBranch(prev => ({ ...prev, [field]: value }));

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
      if (!adminUser.full_name.trim()) { setErrorMsg("Your full name is required."); return false; }
      if (!adminUser.email.trim()) { setErrorMsg("Email address is required."); return false; }
  if (!adminUser.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    setErrorMsg("Please enter a valid email address.");
    return false;
  }

      if (password && password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return false;
      }
      if (password && password.length < 6) {
        setErrorMsg("Password must be at least 6 characters.");
        return false;
      }
    }

    if (step === 3) {
      if (!branch.name.trim()) { setErrorMsg("Branch name is required."); return false; }
      if (!branch.code.trim()) { setErrorMsg("Branch code is required."); return false; }
      if (!branch.address.trim()) { setErrorMsg("Branch address is required."); return false; }
      if (!branch.city.trim()) { setErrorMsg("Branch city is required."); return false; }
      if (!branch.country) { setErrorMsg("Branch country is required."); return false; }
      if (!branch.phone.trim()) { setErrorMsg("Branch phone number is required."); return false; }
      if (!branch.email.trim()) { setErrorMsg("Branch email is required."); return false; }
      if (!branch.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { 
        setErrorMsg("Please enter a valid branch email address."); 
        return false; 
      }
    }

    if (step === 4) {
      if (!workingDays.some(d => d.isWorking)) { setErrorMsg("Select at least one working day."); return false; }
      if (!formData.defaultStartTime) { setErrorMsg("Start time is required."); return false; }
      if (!formData.defaultEndTime) { setErrorMsg("End time is required."); return false; }
      if (!formData.workingHoursPerDay || Number(formData.workingHoursPerDay) <= 0) { 
        setErrorMsg("Working hours per day must be greater than 0."); 
        return false; 
      }
    }

    if (step === 5) {
      if (!formData.currency) { setErrorMsg("Currency is required."); return false; }
      if (formData.taxRate === "" || Number(formData.taxRate) < 0) { 
        setErrorMsg("Tax rate is required and cannot be negative."); 
        return false; 
      }
      if (!formData.taxId.trim()) { setErrorMsg("Tax ID / GST number is required."); return false; }
    }

    if (step === 6) {
      const valid = designations.filter(d => d.name.trim());
      if (valid.length === 0) { setErrorMsg("Add at least one designation."); return false; }
      
      for (let i = 0; i < designations.length; i++) {
        const des = designations[i];
        if (des.name.trim() && !des.department) {
          setErrorMsg(`Designation "${des.name}" requires a department selection.`);
          return false;
        }
      }
    }

    if (step === 7) {
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
    setStep(prev => Math.min(prev + 1, 8) as Step);
  };

  const handlePrev = () => {
    setErrorMsg("");
    setStep(prev => Math.max(prev - 1, 1) as Step);
  };

  // ── Submit all ──

  const handleSubmit = async () => {
    setErrorMsg("");
    
    // Final validation for last step
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
      // 1. Company settings (this will create company if needed)
      await updateSettings({
        ...formData,
        taxRate: parseFloat(formData.taxRate) || 0,
        isSetupCompleted: true,
      });

      // 2. Update user profile (Admin User) with optional password
      const profileUpdates: any = {
        full_name: adminUser.full_name,
          username: adminUser.username,
  first_name: adminUser.first_name,
  last_name: adminUser.last_name,
  email: adminUser.email,
  phone_number: adminUser.phone_number,
      };
      if (password) {
        profileUpdates.password = password;
        profileUpdates.confirm_password = confirmPassword;
      }
      await updateProfile(profileUpdates);

      // 3. Create or update branch
      
        await updateBranch.mutateAsync({
          name: branch.name,
          code: branch.code,
          address: branch.address,
          city: branch.city,
          country: branch.country,
          phone: branch.phone,
          email: branch.email,
          is_hq: branch.is_hq,
          currency_code: formData.currency,
          tax_id: branch.tax_id,
        });

      // 4. Working days
      await updateWorkingDays(workingDays);

      // 5. Designations
      const validDes = designations.filter(d => d.name.trim());
      if (validDes.length > 0) {
        await setupDesignations.mutateAsync(
          validDes.map(d => ({
            name: d.name.trim(),
            department: d.department || undefined,
            isActive: d.isActive,
          }))
        );
      }

      // 6. Warehouse
      await createWarehouse.mutateAsync({
        ...warehouse,
        capacity: Number(warehouse.capacity),
        current_occupancy: Number(warehouse.current_occupancy) || 0,
      } as any);

      setStep(8);
      setTimeout(() => window.location.reload(), 2000);

    } catch (err) {
      console.error("Setup error:", err);
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
          <span className="text-xs font-mono bg-muted px-2.5 py-1 rounded-full text-muted-foreground shrink-0 mt-1">
            {step < 8 ? `${step} / 7` : "Done"}
          </span>
        </div>

        {/* ── Step Tracker ── */}
        <div className="px-6 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STEPS.filter(s => s.id < 8).map((s, idx) => (
              <div key={s.id} className="flex items-center flex-1 min-w-[60px] last:flex-none">
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
                {idx < STEPS.filter(s => s.id < 8).length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 rounded transition-all ${step > s.id ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
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
                    onChange={e => setField("companyName", e.target.value)} />
                </Field>

                <Field label="Short Name / Abbreviation" required>
                  <input className={inputCls} placeholder="ACME"
                    value={formData.companyShortName}
                    onChange={e => setField("companyShortName", e.target.value)} />
                </Field>

                <Field label="Business Email" required>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <input className={inputCls + " pl-8"} type="email" placeholder="info@company.com"
                      value={formData.email}
                      onChange={e => setField("email", e.target.value)} />
                  </div>
                </Field>

                <Field label="Phone" required>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <input className={inputCls + " pl-8"} type="tel" placeholder="+92 300 0000000"
                      value={formData.phone}
                      onChange={e => setField("phone", e.target.value)} />
                  </div>
                </Field>

                <Field label="City" required>
                  <input className={inputCls} placeholder="Karachi"
                    value={formData.city}
                    onChange={e => setField("city", e.target.value)} />
                </Field>

                <Field label="Country" required>
                  <select className={selectCls} value={formData.country}
                    onChange={e => setField("country", e.target.value)}>
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
                      onChange={e => setField("address", e.target.value)} />
                  </div>
                </Field>

                <Field label="Timezone" required>
                  <select className={selectCls} value={formData.timezone}
                    onChange={e => setField("timezone", e.target.value)}>
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

          {/* ── STEP 2: Admin User Info with Password ── */}
          {step === 2 && (
            <div className="space-y-5">
              <SectionTitle icon={<UserCircle />} title="Your Profile (Admin User)" />
              <p className="text-sm text-muted-foreground -mt-2">
                This will be your administrator account for the system.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name" required>
                  <input className={inputCls} placeholder="John Doe"
                    value={adminUser.full_name}
                    onChange={e => setAdmin("full_name", e.target.value)} />
                </Field>
                <Field label="Username" required>
  <input className={inputCls} placeholder="johndoe"
    value={adminUser.username}
    onChange={e => setAdmin("username", e.target.value)} />
</Field>

<Field label="First Name">
  <input className={inputCls} placeholder="John"
    value={adminUser.first_name}
    onChange={e => setAdmin("first_name", e.target.value)} />
</Field>

<Field label="Last Name">
  <input className={inputCls} placeholder="Doe"
    value={adminUser.last_name}
    onChange={e => setAdmin("last_name", e.target.value)} />
</Field>

                <Field label="Email" required>
  <div className="relative">
    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground mt-0.5" />
    <input
      className={inputCls + " pl-8"}
      type="email"
      placeholder="admin@company.com"
      value={adminUser.email}
      onChange={e => setAdmin("email", e.target.value)}
    />
  </div>
</Field>

                <Field label="Phone (Optional)">
                  <input className={inputCls} type="tel" placeholder="+92 300 0000000"
                    value={adminUser.phone_number}
                    onChange={e => setAdmin("phone_number", e.target.value)} />
                </Field>

                <Field label="New Password (Optional)">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <input 
                      className={inputCls + " pl-8 pr-10"} 
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Leave blank to keep current password
                  </p>
                </Field>

                <Field label="Confirm Password">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <input 
                      className={inputCls + " pl-8 pr-10"} 
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </Field>
              </div>

              <InfoBox>
                As the first user, you'll have full administrative privileges. You can manage
                other users and their permissions later from the Users section.
              </InfoBox>
            </div>
          )}

          {/* ── STEP 3: Branch Setup ── */}
          {step === 3 && (
            <div className="space-y-5">
              <SectionTitle icon={<Home />} title="Primary Branch / Location" />
              <p className="text-sm text-muted-foreground -mt-2">
                Your company's main office or headquarters.
              </p>

              {branchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Branch Name" required>
                      <input className={inputCls} placeholder="Head Office"
                        value={branch.name}
                        onChange={e => setBranchField("name", e.target.value)} />
                    </Field>

                    <Field label="Branch Code" required>
                      <input className={inputCls} placeholder="HO-001"
                        value={branch.code}
                        onChange={e => setBranchField("code", e.target.value.toUpperCase())} />
                    </Field>

                    <Field label="Email" required>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                        <input className={inputCls + " pl-8"} type="email" placeholder="branch@company.com"
                          value={branch.email}
                          onChange={e => setBranchField("email", e.target.value)} />
                      </div>
                    </Field>

                    <Field label="Phone" required>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                        <input className={inputCls + " pl-8"} type="tel" placeholder="+92 300 0000000"
                          value={branch.phone}
                          onChange={e => setBranchField("phone", e.target.value)} />
                      </div>
                    </Field>

                    <Field label="City" required>
                      <input className={inputCls} placeholder="Karachi"
                        value={branch.city}
                        onChange={e => setBranchField("city", e.target.value)} />
                    </Field>

                    <Field label="Country" required>
                      <select className={selectCls} value={branch.country}
                        onChange={e => setBranchField("country", e.target.value)}>
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
                          value={branch.address}
                          onChange={e => setBranchField("address", e.target.value)} />
                      </div>
                    </Field>

                    <Field label="Tax ID / GST (Optional)">
                      <input className={inputCls} placeholder="Branch-specific tax ID"
                        value={branch.tax_id}
                        onChange={e => setBranchField("tax_id", e.target.value)} />
                    </Field>
                  </div>

                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm flex gap-3 items-start">
                    <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">
                      This will be set as your <strong className="text-foreground">Headquarters (HQ)</strong> by default.
                      You can add more branches later.
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── STEP 4: Working Schedule ── */}
          {step === 4 && (
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
                      onChange={e => setField("defaultStartTime", e.target.value)} />
                  </div>
                </Field>

                <Field label="End Time" required>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <input className={inputCls + " pl-8"} type="time"
                      value={formData.defaultEndTime}
                      onChange={e => setField("defaultEndTime", e.target.value)} />
                  </div>
                </Field>

                <Field label="Hours / Day" required>
                  <input className={inputCls} type="number" step="0.5" min="1" max="24"
                    value={formData.workingHoursPerDay}
                    onChange={e => setField("workingHoursPerDay", e.target.value)} />
                </Field>
              </div>

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

          {/* ── STEP 5: Financial ── */}
          {step === 5 && (
            <div className="space-y-5">
              <SectionTitle icon={<DollarSign />} title="Financial Settings" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Currency" required>
                  <select className={selectCls} value={formData.currency}
                    onChange={e => setField("currency", e.target.value)}>
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
                    onChange={e => setField("taxRate", e.target.value)} />
                </Field>

                <Field label="Tax ID / GST No." required className="sm:col-span-2">
                  <input className={inputCls} placeholder="e.g., 0000000-0"
                    value={formData.taxId}
                    onChange={e => setField("taxId", e.target.value)} />
                </Field>
              </div>

              <InfoBox>
                Tax rate is applied globally to all transactions by default. You can override it
                per-product or per-invoice later in your settings.
              </InfoBox>
            </div>
          )}

          {/* ── STEP 6: Designations ── */}
          {step === 6 && (
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

          {/* ── STEP 7: Warehouse ── */}
          {step === 7 && (
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

          {/* ── STEP 8: Complete ── */}
          {step === 8 && (
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
        {step < 8 && (
          <div className="px-6 py-4 border-t border-border flex justify-between items-center bg-muted/20 shrink-0 gap-3">
            <Button variant="outline" onClick={handlePrev} disabled={step === 1}
              className="gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>

            <div className="flex-1 text-center">
              <span className="text-xs text-muted-foreground">Step {step} of 7</span>
            </div>

            {step < 7 ? (
              <Button onClick={handleNext} className="gap-1.5">
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={saving || isUpdating || isUpdatingProfile}
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

// ─── Helper components ────────────────────────────────────────────────────────────

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