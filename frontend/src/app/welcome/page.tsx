// app/welcome/page.tsx (fixed version)
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, UserCog, MapPin, Clock, Wallet, Users, Warehouse,
  Check, ChevronLeft, ChevronRight, Sparkles, Plus, Trash2,
  PartyPopper, Eye, EyeOff, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCompanySettings, useSetupDesignations } from "@/hooks/useCompanySettings";
import { useCreateWarehouse } from "@/hooks/useWarehouses";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useBranch, useUpdateBranch } from "@/hooks/useBranches";
import { DEPARTMENT_CHOICES } from "@/lib/departments";
import { LocationGroup } from "@/components/reuseable/LocationSelectors";
import CurrencySelect from "@/components/reuseable/CurrencySelect";

// ---------- Types ----------
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
  email: string;
  phone_number: string;
};

type BranchForm = {
  id?: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  is_hq: boolean;
  currency_code: string;
  tax_id: string;
};

// ---------- Steps Metadata ----------
const steps = [
  { id: 1, title: "Company Information", subtitle: "Foundation", description: "Tell us about your organization.", icon: Building2 },
  { id: 2, title: "Admin User", subtitle: "Leadership", description: "Create the primary administrator account.", icon: UserCog },
  { id: 3, title: "Primary Branch", subtitle: "Locations", description: "Set up your headquarters branch.", icon: MapPin },
  { id: 4, title: "Working Schedule", subtitle: "Operations", description: "Define your operating hours.", icon: Clock },
  { id: 5, title: "Financial Settings", subtitle: "Finance", description: "Configure currency and taxes.", icon: Wallet },
  { id: 6, title: "Designations", subtitle: "Team Structure", description: "Build your organizational roles.", icon: Users },
  { id: 7, title: "Warehouse", subtitle: "Inventory Network", description: "Register your primary warehouse.", icon: Warehouse },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---------- Helper Components ----------
function Field({ label, children, hint, required = false, className }: any) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className={cn("text-xs font-medium uppercase tracking-wider", required && "after:content-['*'] after:text-destructive after:ml-1")}>
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{children}</div>;
}

const inputCls = "bg-background/40 border-border/70 h-11 focus-visible:ring-primary/40";

