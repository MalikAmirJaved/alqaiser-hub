"use client";
import { useState, useEffect } from "react";
import { useCompanySettings, type CompanySettings } from "@/hooks/useCompanySettings";
import PageHeader from "@/components/PageHeader";
import {
  Building2, Globe, CalendarDays,
  CheckCircle, Mail, Percent,
  Phone, MapPin, Hash, AlertCircle,
  Pencil, X, Clock, DollarSign, Timer
} from "lucide-react";
import { LocationGroup } from "@/components/reuseable/LocationSelectors";
import CurrencySelect from "@/components/reuseable/CurrencySelect";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

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
  companyName: string;
  companyShortName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  currency: string;
  taxRate: string;
  taxId: string;
  timezone: string;
  defaultStartTime: string;
  defaultEndTime: string;
  workingHoursPerDay: string;
}

type ModalSection = "company" | "financial" | "schedule" | null;

// ── tiny helper ──────────────────────────────────────────────
function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      {icon && (
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </span>
      )}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">{label}</span>
        <span className="text-sm text-foreground font-medium break-words">
          {value || <span className="text-muted-foreground/50 italic font-normal">Not set</span>}
        </span>
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
  onEdit,
  canEdit,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  onEdit?: () => void;
  canEdit?: boolean;
}) {
  return (
    <div className="group bg-card border border-border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md hover:border-border-strong">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-muted/70 to-muted/30">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            {icon}
          </span>
          <div className="flex flex-col">
            <h3 className="font-semibold text-base text-card-foreground leading-tight">{title}</h3>
            {description && <span className="text-xs text-muted-foreground">{description}</span>}
          </div>
        </div>
        {canEdit && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-border bg-background text-foreground shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────
function Modal({
  title,
  icon,
  open,
  onClose,
  onSave,
  saving,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop — 150ms fade */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />
      {/* panel — slide + fade */}
      <div className="relative z-10 w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 via-muted/60 to-muted/30 flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              {icon}
            </span>
            <h2 className="font-semibold text-base text-card-foreground">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
        {/* body — overflow visible so LocationGroup dropdown isn't clipped by the panel */}
        <div className="p-6 space-y-5 overflow-visible flex-1">{children}</div>
        {/* footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40 flex-shrink-0 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 h-10 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:bg-accent hover:border-border-strong transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-6 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-60"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/50 hover:border-border-strong";

const selectCls = inputCls;

// ═══════════════════════════════════════════════════════════════
export default function CompanyProfile() {
  const permissions = useFeaturePermissions("SETTINGS", "company");
  const { settings, isReady, updateSettings, updateWorkingDays, isUpdating } = useCompanySettings();

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeModal, setActiveModal] = useState<ModalSection>(null);

  const [formData, setFormData] = useState<FormData>({
    companyName: "",
    companyShortName: "",
    address: "",
    city: "",
    state: "",
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

  // local draft for the modal — committed on save
  const [draft, setDraft] = useState<FormData>(formData);

  const [workingDays, setWorkingDays] = useState<WorkingDayDisplay[]>([
    { id: 1, day: 0, label: "Monday", isWorking: true },
    { id: 2, day: 1, label: "Tuesday", isWorking: true },
    { id: 3, day: 2, label: "Wednesday", isWorking: true },
    { id: 4, day: 3, label: "Thursday", isWorking: true },
    { id: 5, day: 4, label: "Friday", isWorking: true },
    { id: 6, day: 5, label: "Saturday", isWorking: false },
    { id: 7, day: 6, label: "Sunday", isWorking: false },
  ]);
  const [draftDays, setDraftDays] = useState<WorkingDayDisplay[]>(workingDays);

  useEffect(() => {
    if (isReady && settings) {
      const loaded: FormData = {
        companyName: settings.companyName || "",
        companyShortName: settings.companyShortName || "",
        address: settings.address || "",
        city: settings.city || "",
        state: settings.state || "",
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
      };
      setFormData(loaded);
      setDraft(loaded);

      if (settings.workingDays && Array.isArray(settings.workingDays)) {
        const wd = settings.workingDays.map((d) => ({
          id: d.id,
          day: d.day,
          label: d.label,
          isWorking: d.isWorking,
          startTime: d.startTime,
          endTime: d.endTime,
          isHalfDay: d.isHalfDay,
        }));
        setWorkingDays(wd);
        setDraftDays(wd);
      }
    }
  }, [isReady, settings]);

  const openModal = (section: ModalSection) => {
    setDraft({ ...formData });
    setDraftDays([...workingDays.map((d) => ({ ...d }))]);
    setActiveModal(section);
  };

  const closeModal = () => setActiveModal(null);

  const setDraftField = (field: keyof FormData, value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const toggleDraftDay = (dayIndex: number) =>
    setDraftDays((prev) =>
      prev.map((d) => (d.day === dayIndex ? { ...d, isWorking: !d.isWorking } : d))
    );

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg("");
    try {
      if (activeModal === "company" || activeModal === "financial") {
        await updateSettings({ ...draft, taxRate: parseFloat(draft.taxRate) || 0 });
        setFormData({ ...draft });
      }
      if (activeModal === "schedule") {
        await updateSettings({ ...draft, taxRate: parseFloat(draft.taxRate) || 0 });
        const wdForApi = draftDays.map((wd) => ({
          id: wd.id,
          day: wd.day,
          label: wd.label,
          isWorking: wd.isWorking,
          startTime: wd.startTime || null,
          endTime: wd.endTime || null,
          isHalfDay: wd.isHalfDay || false,
        }));
        await updateWorkingDays(wdForApi);
        setFormData({ ...draft });
        setWorkingDays([...draftDays]);
      }
      setSuccessMsg("Saved successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
      closeModal();
    } catch {
      setErrorMsg("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const currencyLabel: Record<string, string> = {
    USD: "USD ($)", PKR: "PKR (₨)", AED: "AED (د.إ)",
    GBP: "GBP (£)", EUR: "EUR (€)", INR: "INR (₹)", SAR: "SAR (﷼)",
  };

  const timezoneLabel: Record<string, string> = {
    UTC: "UTC",
    "America/New_York": "Eastern Time (US)",
    "America/Chicago": "Central Time (US)",
    "America/Denver": "Mountain Time (US)",
    "America/Los_Angeles": "Pacific Time (US)",
    "Europe/London": "London (GMT)",
    "Asia/Dubai": "Dubai (GST)",
    "Asia/Karachi": "Karachi (PKT)",
    "Asia/Kolkata": "Mumbai (IST)",
  };

  const activeDays = workingDays.filter((d) => d.isWorking).map((d) => d.label.slice(0, 3)).join(", ");

  // Derive initials avatar
  const companyInitials = (formData.companyName || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading company profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Company Profile"
        subtitle="View and manage your organization's details"
        actions={null}
      />

      {/* ── Hero Banner ───────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-primary/8 via-primary/3 to-transparent px-6 py-5 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Avatar */}
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary text-2xl font-bold ring-2 ring-primary/20 shadow-sm">
              {companyInitials}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                  {formData.companyName || "No Company Name"}
                </h2>
                {formData.companyShortName && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                    {formData.companyShortName}
                  </span>
                )}
              </div>
              {([formData.city, formData.state, formData.country].filter(Boolean).join(", ") || formData.email) && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {[formData.city, formData.state, formData.country].filter(Boolean).join(", ") || formData.email}
                </p>
              )}
            </div>
            {/* Quick Stat Chips */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-border text-xs font-medium text-foreground shadow-sm">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                {currencyLabel[formData.currency] || formData.currency}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-border text-xs font-medium text-foreground shadow-sm">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                {timezoneLabel[formData.timezone] || formData.timezone}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border border-border text-xs font-medium text-foreground shadow-sm">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                {workingDays.filter((d) => d.isWorking).length} / 7 days
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toasts — animated */}
      {successMsg && (
        <div className="bg-success/10 border border-success/20 text-success-foreground px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive-foreground px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="space-y-5">
        {/* ── Company Details card ───────────────────────────── */}
        <SectionCard
          icon={<Building2 className="w-5 h-5" />}
          title="Company Details"
          description="General information about your organization"
          canEdit={permissions.update}
          onEdit={() => openModal("company")}
        >
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            <InfoRow icon={<Building2 className="w-4 h-4" />} label="Company Name" value={formData.companyName} />
            <InfoRow icon={<Hash className="w-4 h-4" />} label="Short Name" value={formData.companyShortName} />
            <InfoRow icon={<Hash className="w-4 h-4" />} label="Tax ID / VAT" value={formData.taxId} />
            <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={formData.email} />
            <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={formData.phone} />
            <InfoRow
              icon={<MapPin className="w-4 h-4" />}
              label="Location"
              value={[formData.city, formData.state, formData.country].filter(Boolean).join(", ") || undefined}
            />
            {formData.address && (
              <div className="sm:col-span-2">
                <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={formData.address} />
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Financial & Localization card ─────────────────── */}
        <SectionCard
          icon={<DollarSign className="w-5 h-5" />}
          title="Financial & Localization"
          description="Currency, tax, and timezone preferences"
          canEdit={permissions.update}
          onEdit={() => openModal("financial")}
        >
          <div className="grid sm:grid-cols-3 gap-x-8 gap-y-5">
            <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Currency" value={currencyLabel[formData.currency] || formData.currency} />
            <InfoRow icon={<Percent className="w-4 h-4" />} label="Tax Rate" value={`${formData.taxRate}%`} />
            <InfoRow icon={<Clock className="w-4 h-4" />} label="Timezone" value={timezoneLabel[formData.timezone] || formData.timezone} />
          </div>
        </SectionCard>

        {/* ── Schedule card ─────────────────────────────────── */}
        <SectionCard
          icon={<CalendarDays className="w-5 h-5" />}
          title="Working Schedule"
          description="Working days, hours, and shifts"
          canEdit={permissions.update}
          onEdit={() => openModal("schedule")}
        >
          <div className="space-y-5">
            {/* day pills */}
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block">Working Days</span>
              <div className="flex flex-wrap gap-2">
                {workingDays.map((day) => (
                  <span
                    key={day.day}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      day.isWorking
                        ? "bg-primary/10 text-primary border-primary/30 shadow-sm shadow-primary/10"
                        : "bg-muted text-muted-foreground/50 border-border line-through"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${day.isWorking ? "bg-primary" : "bg-muted-foreground/30"}`} />
                    {day.label.slice(0, 3)}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-x-8 gap-y-5">
              <InfoRow icon={<Clock className="w-4 h-4" />} label="Start Time" value={formData.defaultStartTime} />
              <InfoRow icon={<Timer className="w-4 h-4" />} label="End Time" value={formData.defaultEndTime} />
              <InfoRow icon={<Timer className="w-4 h-4" />} label="Hours / Day" value={`${formData.workingHoursPerDay} hrs`} />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ═══════════════ MODALS ═══════════════ */}

      {/* Company Details Modal */}
      <Modal
        title="Edit Company Details"
        icon={<Building2 className="w-4 h-4" />}
        open={activeModal === "company"}
        onClose={closeModal}
        onSave={handleSave}
        saving={saving || isUpdating}
      >
        {/* Section: General */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">General Information</span>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Company Name *">
              <input className={inputCls} value={draft.companyName} onChange={(e) => setDraftField("companyName", e.target.value)} placeholder="Acme Corporation" />
            </Field>
            <Field label="Short Name">
              <input className={inputCls} value={draft.companyShortName} onChange={(e) => setDraftField("companyShortName", e.target.value)} placeholder="ACME" />
            </Field>
          </div>
        </div>
        {/* Section: Contact */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Contact & Identification</span>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Tax ID / VAT">
              <input className={inputCls} value={draft.taxId} onChange={(e) => setDraftField("taxId", e.target.value)} placeholder="GST123456789" />
            </Field>
            <Field label="Email">
              <input type="email" className={inputCls} value={draft.email} onChange={(e) => setDraftField("email", e.target.value)} placeholder="company@example.com" />
            </Field>
          </div>
          <Field label="Phone">
            <input type="tel" className={inputCls} value={draft.phone} onChange={(e) => setDraftField("phone", e.target.value)} placeholder="+1 234 567 890" />
          </Field>
        </div>
        {/* Section: Address */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Address & Location</span>
          <Field label="Address">
            <textarea className={`${inputCls} h-auto min-h-[72px] py-2 resize-y`} value={draft.address} onChange={(e) => setDraftField("address", e.target.value)} placeholder="Street address…" />
          </Field>
          <div className="relative" style={{ zIndex: 9999 }}>
            <LocationGroup
              country={draft.country} setCountry={(val) => setDraftField("country", val)}
              state={draft.state} setState={(val) => setDraftField("state", val)}
              city={draft.city} setCity={(val) => setDraftField("city", val)}
              required={false} countryLabel="Country" stateLabel="State / Region" cityLabel="City" cssCol="3"
            />
          </div>
        </div>
      </Modal>

      {/* Financial Modal */}
      <Modal
        title="Edit Financial & Localization"
        icon={<DollarSign className="w-4 h-4" />}
        open={activeModal === "financial"}
        onClose={closeModal}
        onSave={handleSave}
        saving={saving || isUpdating}
      >
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Currency & Tax</span>
          <Field label="Primary Currency">
            <CurrencySelect
              value={draft.currency}
              onChange={(val) => setDraftField("currency", val)}
              required
            />
          </Field>
          <Field label="Default Tax Rate (%)">
            <input type="number" step="0.01" min="0" max="100" className={inputCls} value={draft.taxRate} onChange={(e) => setDraftField("taxRate", e.target.value)} />
          </Field>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Timezone</span>
          <Field label="Timezone">
            <SearchableSelect
              value={draft.timezone}
              onChange={(val) => setDraftField("timezone", val)}
              options={[
                { value: "UTC", label: "UTC" },
                { value: "America/New_York", label: "Eastern Time (US)" },
                { value: "America/Chicago", label: "Central Time (US)" },
                { value: "America/Denver", label: "Mountain Time (US)" },
                { value: "America/Los_Angeles", label: "Pacific Time (US)" },
                { value: "Europe/London", label: "London (GMT)" },
                { value: "Asia/Dubai", label: "Dubai (GST)" },
                { value: "Asia/Karachi", label: "Karachi (PKT)" },
                { value: "Asia/Kolkata", label: "Mumbai (IST)" },
              ]}
              placeholder="Select timezone"
            />
          </Field>
        </div>
      </Modal>

      {/* Schedule Modal */}
      <Modal
        title="Edit Working Schedule"
        icon={<CalendarDays className="w-4 h-4" />}
        open={activeModal === "schedule"}
        onClose={closeModal}
        onSave={handleSave}
        saving={saving || isUpdating}
      >
        {/* Section: Working Days */}
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">Working Days</span>
          <div className="flex flex-wrap gap-2">
            {draftDays.map((day) => {
              const dayLabel = day.label.slice(0, 3);
              return (
                <button
                  key={day.day}
                  type="button"
                  onClick={() => toggleDraftDay(day.day)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    day.isWorking
                      ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                      : "bg-background text-muted-foreground border-border hover:bg-accent hover:border-border-strong"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${day.isWorking ? "bg-primary-foreground" : "bg-muted-foreground/30"}`} />
                  {dayLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section: Hours */}
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">Working Hours</span>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Start Time">
              <input
                type="time"
                className={inputCls}
                value={draft.defaultStartTime}
                onChange={(e) => setDraftField("defaultStartTime", e.target.value)}
              />
            </Field>
            <Field label="End Time">
              <input
                type="time"
                className={inputCls}
                value={draft.defaultEndTime}
                onChange={(e) => setDraftField("defaultEndTime", e.target.value)}
              />
            </Field>
            <Field label="Hours / Day">
              <input
                type="number"
                step="0.5"
                min="1"
                max="24"
                className={inputCls}
                value={draft.workingHoursPerDay}
                onChange={(e) => setDraftField("workingHoursPerDay", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}