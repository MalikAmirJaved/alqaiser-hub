// demo/page.tsx

"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  UserCog,
  MapPin,
  Clock,
  Wallet,
  Users,
  Warehouse,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  Trash2,
  CloudUpload,
  PartyPopper,
  ArrowRight,
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

type Designation = { id: string; name: string; department: string };
const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};
type FormState = {
  // Step 1
  companyName: string;
  companyShortName: string;
  businessEmail: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  address: string;
  timezone: string;
  // Step 2
  fullName: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  // Step 3
  branchName: string;
  branchCode: string;
  branchEmail: string;
  branchPhone: string;
  branchCountry: string;
  branchState: string;
  branchCity: string;
  branchAddress: string;
  taxId: string;
  // Step 4
  workingDays: string[];
  startTime: string;
  endTime: string;
  hoursPerDay: string;
  // Step 5
  currency: string;
  taxRate: string;
  taxGst: string;
  // Step 6
  designations: Designation[];
  // Step 7
  whName: string;
  whCode: string;
  whManagerName: string;
  whManagerPhone: string;
  whManagerEmail: string;
  whCapacity: string;
  whCountry: string;
  whState: string;
  whCity: string;
  whPostal: string;
  whAddress: string;
  whDescription: string;
};

const initialState: FormState = {
  companyName: "",
  companyShortName: "",
  businessEmail: "",
  phone: "",
  country: "",
  state: "",
  city: "",
  address: "",
  timezone: "",
  fullName: "",
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  password: "",
  confirmPassword: "",
  branchName: "",
  branchCode: "",
  branchEmail: "",
  branchPhone: "",
  branchCountry: "",
  branchState: "",
  branchCity: "",
  branchAddress: "",
  taxId: "",
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  startTime: "09:00",
  endTime: "18:00",
  hoursPerDay: "8",
  currency: "",
  taxRate: "",
  taxGst: "",
  designations: [{ id: generateId(), name: "", department: "" }],
  whName: "",
  whCode: "",
  whManagerName: "",
  whManagerPhone: "",
  whManagerEmail: "",
  whCapacity: "",
  whCountry: "",
  whState: "",
  whCity: "",
  whPostal: "",
  whAddress: "",
  whDescription: "",
};

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