// ---------- Main Component ----------
export default function WelcomePage() {
  const router = useRouter();
  const { settings, isReady, updateSettings, updateWorkingDays, isUpdating: updatingSettings } = useCompanySettings();
  const setupDesignations = useSetupDesignations();
  const createWarehouse = useCreateWarehouse();
  const { profile, updateProfile, isUpdating: updatingProfile } = useUserProfile();
  const updateBranch = useUpdateBranch();
  const { data: existingBranch, isLoading: branchLoading } = useBranch();

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ----- Form States -----
  const [companyForm, setCompanyForm] = useState({
    companyName: "", companyShortName: "", email: "", phone: "",
    country: "PK", state: "", city: "", address: "", timezone: "Asia/Karachi",
    currency: "PKR", taxRate: "17", taxId: "", defaultStartTime: "09:00",
    defaultEndTime: "18:00", workingHoursPerDay: "8",
  });

  const [adminUser, setAdminUser] = useState<AdminUserForm>({
    full_name: "", username: "", first_name: "", last_name: "", email: "", phone_number: "",
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [branch, setBranch] = useState<BranchForm>({
    name: "", code: "", address: "", city: "", state: "", country: "PK",
    phone: "", email: "", is_hq: true, currency_code: "PKR", tax_id: "",
  });

  const [workingDays, setWorkingDays] = useState(
    DAYS.map((label, idx) => ({ day: idx, label, isWorking: idx < 5 }))
  );

  const [designations, setDesignations] = useState<DesignationForm[]>([
    { name: "", department: "", isActive: true },
  ]);

  const [warehouse, setWarehouse] = useState<WarehouseForm>({
    warehouse_name: "", code: "", manager_name: "", phone: "", email: "",
    capacity: "", current_occupancy: 0, country: "PK", state: "", city: "",
    address_line: "", postal_code: "", is_active: true, description: "",
  });

  // ----- Prefill existing data -----
  useEffect(() => {
    if (isReady && settings && !settings.isSetupCompleted) {
      setCompanyForm(prev => ({
        ...prev,
        companyName: settings.companyName || "",
        companyShortName: settings.companyShortName || "",
        email: settings.email || "",
        phone: settings.phone || "",
        country: settings.country || "PK",
        state: settings.state || "",
        city: settings.city || "",
        address: settings.address || "",
        timezone: settings.timezone || "Asia/Karachi",
        currency: settings.currency || "PKR",
        taxRate: settings.taxRate?.toString() || "17",
        taxId: settings.taxId || "",
      }));
    }
  }, [isReady, settings]);

  useEffect(() => {
    if (profile) {
      setAdminUser({
        full_name: profile.full_name || "",
        username: profile.username || "",
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        email: profile.email || "",
        phone_number: profile.phone_number || "",
      });
    }
  }, [profile]);

  useEffect(() => {
    if (existingBranch) {
      setBranch({
        id: existingBranch.id,
        name: existingBranch.name,
        code: existingBranch.code,
        address: existingBranch.address,
        city: existingBranch.city,
        state: existingBranch.state,
        country: existingBranch.country,
        phone: existingBranch.phone,
        email: existingBranch.email,
        is_hq: existingBranch.is_hq,
        currency_code: existingBranch.currency_code,
        tax_id: existingBranch.tax_id || "",
      });
    }
  }, [existingBranch]);

  // Redirect if setup already completed
  useEffect(() => {
    if (isReady && settings?.isSetupCompleted) {
      router.replace("/dashboard");
    }
  }, [isReady, settings, router]);

  // ----- Helpers -----
  const setCompanyField = (field: string, value: any) =>
    setCompanyForm(prev => ({ ...prev, [field]: value }));

  const setAdminField = (field: string, value: any) =>
    setAdminUser(prev => ({ ...prev, [field]: value }));

  const setBranchField = (field: string, value: any) =>
    setBranch(prev => ({ ...prev, [field]: value }));

  const toggleDay = (dayIndex: number) =>
    setWorkingDays(prev => prev.map(d => d.day === dayIndex ? { ...d, isWorking: !d.isWorking } : d));

  const addDesignation = () =>
    setDesignations(prev => [...prev, { name: "", department: "", isActive: true }]);

  const updateDesignation = (idx: number, field: string, value: any) =>
    setDesignations(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));

  const removeDesignation = (idx: number) =>
    setDesignations(prev => prev.filter((_, i) => i !== idx));

  const setWarehouseField = (field: string, value: any) =>
    setWarehouse(prev => ({ ...prev, [field]: value }));

  // ----- Validation per step -----
  const validateStep = (step: number): boolean => {
    setErrorMsg("");
    switch (step) {
      case 1:
        if (!companyForm.companyName.trim()) { setErrorMsg("Company name required"); return false; }
        if (!companyForm.companyShortName.trim()) { setErrorMsg("Short name required"); return false; }
        if (!companyForm.email.trim()) { setErrorMsg("Email required"); return false; }
        if (!companyForm.phone.trim()) { setErrorMsg("Phone required"); return false; }
        if (!companyForm.city.trim()) { setErrorMsg("City required"); return false; }
        if (!companyForm.state.trim()) { setErrorMsg("State required"); return false; }
        if (!companyForm.country) { setErrorMsg("Country required"); return false; }
        if (!companyForm.address.trim()) { setErrorMsg("Address required"); return false; }
        if (!companyForm.timezone) { setErrorMsg("Timezone required"); return false; }
        return true;
      case 2:
        if (!adminUser.full_name.trim()) { setErrorMsg("Full name required"); return false; }
        if (!adminUser.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminUser.email)) {
          setErrorMsg("Valid email required"); return false;
        }
        if (password && password !== confirmPassword) { setErrorMsg("Passwords do not match"); return false; }
        if (password && password.length < 6) { setErrorMsg("Password must be at least 6 characters"); return false; }
        return true;
      case 3:
        if (!branch.name.trim()) { setErrorMsg("Branch name required"); return false; }
        if (!branch.code.trim()) { setErrorMsg("Branch code required"); return false; }
        if (!branch.address.trim()) { setErrorMsg("Address required"); return false; }
        if (!branch.city.trim()) { setErrorMsg("City required"); return false; }
        if (!branch.state.trim()) { setErrorMsg("State required"); return false; }
        if (!branch.country) { setErrorMsg("Country required"); return false; }
        if (!branch.phone.trim()) { setErrorMsg("Phone required"); return false; }
        if (!branch.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(branch.email)) {
          setErrorMsg("Valid branch email required"); return false;
        }
        return true;
      case 4:
        if (!workingDays.some(d => d.isWorking)) { setErrorMsg("Select at least one working day"); return false; }
        if (!companyForm.defaultStartTime || !companyForm.defaultEndTime) {
          setErrorMsg("Start and end time required"); return false;
        }
        if (!companyForm.workingHoursPerDay || Number(companyForm.workingHoursPerDay) <= 0) {
          setErrorMsg("Working hours per day must be > 0"); return false;
        }
        return true;
      case 5:
        if (!companyForm.currency) { setErrorMsg("Currency required"); return false; }
        if (companyForm.taxRate === "" || Number(companyForm.taxRate) < 0) {
          setErrorMsg("Valid tax rate required"); return false;
        }
        if (!companyForm.taxId.trim()) { setErrorMsg("Tax ID / GST number required"); return false; }
        return true;
      case 6:
        const valid = designations.filter(d => d.name.trim());
        if (valid.length === 0) { setErrorMsg("At least one designation required"); return false; }
        for (let i = 0; i < designations.length; i++) {
          const d = designations[i];
          if (d.name.trim() && !d.department) {
            setErrorMsg(`Designation "${d.name}" needs a department`); return false;
          }
        }
        return true;
      case 7:
        if (!warehouse.warehouse_name.trim()) { setErrorMsg("Warehouse name required"); return false; }
        if (!warehouse.code.trim()) { setErrorMsg("Warehouse code required"); return false; }
        if (!warehouse.manager_name.trim()) { setErrorMsg("Manager name required"); return false; }
        if (!warehouse.phone.trim()) { setErrorMsg("Phone required"); return false; }
        if (!warehouse.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(warehouse.email)) {
          setErrorMsg("Valid warehouse email required"); return false;
        }
        if (!warehouse.city.trim()) { setErrorMsg("City required"); return false; }
        if (!warehouse.country) { setErrorMsg("Country required"); return false; }
        if (!warehouse.state.trim()) { setErrorMsg("State required"); return false; }
        if (!warehouse.address_line.trim()) { setErrorMsg("Address required"); return false; }
        if (!warehouse.postal_code.trim()) { setErrorMsg("Postal code required"); return false; }
        if (!warehouse.capacity || Number(warehouse.capacity) <= 0) {
          setErrorMsg("Capacity must be > 0"); return false;
        }
        return true;
      default: return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCompletedSteps(prev => new Set(prev).add(currentStep));
      if (currentStep < steps.length) setCurrentStep(s => s + 1);
      else handleFinalSubmit();
    }
  };

  const prevStep = () => currentStep > 1 && setCurrentStep(s => s - 1);

  // ----- Final Submission -----
  const handleFinalSubmit = async () => {
    if (!validateStep(7)) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      await updateSettings({
        companyName: companyForm.companyName,
        companyShortName: companyForm.companyShortName,
        email: companyForm.email,
        phone: companyForm.phone,
        country: companyForm.country,
        state: companyForm.state,
        city: companyForm.city,
        address: companyForm.address,
        timezone: companyForm.timezone,
        currency: companyForm.currency,
        taxRate: parseFloat(companyForm.taxRate),
        taxId: companyForm.taxId,
        isSetupCompleted: true,
      });

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

      await updateBranch.mutateAsync({
        ...branch,
        currency_code: companyForm.currency,
      });

      await updateWorkingDays(workingDays.map(({ day, label, isWorking }) => ({ day, label, isWorking })));

      const validDesignations = designations.filter(d => d.name.trim());
      if (validDesignations.length) {
        await setupDesignations.mutateAsync(validDesignations.map(d => ({
          name: d.name.trim(),
          department: d.department,
          isActive: d.isActive,
        })));
      }

      await createWarehouse.mutateAsync({
        ...warehouse,
        capacity: Number(warehouse.capacity),
        current_occupancy: Number(warehouse.current_occupancy) || 0,
      });

      setDone(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err) {
      console.error(err);
      setErrorMsg("Setup failed. Please check your inputs and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isReady || (settings && settings.isSetupCompleted)) return null;
  if (done) return <SuccessScreen />;

  const percent = Math.round((completedSteps.size / steps.length) * 100);
  const currentMeta = steps[currentStep - 1];

  return (
    <div className="h-screen w-full flex overflow-hidden">
      {/* Sidebar - scrollable independently */}
      <aside className="hidden lg:flex flex-col w-[400px] xl:w-[480px] shrink-0 border-r border-border/60 bg-sidebar overflow-hidden">
        <div className="relative flex-1 flex flex-col overflow-y-auto">
          <div className="absolute inset-0 opacity-60 pointer-events-none"
            style={{ background: "radial-gradient(600px 400px at 20% 10%, oklch(0.74 0.17 162 / 12%), transparent 60%)" }} />
          <div className="relative z-10 flex flex-col h-full p-8 xl:p-10">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="h-9 w-9 rounded-xl grid place-items-center" style={{ background: "var(--gradient-primary)" }}>
                <Sparkles className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div className="font-semibold tracking-tight">Workspace Setup</div>
            </div>

            <div className="mt-10 shrink-0">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                Welcome
              </Badge>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight leading-tight">
                Let's set up your business headquarters
              </h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Seven quick steps to configure your company, team and operations.
              </p>
            </div>

            <div className="mt-8 shrink-0">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Setup progress</span>
                <span className="font-medium text-foreground">{percent}%</span>
              </div>
              <Progress value={percent} className="h-1.5" />
            </div>

            <nav className="mt-8 space-y-1.5 flex-1 overflow-y-auto pr-1 pb-4">
              {steps.map((s) => {
                const Icon = s.icon;
                const isDone = completedSteps.has(s.id);
                const isCurrent = currentStep === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setCurrentStep(s.id)}
                    className={cn(
                      "w-full text-left rounded-xl px-3 py-3 flex items-center gap-3 transition-all border",
                      isCurrent
                        ? "bg-primary/10 border-primary/30 shadow-[0_0_0_1px_var(--ring)]"
                        : "border-transparent hover:bg-sidebar-accent/60",
                    )}
                  >
                    <div className={cn(
                      "h-9 w-9 rounded-lg grid place-items-center shrink-0 transition-colors",
                      isDone ? "bg-primary text-primary-foreground" :
                      isCurrent ? "bg-primary/15 text-primary" : "bg-sidebar-accent text-muted-foreground",
                    )}>
                      {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Step {s.id} · {s.subtitle}
                      </div>
                      <div className={cn("text-sm font-medium truncate", isCurrent && "text-foreground")}>
                        {s.title}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>

      {/* Main Content - scrollable independently */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl w-full mx-auto px-6 md:px-12 lg:px-16 py-10 lg:py-14">
            {/* Mobile progress */}
            <div className="lg:hidden mb-8">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Step {currentStep} of {steps.length}</span>
                <span>{percent}%</span>
              </div>
              <Progress value={percent} className="h-1.5" />
            </div>

            <div className="mb-1.5 text-xs uppercase tracking-[0.18em] text-primary font-medium">
              Step {currentStep} · {currentMeta.subtitle}
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{currentMeta.title}</h1>
            <p className="mt-2 text-muted-foreground">{currentMeta.description}</p>

            {errorMsg && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-border/70 bg-card/80 backdrop-blur p-6 md:p-8">
              {currentStep === 1 && (
                <Grid>
                  <Field label="Company Name" required><Input className={inputCls} value={companyForm.companyName} onChange={e => setCompanyField("companyName", e.target.value)} placeholder="Acme Corporation" /></Field>
                  <Field label="Short Name" required><Input className={inputCls} value={companyForm.companyShortName} onChange={e => setCompanyField("companyShortName", e.target.value)} placeholder="Acme" /></Field>
                  <Field label="Business Email" required><Input className={inputCls} type="email" value={companyForm.email} onChange={e => setCompanyField("email", e.target.value)} placeholder="hello@acme.com" /></Field>
                  <Field label="Phone" required><Input className={inputCls} value={companyForm.phone} onChange={e => setCompanyField("phone", e.target.value)} placeholder="+1 555 010 0000" /></Field>
                  <div className="md:col-span-2">
                    <LocationGroup
                      country={companyForm.country} setCountry={(v) => setCompanyField("country", v)}
                      state={companyForm.state} setState={(v) => setCompanyField("state", v)}
                      city={companyForm.city} setCity={(v) => setCompanyField("city", v)}
                      required
                    />
                  </div>
                  <Field label="Address" required className="md:col-span-2">
                    <Textarea className="bg-background/40 border-border/70 min-h-[90px]" value={companyForm.address} onChange={e => setCompanyField("address", e.target.value)} placeholder="Street, building, floor…" />
                  </Field>
                  <Field label="Timezone" required>
                    <Select value={companyForm.timezone} onValueChange={v => setCompanyField("timezone", v)}>
                      <SelectTrigger className={inputCls}><SelectValue placeholder="Select timezone" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Karachi">Asia/Karachi (PKT, UTC+5)</SelectItem>
                        <SelectItem value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</SelectItem>
                        <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </Grid>
              )}

              {currentStep === 2 && (
                <div className="space-y-5">
                  <Grid>
                    <Field label="Full Name" required className="md:col-span-2"><Input className={inputCls} value={adminUser.full_name} onChange={e => setAdminField("full_name", e.target.value)} placeholder="John Doe" /></Field>
                    <Field label="Username" required><Input className={inputCls} value={adminUser.username} onChange={e => setAdminField("username", e.target.value)} placeholder="johndoe" /></Field>
                    <Field label="Email" required><Input className={inputCls} type="email" value={adminUser.email} onChange={e => setAdminField("email", e.target.value)} /></Field>
                    <Field label="First Name"><Input className={inputCls} value={adminUser.first_name} onChange={e => setAdminField("first_name", e.target.value)} /></Field>
                    <Field label="Last Name"><Input className={inputCls} value={adminUser.last_name} onChange={e => setAdminField("last_name", e.target.value)} /></Field>
                    <Field label="Phone Number" className="md:col-span-2"><Input className={inputCls} value={adminUser.phone_number} onChange={e => setAdminField("phone_number", e.target.value)} /></Field>
                    <Field label="New Password" hint="Optional – leave blank to keep current">
                      <div className="relative">
                        <Input className={inputCls + " pr-10"} type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </Field>
                    <Field label="Confirm Password">
                      <div className="relative">
                        <Input className={inputCls + " pr-10"} type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </Field>
                  </Grid>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-5">
                  {branchLoading ? (
                    <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>
                  ) : (
                    <Grid>
                      <Field label="Branch Name" required><Input className={inputCls} value={branch.name} onChange={e => setBranchField("name", e.target.value)} /></Field>
                      <Field label="Branch Code" required><Input className={inputCls} value={branch.code} onChange={e => setBranchField("code", e.target.value.toUpperCase())} /></Field>
                      <Field label="Email" required><Input className={inputCls} type="email" value={branch.email} onChange={e => setBranchField("email", e.target.value)} /></Field>
                      <Field label="Phone" required><Input className={inputCls} value={branch.phone} onChange={e => setBranchField("phone", e.target.value)} /></Field>
                      <div className="md:col-span-2">
                        <LocationGroup country={branch.country} setCountry={v => setBranchField("country", v)} state={branch.state} setState={v => setBranchField("state", v)} city={branch.city} setCity={v => setBranchField("city", v)} required />
                      </div>
                      <Field label="Address" required className="md:col-span-2"><Textarea className="bg-background/40 border-border/70 min-h-[90px]" value={branch.address} onChange={e => setBranchField("address", e.target.value)} /></Field>
                      <Field label="Tax ID (Optional)" className="md:col-span-2"><Input className={inputCls} value={branch.tax_id} onChange={e => setBranchField("tax_id", e.target.value)} /></Field>
                    </Grid>
                  )}
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6">
                  <Field label="Working Days" required>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {workingDays.map((day) => (
                        <button key={day.day} type="button" onClick={() => toggleDay(day.day)} className={cn(
                          "h-11 min-w-[64px] rounded-xl px-4 text-sm font-medium border transition-all",
                          day.isWorking ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" : "bg-background/40 border-border/70 text-muted-foreground hover:text-foreground"
                        )}>{day.label}</button>
                      ))}
                    </div>
                  </Field>
                  <Grid>
                    <Field label="Start Time" required><Input className={inputCls} type="time" value={companyForm.defaultStartTime} onChange={e => setCompanyField("defaultStartTime", e.target.value)} /></Field>
                    <Field label="End Time" required><Input className={inputCls} type="time" value={companyForm.defaultEndTime} onChange={e => setCompanyField("defaultEndTime", e.target.value)} /></Field>
                    <Field label="Hours per Day" required className="md:col-span-2"><Input className={inputCls} type="number" min={0} max={24} value={companyForm.workingHoursPerDay} onChange={e => setCompanyField("workingHoursPerDay", e.target.value)} /></Field>
                  </Grid>
                </div>
              )}

              {currentStep === 5 && (
                <Grid>
                  <Field label="Currency" required>
                    <CurrencySelect value={companyForm.currency} onChange={v => setCompanyField("currency", v)} required />
                  </Field>
                  <Field label="Tax Rate (%)" required><Input className={inputCls} type="number" step="0.01" min={0} max={100} value={companyForm.taxRate} onChange={e => setCompanyField("taxRate", e.target.value)} /></Field>
                  <Field label="Tax ID / GST Number" required className="md:col-span-2"><Input className={inputCls} value={companyForm.taxId} onChange={e => setCompanyField("taxId", e.target.value)} /></Field>
                </Grid>
              )}

              {currentStep === 6 && (
                <div className="space-y-4">
                  {designations.map((des, idx) => (
                    <div key={idx} className="rounded-xl border border-border/70 bg-background/30 p-4 md:p-5 grid md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                      <Field label={`Designation Name ${idx + 1}`}>
                        <Input className={inputCls} value={des.name} onChange={e => updateDesignation(idx, "name", e.target.value)} placeholder="e.g. Sales Manager" />
                      </Field>
                      <Field label="Department">
                        <Select value={des.department} onValueChange={v => updateDesignation(idx, "department", v)}>
                          <SelectTrigger className={inputCls}><SelectValue placeholder="Select department" /></SelectTrigger>
                          <SelectContent>
                            {DEPARTMENT_CHOICES.map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Button variant="ghost" size="icon" onClick={() => removeDesignation(idx)} className="h-11 w-11 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" onClick={addDesignation} className="w-full h-11 border-dashed gap-2 hover:bg-primary/5 hover:border-primary/40 hover:text-primary">
                    <Plus className="h-4 w-4" /> Add Designation
                  </Button>
                </div>
              )}

              {currentStep === 7 && (
                <Grid>
                  <Field label="Warehouse Name" required><Input className={inputCls} value={warehouse.warehouse_name} onChange={e => setWarehouseField("warehouse_name", e.target.value)} /></Field>
                  <Field label="Warehouse Code" required><Input className={inputCls} value={warehouse.code} onChange={e => setWarehouseField("code", e.target.value.toUpperCase())} /></Field>
                  <Field label="Manager Name" required><Input className={inputCls} value={warehouse.manager_name} onChange={e => setWarehouseField("manager_name", e.target.value)} /></Field>
                  <Field label="Manager Phone" required><Input className={inputCls} value={warehouse.phone} onChange={e => setWarehouseField("phone", e.target.value)} /></Field>
                  <Field label="Manager Email" required><Input className={inputCls} type="email" value={warehouse.email} onChange={e => setWarehouseField("email", e.target.value)} /></Field>
                  <Field label="Capacity" required><Input className={inputCls} value={warehouse.capacity} onChange={e => setWarehouseField("capacity", e.target.value)} placeholder="e.g. 10000" /></Field>
                  <div className="md:col-span-2">
                    <LocationGroup country={warehouse.country} setCountry={v => setWarehouseField("country", v)} state={warehouse.state} setState={v => setWarehouseField("state", v)} city={warehouse.city} setCity={v => setWarehouseField("city", v)} required />
                  </div>
                  <Field label="Postal Code" required><Input className={inputCls} value={warehouse.postal_code} onChange={e => setWarehouseField("postal_code", e.target.value)} /></Field>
                  <Field label="Address" required className="md:col-span-2"><Textarea className="bg-background/40 border-border/70 min-h-[80px]" value={warehouse.address_line} onChange={e => setWarehouseField("address_line", e.target.value)} /></Field>
                  <Field label="Description" className="md:col-span-2"><Textarea className="bg-background/40 border-border/70 min-h-[80px]" value={warehouse.description} onChange={e => setWarehouseField("description", e.target.value)} placeholder="Optional notes" /></Field>
                </Grid>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between gap-4 pb-4">
              <Button variant="ghost" onClick={prevStep} disabled={currentStep === 1} className="gap-1.5">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex items-center gap-3">
                <span className="hidden sm:block text-xs text-muted-foreground">
                  {completedSteps.size} of {steps.length} completed
                </span>
                <Button onClick={nextStep} disabled={submitting || updatingSettings || updatingProfile} className="gap-1.5 shadow-lg shadow-primary/20">
                  {submitting ? "Saving..." : (currentStep === steps.length ? "Complete Setup" : "Continue")}
                  {!submitting && <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SuccessScreen() {
  return (
    <div className="h-screen w-full grid place-items-center px-6 py-16">
      <div className="max-w-xl w-full text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="relative mx-auto h-28 w-28">
          <div className="absolute inset-0 rounded-full blur-2xl opacity-60" style={{ background: "var(--gradient-primary)" }} />
          <div className="relative h-28 w-28 rounded-full grid place-items-center" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            <PartyPopper className="h-12 w-12 text-primary-foreground" strokeWidth={2} />
          </div>
        </div>
        <h1 className="mt-10 text-4xl font-semibold tracking-tight">Your Workspace Is Ready</h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Your company has been successfully configured. Redirecting you to the dashboard...
        </p>
        <div className="mt-8 w-32 h-1.5 bg-muted rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-primary rounded-full animate-[progress_2s_ease-in-out_forwards]" style={{ width: "100%" }} />
        </div>
      </div>
    </div>
  );
}