export default function SetupWizard() {
  const [current, setCurrent] = useState(1);
  const [data, setData] = useState<FormState>(initialState);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [done, setDone] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Simulated autosave indicator
  useEffect(() => {
    const t = setTimeout(() => setSavedAt(new Date()), 600);
    return () => clearTimeout(t);
  }, [data]);

  const percent = Math.round((completed.size / steps.length) * 100);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const next = () => {
    setCompleted((c) => new Set(c).add(current));
    if (current < steps.length) setCurrent((s) => s + 1);
    else setDone(true);
  };
  const back = () => current > 1 && setCurrent((s) => s - 1);

  const stepMeta = steps[current - 1];

  if (done) return <SuccessScreen />;

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-[400px_1fr]">
      {/* Sidebar */}
      <aside className="relative hidden lg:flex flex-col p-8 xl:p-10 border-r border-border/60 bg-sidebar overflow-hidden">
        <div className="absolute inset-0 opacity-60 pointer-events-none"
          style={{ background: "radial-gradient(600px 400px at 20% 10%, oklch(0.74 0.17 162 / 12%), transparent 60%)" }} />
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl grid place-items-center" style={{ background: "var(--gradient-primary)" }}>
              <Sparkles className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="font-semibold tracking-tight">Workspace Setup</div>
          </div>

          <div className="mt-10">
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

          <div className="mt-8">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Setup progress</span>
              <span className="font-medium text-foreground">{percent}%</span>
            </div>
            <Progress value={percent} className="h-1.5" />
          </div>

          <nav className="mt-8 space-y-1.5 flex-1 overflow-y-auto pr-1">
            {steps.map((s) => {
              const Icon = s.icon;
              const isDone = completed.has(s.id);
              const isCurrent = current === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setCurrent(s.id)}
                  className={cn(
                    "w-full text-left rounded-xl px-3 py-3 flex items-center gap-3 transition-all border",
                    isCurrent
                      ? "bg-primary/10 border-primary/30 shadow-[0_0_0_1px_var(--ring)]"
                      : "border-transparent hover:bg-sidebar-accent/60",
                  )}
                >
                  <div
                    className={cn(
                      "h-9 w-9 rounded-lg grid place-items-center shrink-0 transition-colors",
                      isDone
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                          ? "bg-primary/15 text-primary"
                          : "bg-sidebar-accent text-muted-foreground",
                    )}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
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

          <div className="mt-6 pt-6 border-t border-border/60 flex items-center gap-2 text-xs text-muted-foreground">
            <CloudUpload className="h-3.5 w-3.5 text-primary" />
            {savedAt ? `Auto-saved · ${savedAt.toLocaleTimeString()}` : "Saving…"}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="relative flex flex-col">
        <div className="flex-1 px-6 md:px-12 lg:px-16 py-10 lg:py-14 max-w-3xl w-full mx-auto">
          {/* Mobile progress */}
          <div className="lg:hidden mb-8">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Step {current} of {steps.length}</span>
              <span>{percent}%</span>
            </div>
            <Progress value={percent} className="h-1.5" />
          </div>

          <div className="mb-1.5 text-xs uppercase tracking-[0.18em] text-primary font-medium">
            Step {current} · {stepMeta.subtitle}
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            {stepMeta.title}
          </h1>
          <p className="mt-2 text-muted-foreground">{stepMeta.description}</p>

          <div
            key={current}
            className="mt-8 rounded-2xl border border-border/70 bg-card/80 backdrop-blur p-6 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ boxShadow: "var(--shadow-elegant)" }}
          >
            {current === 1 && <Step1 data={data} set={set} />}
            {current === 2 && <Step2 data={data} set={set} />}
            {current === 3 && <Step3 data={data} set={set} />}
            {current === 4 && <Step4 data={data} set={set} />}
            {current === 5 && <Step5 data={data} set={set} />}
            {current === 6 && <Step6 data={data} setData={setData} />}
            {current === 7 && <Step7 data={data} set={set} />}
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={back}
              disabled={current === 1}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-xs text-muted-foreground">
                {completed.size} of {steps.length} completed
              </span>
              <Button onClick={next} className="gap-1.5 shadow-lg shadow-primary/20">
                {current === steps.length ? "Complete Setup" : "Continue"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Field helpers ---------- */

function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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

/* ---------- Steps ---------- */

function Step1({ data, set }: { data: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <Grid>
      <Field label="Company Name">
        <Input className={inputCls} value={data.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Acme Corporation" />
      </Field>
      <Field label="Company Short Name">
        <Input className={inputCls} value={data.companyShortName} onChange={(e) => set("companyShortName", e.target.value)} placeholder="Acme" />
      </Field>
      <Field label="Business Email">
        <Input className={inputCls} type="email" value={data.businessEmail} onChange={(e) => set("businessEmail", e.target.value)} placeholder="hello@acme.com" />
      </Field>
      <Field label="Phone">
        <Input className={inputCls} value={data.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 010 0000" />
      </Field>
      <Field label="Country">
        <Input className={inputCls} value={data.country} onChange={(e) => set("country", e.target.value)} placeholder="United States" />
      </Field>
      <Field label="State / Province">
        <Input className={inputCls} value={data.state} onChange={(e) => set("state", e.target.value)} placeholder="California" />
      </Field>
      <Field label="City">
        <Input className={inputCls} value={data.city} onChange={(e) => set("city", e.target.value)} placeholder="San Francisco" />
      </Field>
      <Field label="Timezone">
        <Select value={data.timezone} onValueChange={(v) => set("timezone", v)}>
          <SelectTrigger className={inputCls}><SelectValue placeholder="Select timezone" /></SelectTrigger>
          <SelectContent>
            {["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"].map((tz) => (
              <SelectItem key={tz} value={tz}>{tz}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Address" className="md:col-span-2">
        <Textarea className="bg-background/40 border-border/70 min-h-[90px]" value={data.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, building, floor…" />
      </Field>
    </Grid>
  );
}

function Step2({ data, set }: { data: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <Grid>
      <Field label="Full Name" className="md:col-span-2">
        <Input className={inputCls} value={data.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Jane Doe" />
      </Field>
      <Field label="Username">
        <Input className={inputCls} value={data.username} onChange={(e) => set("username", e.target.value)} placeholder="janedoe" />
      </Field>
      <Field label="Email">
        <Input className={inputCls} type="email" value={data.email} onChange={(e) => set("email", e.target.value)} placeholder="jane@acme.com" />
      </Field>
      <Field label="First Name">
        <Input className={inputCls} value={data.firstName} onChange={(e) => set("firstName", e.target.value)} />
      </Field>
      <Field label="Last Name">
        <Input className={inputCls} value={data.lastName} onChange={(e) => set("lastName", e.target.value)} />
      </Field>
      <Field label="Phone Number" className="md:col-span-2">
        <Input className={inputCls} value={data.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} placeholder="+1 555 010 0000" />
      </Field>
      <Field label="Password" hint="Use 8+ characters with a mix of letters and numbers.">
        <Input className={inputCls} type="password" value={data.password} onChange={(e) => set("password", e.target.value)} />
      </Field>
      <Field label="Confirm Password">
        <Input className={inputCls} type="password" value={data.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} />
      </Field>
    </Grid>
  );
}

function Step3({ data, set }: { data: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <Grid>
      <Field label="Branch Name"><Input className={inputCls} value={data.branchName} onChange={(e) => set("branchName", e.target.value)} placeholder="Headquarters" /></Field>
      <Field label="Branch Code"><Input className={inputCls} value={data.branchCode} onChange={(e) => set("branchCode", e.target.value)} placeholder="HQ-001" /></Field>
      <Field label="Email"><Input className={inputCls} type="email" value={data.branchEmail} onChange={(e) => set("branchEmail", e.target.value)} /></Field>
      <Field label="Phone"><Input className={inputCls} value={data.branchPhone} onChange={(e) => set("branchPhone", e.target.value)} /></Field>
      <Field label="Country"><Input className={inputCls} value={data.branchCountry} onChange={(e) => set("branchCountry", e.target.value)} /></Field>
      <Field label="State"><Input className={inputCls} value={data.branchState} onChange={(e) => set("branchState", e.target.value)} /></Field>
      <Field label="City"><Input className={inputCls} value={data.branchCity} onChange={(e) => set("branchCity", e.target.value)} /></Field>
      <Field label="Tax ID"><Input className={inputCls} value={data.taxId} onChange={(e) => set("taxId", e.target.value)} /></Field>
      <Field label="Address" className="md:col-span-2">
        <Textarea className="bg-background/40 border-border/70 min-h-[90px]" value={data.branchAddress} onChange={(e) => set("branchAddress", e.target.value)} />
      </Field>
    </Grid>
  );
}

function Step4({ data, set }: { data: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  const toggleDay = (d: string) => {
    const has = data.workingDays.includes(d);
    set("workingDays", has ? data.workingDays.filter((x) => x !== d) : [...data.workingDays, d]);
  };
  return (
    <div className="space-y-6">
      <Field label="Working Days">
        <div className="flex flex-wrap gap-2 pt-1">
          {DAYS.map((d) => {
            const active = data.workingDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={cn(
                  "h-11 min-w-[64px] rounded-xl px-4 text-sm font-medium border transition-all",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                    : "bg-background/40 border-border/70 text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      </Field>
      <Grid>
        <Field label="Start Time"><Input className={inputCls} type="time" value={data.startTime} onChange={(e) => set("startTime", e.target.value)} /></Field>
        <Field label="End Time"><Input className={inputCls} type="time" value={data.endTime} onChange={(e) => set("endTime", e.target.value)} /></Field>
        <Field label="Working Hours Per Day" className="md:col-span-2">
          <Input className={inputCls} type="number" min={0} max={24} value={data.hoursPerDay} onChange={(e) => set("hoursPerDay", e.target.value)} />
        </Field>
      </Grid>
    </div>
  );
}

function Step5({ data, set }: { data: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <Grid>
      <Field label="Currency">
        <Select value={data.currency} onValueChange={(v) => set("currency", v)}>
          <SelectTrigger className={inputCls}><SelectValue placeholder="Select currency" /></SelectTrigger>
          <SelectContent>
            {["USD", "EUR", "GBP", "INR", "AED", "SGD", "JPY", "AUD", "CAD"].map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Tax Rate (%)">
        <Input className={inputCls} type="number" value={data.taxRate} onChange={(e) => set("taxRate", e.target.value)} placeholder="e.g. 18" />
      </Field>
      <Field label="Tax ID / GST Number" className="md:col-span-2">
        <Input className={inputCls} value={data.taxGst} onChange={(e) => set("taxGst", e.target.value)} placeholder="GSTIN / VAT / EIN" />
      </Field>
    </Grid>
  );
}

function Step6({ data, setData }: { data: FormState; setData: React.Dispatch<React.SetStateAction<FormState>> }) {
  const update = (id: string, patch: Partial<Designation>) =>
    setData((d) => ({ ...d, designations: d.designations.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const add = () =>
    setData((d) => ({ ...d, designations: [...d.designations, { id: generateId(), name: "", department: "" }] }));
  const remove = (id: string) =>
    setData((d) => ({ ...d, designations: d.designations.filter((x) => x.id !== id) }));

  return (
    <div className="space-y-4">
      {data.designations.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/70 p-10 text-center">
          <Users className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No designations yet. Add your first role.</p>
        </div>
      )}
      {data.designations.map((d, idx) => (
        <div key={d.id} className="rounded-xl border border-border/70 bg-background/30 p-4 md:p-5 grid md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <Field label={`Designation Name ${idx + 1}`}>
            <Input className={inputCls} value={d.name} onChange={(e) => update(d.id, { name: e.target.value })} placeholder="e.g. Sales Manager" />
          </Field>
          <Field label="Department">
            <Input className={inputCls} value={d.department} onChange={(e) => update(d.id, { department: e.target.value })} placeholder="e.g. Sales" />
          </Field>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(d.id)}
            className="h-11 w-11 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={add} className="w-full h-11 border-dashed gap-2 hover:bg-primary/5 hover:border-primary/40 hover:text-primary">
        <Plus className="h-4 w-4" /> Add Designation
      </Button>
    </div>
  );
}

function Step7({ data, set }: { data: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <Grid>
      <Field label="Warehouse Name"><Input className={inputCls} value={data.whName} onChange={(e) => set("whName", e.target.value)} /></Field>
      <Field label="Warehouse Code"><Input className={inputCls} value={data.whCode} onChange={(e) => set("whCode", e.target.value)} /></Field>
      <Field label="Manager Name"><Input className={inputCls} value={data.whManagerName} onChange={(e) => set("whManagerName", e.target.value)} /></Field>
      <Field label="Manager Phone"><Input className={inputCls} value={data.whManagerPhone} onChange={(e) => set("whManagerPhone", e.target.value)} /></Field>
      <Field label="Manager Email"><Input className={inputCls} type="email" value={data.whManagerEmail} onChange={(e) => set("whManagerEmail", e.target.value)} /></Field>
      <Field label="Capacity"><Input className={inputCls} value={data.whCapacity} onChange={(e) => set("whCapacity", e.target.value)} placeholder="e.g. 10,000 units" /></Field>
      <Field label="Country"><Input className={inputCls} value={data.whCountry} onChange={(e) => set("whCountry", e.target.value)} /></Field>
      <Field label="State"><Input className={inputCls} value={data.whState} onChange={(e) => set("whState", e.target.value)} /></Field>
      <Field label="City"><Input className={inputCls} value={data.whCity} onChange={(e) => set("whCity", e.target.value)} /></Field>
      <Field label="Postal Code"><Input className={inputCls} value={data.whPostal} onChange={(e) => set("whPostal", e.target.value)} /></Field>
      <Field label="Address" className="md:col-span-2">
        <Textarea className="bg-background/40 border-border/70 min-h-[80px]" value={data.whAddress} onChange={(e) => set("whAddress", e.target.value)} />
      </Field>
      <Field label="Description" className="md:col-span-2">
        <Textarea className="bg-background/40 border-border/70 min-h-[80px]" value={data.whDescription} onChange={(e) => set("whDescription", e.target.value)} placeholder="Brief notes about this warehouse" />
      </Field>
    </Grid>
  );
}

function SuccessScreen() {
  return (
    <div className="min-h-screen grid place-items-center px-6 py-16">
      <div className="max-w-xl w-full text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="relative mx-auto h-28 w-28">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-60"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div
            className="relative h-28 w-28 rounded-full grid place-items-center"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            <PartyPopper className="h-12 w-12 text-primary-foreground" strokeWidth={2} />
          </div>
        </div>
        <h1 className="mt-10 text-4xl font-semibold tracking-tight">Your Workspace Is Ready</h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Your company has been successfully configured. You can now start managing operations,
          customers, inventory, finance, and your team.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button className="h-11 px-6 gap-2 shadow-lg shadow-primary/20">
            Enter Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-11 px-6">
            Take Product Tour
          </Button>
        </div>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
          {[
            { label: "Company", icon: Building2 },
            { label: "Branch", icon: MapPin },
            { label: "Team", icon: Users },
            { label: "Warehouse", icon: Warehouse },
          ].map(({ label, icon: I }) => (
            <div key={label} className="rounded-xl border border-border/70 bg-card/60 p-4 flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg grid place-items-center bg-primary/10 text-primary">
                <I className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium">{label}</div>
              <Check className="ml-auto h-4 w-4 text-primary" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
