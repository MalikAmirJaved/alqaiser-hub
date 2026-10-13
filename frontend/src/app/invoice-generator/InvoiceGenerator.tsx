"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Bold,
  Check,
  Download,
  Eye,
  Italic,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AdSlot } from "./AdSlot";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { InvoicePreview, PAGE_WIDTH } from "./InvoicePreview";
import { TEMPLATES, TEMPLATE_COUNT, templateLabel } from "./templates";
import { getLocale } from "./locales";
import { trackEvent } from "./analytics";
import { safeFileName } from "./pdf";
import { cn } from "@/lib/utils";
import {
  CURRENCIES,
  clearDraft,
  computeTotals,
  createDefaultInvoice,
  createDefaultTypography,
  FONT_FAMILY_OPTIONS,
  HEADING_LEVELS,
  formatMoney,
  loadDraft,
  normalizeTypography,
  saveDraft,
  uid,
  validateInvoice,
  type InvoiceData,
  type InvoiceFontFamily,
  type InvoiceHeadingLevel,
  type InvoiceTypography,
  type Party,
} from "./invoice";

const MAX_IMAGE_BYTES = 1_500_000;

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return (
    <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-destructive">
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export function InvoiceGenerator({
  localeSlug = null,
  heading = "Invoice generator",
  lead = "Everything calculates live and autosaves to this browser. When it looks right, download the PDF — the export always matches the template shown in the preview.",
  titleAs = "h1",
  crumbs = [
    { label: "Home", href: "/" },
    { label: "Invoice generator" },
  ],
  showBreadcrumbs = true,
}: {
  localeSlug?: string | null;
  heading?: string;
  lead?: string;
  titleAs?: "h1" | "h2";
  crumbs?: Crumb[];
  /** Hide breadcrumbs when the parent page already shows them. */
  showBreadcrumbs?: boolean;
} = {}) {
  const locale = getLocale(localeSlug);
  const searchParams = useSearchParams();
  const [data, setData] = useState<InvoiceData>(() => createDefaultInvoice(localeSlug));
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.72);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const documentRef = useRef<HTMLDivElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);

  /* restore autosaved draft + optional ?template= slug (once on mount) */
  useEffect(() => {
    const draft = loadDraft(localeSlug);
    const templateParam = searchParams.get("template");
    const knownTemplate =
      templateParam && TEMPLATES.some((t) => t.slug === templateParam)
        ? templateParam
        : null;

    if (draft) {
      setData(
        knownTemplate
          ? {
              ...draft,
              templateSlug: knownTemplate,
              accentColor:
                draft.accentColor ??
                TEMPLATES.find((t) => t.slug === knownTemplate)?.accent ??
                null,
            }
          : draft,
      );
      toast.success("Draft restored", { description: "We picked up where you left off." });
    } else if (knownTemplate) {
      const accent =
        TEMPLATES.find((t) => t.slug === knownTemplate)?.accent ?? null;
      setData((prev) => ({
        ...prev,
        templateSlug: knownTemplate,
        accentColor: accent,
      }));
    }
    setHydrated(true);
    // Intentionally run once on mount so draft toast doesn't repeat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Scale the A4 preview to fill the available column width */
  useEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;

    const update = () => {
      const available = el.clientWidth;
      if (available <= 0) return;
      setPreviewScale(Math.min(1, available / PAGE_WIDTH));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hydrated]);

  /* autosave (debounced) */
  useEffect(() => {
    if (!hydrated) return;
    const id = window.setTimeout(() => {
      if (saveDraft(data)) setSavedAt(new Date());
    }, 600);
    return () => window.clearTimeout(id);
  }, [data, hydrated]);

  /* live validation once the user has tried to export */
  useEffect(() => {
    if (showErrors) setErrors(validateInvoice(data));
  }, [data, showErrors]);

  const totals = useMemo(() => computeTotals(data), [data]);
  const money = (n: number) => formatMoney(n, data.currency);
  const activeTemplate =
    TEMPLATES.find((t) => t.slug === data.templateSlug) ?? TEMPLATES[0]!;
  const activeTemplateName = templateLabel(activeTemplate);
  const templateAccent = activeTemplate.accent;
  const activeAccent = data.accentColor?.trim() || templateAccent;
  const typography = normalizeTypography(data.typography);

  const patch = useCallback((partial: Partial<InvoiceData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const patchTypography = useCallback((partial: Partial<InvoiceTypography>) => {
    setData((prev) => ({
      ...prev,
      typography: normalizeTypography({
        ...prev.typography,
        ...partial,
        enabled: partial.enabled ?? true,
      }),
    }));
  }, []);

  const patchParty = (which: "from" | "to", field: keyof Party, value: string) =>
    setData((prev) => ({ ...prev, [which]: { ...prev[which], [field]: value } }));

  const patchItem = (id: string, field: "description" | "quantity" | "rate", value: string) =>
    setData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id
          ? { ...item, [field]: field === "description" ? value : Number(value) || 0 }
          : item,
      ),
    }));

  const addItem = () =>
    setData((prev) => ({
      ...prev,
      items: [...prev.items, { id: uid(), description: "", quantity: 1, rate: 0 }],
    }));

  const removeItem = (id: string) =>
    setData((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((i) => i.id !== id) : prev.items,
    }));

  const uploadImage = async (
    kind: "logo" | "signature" | "watermarkImage",
    file?: File | null,
  ) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That file isn't an image", { description: "Use a PNG, JPG or SVG file." });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image is too large", { description: "Please use a file under 1.5 MB." });
      return;
    }
    try {
      patch({ [kind]: await readImage(file) } as Partial<InvoiceData>);
      toast.success(
        kind === "logo"
          ? "Logo added"
          : kind === "signature"
            ? "Signature added"
            : "Watermark image added",
      );
    } catch {
      toast.error("Could not read that image. Try another file.");
    }
  };

  const resetAll = () => {
    clearDraft(localeSlug);
    setData(createDefaultInvoice(localeSlug));
    setErrors({});
    setShowErrors(false);
    toast.success("Invoice reset", { description: "Your saved draft was cleared." });
  };

  const download = async () => {
    setShowErrors(true);
    const found = validateInvoice(data);
    setErrors(found);
    const count = Object.keys(found).length;
    if (count > 0) {
      setMobileTab("edit");
      toast.error(`${count} field${count > 1 ? "s" : ""} need attention`);
      document.querySelector("[data-invalid='true']")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }
    const node =
      document.getElementById("invoice-document") ?? documentRef.current;
    if (!node) {
      toast.error("PDF export failed", { description: "Preview is not ready yet. Try again." });
      return;
    }
    setExporting(true);
    try {
      const { exportInvoicePdf } = await import("./pdf");
      await exportInvoicePdf(node, safeFileName(data.invoiceNumber, data.to.name));
      trackEvent("invoice_pdf_download", { template: data.templateSlug, currency: data.currency });
      toast.success("PDF downloaded", { description: "Check your downloads folder." });
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Please try again in a moment.";
      toast.error("PDF export failed", { description: message });
    } finally {
      setExporting(false);
    }
  };

  const invalid = (key: string) => showErrors && Boolean(errors[key]);

  const partyFields = (which: "from" | "to", heading: string) => (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {heading}
      </h2>
      <div className="mt-4 grid gap-4">
        <div data-invalid={invalid(`${which}.name`)}>
          <Label htmlFor={`${which}-name`}>Name *</Label>
          <Input
            id={`${which}-name`}
            value={data[which].name}
            maxLength={120}
            aria-invalid={invalid(`${which}.name`)}
            onChange={(e) => patchParty(which, "name", e.target.value)}
          />
          {showErrors && <FieldError message={errors[`${which}.name`]} />}
        </div>
        <div data-invalid={invalid(`${which}.email`)}>
          <Label htmlFor={`${which}-email`}>Email</Label>
          <Input
            id={`${which}-email`}
            type="email"
            value={data[which].email}
            maxLength={255}
            aria-invalid={invalid(`${which}.email`)}
            onChange={(e) => patchParty(which, "email", e.target.value)}
          />
          {showErrors && <FieldError message={errors[`${which}.email`]} />}
        </div>
        <div>
          <Label htmlFor={`${which}-address`}>Address</Label>
          <Textarea
            id={`${which}-address`}
            rows={3}
            maxLength={400}
            value={data[which].address}
            onChange={(e) => patchParty(which, "address", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${which}-phone`}>Phone</Label>
            <Input
              id={`${which}-phone`}
              value={data[which].phone}
              maxLength={40}
              onChange={(e) => patchParty(which, "phone", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`${which}-tax`}>{locale?.taxIdLabel ?? "Tax / VAT ID"}</Label>
            <Input
              id={`${which}-tax`}
              value={data[which].taxId}
              maxLength={60}
              placeholder={locale?.taxIdPlaceholder}
              onChange={(e) => patchParty(which, "taxId", e.target.value)}
            />
          </div>
          {locale?.taxIdSecondaryLabel ? (
            <div className="sm:col-span-2">
              <Label htmlFor={`${which}-tax-2`}>{locale.taxIdSecondaryLabel}</Label>
              <Input
                id={`${which}-tax-2`}
                value={data[which].taxIdSecondary}
                maxLength={60}
                placeholder={locale.taxIdSecondaryPlaceholder}
                onChange={(e) => patchParty(which, "taxIdSecondary", e.target.value)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[96rem] overflow-x-hidden px-3 py-6 pb-[calc(6.25rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-8 lg:py-12 lg:pb-12">
      {showBreadcrumbs ? <Breadcrumbs items={crumbs} /> : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          {titleAs === "h2" ? (
            <h2 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">{heading}</h2>
          ) : (
            <h1 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">{heading}</h1>
          )}
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {lead}
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {savedAt ? (
              <>
                <Check className="size-3.5 text-primary" aria-hidden="true" /> Draft saved{" "}
                {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </>
            ) : (
              "Autosave on"
            )}
          </span>
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="mr-1 size-3.5" aria-hidden="true" /> Reset
          </Button>
          <Button size="sm" onClick={download} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="mr-1 size-3.5" aria-hidden="true" />
            )}
            {exporting ? "Building PDF…" : "Download PDF"}
          </Button>
        </div>
      </div>

      {/* Mobile Edit / Preview switcher */}
      <div
        role="tablist"
        aria-label="Generator views"
        className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1 lg:hidden"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "edit"}
          onClick={() => setMobileTab("edit")}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors",
            mobileTab === "edit"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          <Pencil className="size-4" aria-hidden="true" /> Edit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "preview"}
          onClick={() => setMobileTab("preview")}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors",
            mobileTab === "preview"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          <Eye className="size-4" aria-hidden="true" /> Preview
        </button>
      </div>

      {showErrors && Object.keys(errors).length > 0 && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertCircle className="size-4" aria-hidden="true" /> Fix these before downloading
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-destructive">
            {Object.entries(errors).map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:mt-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* ------------------------------- Editor ------------------------------- */}
        <div
          className={cn(
            "grid min-w-0 gap-5 sm:gap-6",
            mobileTab !== "edit" && "hidden lg:grid",
          )}
        >
          {/* Template switcher */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Template
              </h2>
              <Link href="/invoice-templates" className="text-xs font-medium text-primary underline">
                Compare all {TEMPLATE_COUNT}
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {TEMPLATES.map((t) => {
                const active = t.slug === data.templateSlug;
                return (
                  <button
                    key={t.slug}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      patch({ templateSlug: t.slug, accentColor: t.accent });
                      trackEvent("template_selected", { template: t.slug });
                    }}
                    className={`rounded-lg border p-2 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-accent/10"
                    }`}
                  >
                    <span
                      className="block h-5 rounded sm:h-6"
                      style={{
                        background:
                          active && data.accentColor ? data.accentColor : t.accent,
                      }}
                      aria-hidden="true"
                    />
                    <span className="mt-1.5 block truncate text-[11px] font-semibold sm:text-xs">
                      {t.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                      {t.industry}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Template color</h3>
                  <p className="text-xs text-muted-foreground">
                    Change the accent used in headers, totals and highlights.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => patch({ accentColor: templateAccent })}
                >
                  Reset to default
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="group relative inline-flex cursor-pointer items-center gap-3">
                  <span className="sr-only">Open color picker</span>
                  <span
                    className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border shadow-sm ring-offset-background transition group-hover:ring-2 group-hover:ring-ring group-hover:ring-offset-2 sm:size-16"
                    style={{ background: activeAccent }}
                  >
                    <input
                      type="color"
                      value={activeAccent}
                      onChange={(e) => patch({ accentColor: e.target.value })}
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                      aria-label="Template color picker"
                    />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">Pick a color</span>
                    <span className="font-mono text-xs uppercase text-muted-foreground">
                      {activeAccent}
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Typography */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <Type className="size-3.5" aria-hidden="true" />
                  Typography
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional — change font, size, bold, italic and title level (H1 / H2 / H3).
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  disabled={!typography.enabled}
                  onClick={() => patch({ typography: createDefaultTypography() })}
                >
                  Reset
                </Button>
                <Switch
                  checked={typography.enabled}
                  onCheckedChange={(checked) =>
                    patchTypography({
                      ...typography,
                      enabled: checked,
                    })
                  }
                  aria-label="Enable custom typography"
                />
              </div>
            </div>

            {typography.enabled && (
              <div className="mt-5 grid gap-5">
                <div>
                  <Label htmlFor="font-family">Font style</Label>
                  <select
                    id="font-family"
                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={typography.fontFamily}
                    onChange={(e) =>
                      patchTypography({ fontFamily: e.target.value as InvoiceFontFamily })
                    }
                  >
                    {FONT_FAMILY_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="base-size">
                    Body size ({typography.baseSize}px)
                  </Label>
                  <input
                    id="base-size"
                    type="range"
                    min={11}
                    max={18}
                    step={1}
                    value={typography.baseSize}
                    onChange={(e) =>
                      patchTypography({ baseSize: Number(e.target.value) || 13 })
                    }
                    className="mt-3 w-full accent-primary"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>Small</span>
                    <span>Large</span>
                  </div>
                </div>

                <div>
                  <Label>Title size (Invoice heading)</Label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {HEADING_LEVELS.map((level) => {
                      const active = typography.titleLevel === level.id;
                      return (
                        <button
                          key={level.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            patchTypography({ titleLevel: level.id as InvoiceHeadingLevel })
                          }
                          className={cn(
                            "rounded-lg border px-2 py-2.5 text-left transition-colors",
                            active
                              ? "border-primary bg-primary/10"
                              : "border-border hover:bg-accent/10",
                          )}
                        >
                          <span
                            className="block font-bold leading-none text-foreground"
                            style={{
                              fontSize: level.id === "h1" ? 20 : level.id === "h2" ? 16 : 13,
                            }}
                          >
                            {level.id.toUpperCase()}
                          </span>
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {level.label.replace(/^H\d — /, "")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Bold className="size-3.5" aria-hidden="true" /> Bold titles
                    </span>
                    <Switch
                      checked={typography.boldTitles}
                      onCheckedChange={(checked) => patchTypography({ boldTitles: checked })}
                      aria-label="Bold titles"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Bold className="size-3.5" aria-hidden="true" /> Bold body
                    </span>
                    <Switch
                      checked={typography.boldBody}
                      onCheckedChange={(checked) => patchTypography({ boldBody: checked })}
                      aria-label="Bold body text"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Italic className="size-3.5" aria-hidden="true" /> Italic body
                    </span>
                    <Switch
                      checked={typography.italicBody}
                      onCheckedChange={(checked) => patchTypography({ italicBody: checked })}
                      aria-label="Italic body text"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Italic className="size-3.5" aria-hidden="true" /> Italic notes
                    </span>
                    <Switch
                      checked={typography.italicNotes}
                      onCheckedChange={(checked) => patchTypography({ italicNotes: checked })}
                      aria-label="Italic notes and terms"
                    />
                  </label>
                </div>

                <p
                  className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground"
                  style={{
                    fontFamily:
                      FONT_FAMILY_OPTIONS.find((f) => f.id === typography.fontFamily)?.stack ||
                      "inherit",
                    fontSize: typography.baseSize,
                    fontWeight: typography.boldBody ? 700 : 400,
                    fontStyle: typography.italicBody ? "italic" : "normal",
                  }}
                >
                  <span
                    className="block text-foreground"
                    style={{
                      fontSize:
                        HEADING_LEVELS.find((h) => h.id === typography.titleLevel)?.size ?? 28,
                      fontWeight: typography.boldTitles ? 800 : 500,
                      fontStyle: "normal",
                      lineHeight: 1.1,
                    }}
                  >
                    Invoice
                  </span>
                  Preview sample — your PDF will use these settings.
                </p>
              </div>
            )}
          </div>

          {/* Branding */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Branding
            </h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {(["logo", "signature"] as const).map((kind) => (
                <div key={kind}>
                  <Label htmlFor={`${kind}-upload`} className="capitalize">
                    {kind}
                  </Label>
                  <div className="mt-2 flex items-center gap-3">
                    <label
                      htmlFor={`${kind}-upload`}
                      className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-accent/20"
                    >
                      <Upload className="size-4" aria-hidden="true" /> Upload
                    </label>
                    <input
                      id={`${kind}-upload`}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => uploadImage(kind, e.target.files?.[0])}
                    />
                    {data[kind] ? (
                      <>
                        <img
                          src={data[kind] as string}
                          alt=""
                          className="h-10 w-auto max-w-24 rounded border border-border bg-white object-contain p-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => patch({ [kind]: null } as Partial<InvoiceData>)}
                        >
                          Remove
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">PNG, JPG or SVG · max 1.5 MB</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Invoice meta */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Invoice details
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div data-invalid={invalid("invoiceNumber")}>
                <Label htmlFor="invoice-number">Invoice number *</Label>
                <Input
                  id="invoice-number"
                  value={data.invoiceNumber}
                  maxLength={40}
                  aria-invalid={invalid("invoiceNumber")}
                  onChange={(e) => patch({ invoiceNumber: e.target.value })}
                />
                {showErrors && <FieldError message={errors["invoiceNumber"]} />}
              </div>
              <div>
                <Label htmlFor="po-number">PO number</Label>
                <Input
                  id="po-number"
                  value={data.poNumber}
                  maxLength={40}
                  onChange={(e) => patch({ poNumber: e.target.value })}
                />
              </div>
              <div data-invalid={invalid("issueDate")}>
                <Label htmlFor="issue-date">Issue date *</Label>
                <Input
                  id="issue-date"
                  type="date"
                  value={data.issueDate}
                  onChange={(e) => patch({ issueDate: e.target.value })}
                />
                {showErrors && <FieldError message={errors["issueDate"]} />}
              </div>
              <div data-invalid={invalid("dueDate")}>
                <Label htmlFor="due-date">Due date *</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={data.dueDate}
                  aria-invalid={invalid("dueDate")}
                  onChange={(e) => patch({ dueDate: e.target.value })}
                />
                {showErrors && <FieldError message={errors["dueDate"]} />}
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={data.currency}
                  onChange={(e) => patch({ currency: e.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {partyFields("from", "From (your business)")}
            {partyFields("to", "Bill to (client)")}
          </div>

          {/* Line items */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5" data-invalid={invalid("items")}>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Line items
            </h2>
            <div className="mt-4 grid gap-3">
              {data.items.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-[1fr_80px_110px_auto] sm:border-0 sm:bg-transparent sm:p-0"
                >
                  <div className="min-w-0">
                    <Label className="mb-1 text-xs text-muted-foreground sm:sr-only">
                      Description
                    </Label>
                    <Input
                      aria-label={`Item ${index + 1} description`}
                      placeholder="Design work, consulting hours…"
                      value={item.description}
                      maxLength={300}
                      onChange={(e) => patchItem(item.id, "description", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:contents">
                    <div>
                      <Label className="mb-1 text-xs text-muted-foreground sm:sr-only">Qty</Label>
                      <Input
                        aria-label={`Item ${index + 1} quantity`}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) => patchItem(item.id, "quantity", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 text-xs text-muted-foreground sm:sr-only">Rate</Label>
                      <Input
                        aria-label={`Item ${index + 1} rate`}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={item.rate}
                        onChange={(e) => patchItem(item.id, "rate", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <p className="text-sm font-medium sm:hidden">
                      {money((Number(item.quantity) || 0) * (Number(item.rate) || 0))}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-10 min-w-10"
                      aria-label={`Remove item ${index + 1}`}
                      onClick={() => removeItem(item.id)}
                      disabled={data.items.length === 1}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {showErrors && <FieldError message={errors["items"]} />}
            <Button variant="outline" size="sm" className="mt-4 min-h-10" onClick={addItem}>
              <Plus className="mr-1 size-3.5" aria-hidden="true" /> Add line item
            </Button>

            <Separator className="my-5" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div data-invalid={invalid("taxRate")}>
                <Label htmlFor="tax-rate">{locale?.taxRateLabel ?? "Tax rate (%)"}</Label>
                <Input
                  id="tax-rate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={data.taxRate}
                  aria-invalid={invalid("taxRate")}
                  onChange={(e) => patch({ taxRate: Number(e.target.value) || 0 })}
                />
                {showErrors && <FieldError message={errors["taxRate"]} />}
              </div>
              <div data-invalid={invalid("discount")}>
                <Label htmlFor="discount">Discount</Label>
                <div className="flex gap-2">
                  <Input
                    id="discount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={data.discount}
                    onChange={(e) => patch({ discount: Number(e.target.value) || 0 })}
                  />
                  <select
                    aria-label="Discount type"
                    value={data.discountType}
                    onChange={(e) =>
                      patch({ discountType: e.target.value as InvoiceData["discountType"] })
                    }
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="percent">%</option>
                    <option value="fixed">{data.currency}</option>
                  </select>
                </div>
                {showErrors && <FieldError message={errors["discount"]} />}
              </div>
              <div>
                <Label htmlFor="shipping">Shipping / extra</Label>
                <Input
                  id="shipping"
                  type="number"
                  min={0}
                  step="0.01"
                  value={data.shipping}
                  onChange={(e) => patch({ shipping: Number(e.target.value) || 0 })}
                />
                {showErrors && <FieldError message={errors["shipping"]} />}
              </div>
              <div>
                <Label htmlFor="amount-paid">Amount already paid</Label>
                <Input
                  id="amount-paid"
                  type="number"
                  min={0}
                  step="0.01"
                  value={data.amountPaid}
                  onChange={(e) => patch({ amountPaid: Number(e.target.value) || 0 })}
                />
                {showErrors && <FieldError message={errors["amountPaid"]} />}
              </div>
            </div>

            <dl className="mt-5 space-y-1.5 rounded-lg bg-muted/50 p-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Subtotal</dt>
                <dd>{money(totals.subtotal)}</dd>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Discount</dt>
                  <dd>−{money(totals.discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <dt>Tax</dt>
                <dd>{money(totals.taxAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <dt>Balance due</dt>
                <dd>{money(totals.balanceDue)}</dd>
              </div>
            </dl>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Notes & terms
            </h2>
            <div className="mt-4 grid gap-4">
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  maxLength={600}
                  value={data.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="terms">Payment terms</Label>
                <Textarea
                  id="terms"
                  rows={3}
                  maxLength={600}
                  value={data.terms}
                  onChange={(e) => patch({ terms: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Watermark */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Watermark
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional overlay on the preview and downloaded PDF (e.g. PAID, DRAFT, CONFIDENTIAL).
                </p>
              </div>
              <Switch
                checked={data.watermarkEnabled}
                onCheckedChange={(checked) => patch({ watermarkEnabled: checked })}
                aria-label="Enable watermark"
              />
            </div>

            {data.watermarkEnabled && (
              <div className="mt-4 grid gap-4">
                <div>
                  <Label htmlFor="watermark-text">Watermark text</Label>
                  <Input
                    id="watermark-text"
                    maxLength={40}
                    placeholder="PAID"
                    value={data.watermarkText}
                    disabled={Boolean(data.watermarkImage)}
                    onChange={(e) => patch({ watermarkText: e.target.value })}
                  />
                  {data.watermarkImage ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Text is hidden while an image watermark is set.
                    </p>
                  ) : null}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="watermark-opacity">
                      Opacity ({Math.round(data.watermarkOpacity * 100)}%)
                    </Label>
                  </div>
                  <input
                    id="watermark-opacity"
                    type="range"
                    min={4}
                    max={45}
                    step={1}
                    value={Math.round(data.watermarkOpacity * 100)}
                    onChange={(e) =>
                      patch({ watermarkOpacity: Number(e.target.value) / 100 })
                    }
                    className="mt-2 w-full accent-primary"
                  />
                </div>

                <div>
                  <Label htmlFor="watermark-upload">Image watermark (optional)</Label>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <label
                      htmlFor="watermark-upload"
                      className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-accent/20"
                    >
                      <Upload className="size-4" aria-hidden="true" /> Upload image
                    </label>
                    <input
                      id="watermark-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => uploadImage("watermarkImage", e.target.files?.[0])}
                    />
                    {data.watermarkImage ? (
                      <>
                        <img
                          src={data.watermarkImage}
                          alt=""
                          className="h-10 w-auto max-w-24 rounded border border-border bg-white object-contain p-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => patch({ watermarkImage: null })}
                        >
                          <Trash2 className="mr-1 size-3.5" aria-hidden="true" /> Remove
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {["PAID", "DRAFT", "CONFIDENTIAL", "COPY"].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(data.watermarkImage)}
                      onClick={() =>
                        patch({ watermarkText: preset, watermarkImage: null })
                      }
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <AdSlot id="generator-below-form" format="rectangle" />
        </div>

        {/* ------------------------------- Preview ------------------------------ */}
        <div
          className={cn(
            "min-w-0 lg:sticky lg:top-24 lg:h-fit",
            mobileTab !== "preview" && "hidden lg:block",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Live preview · {activeTemplateName}
            </h2>
            <Button
              size="sm"
              variant="outline"
              className="hidden shrink-0 sm:inline-flex"
              onClick={download}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="mr-1 size-3.5" aria-hidden="true" />
              )}
              PDF
            </Button>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-muted/40 p-2 sm:p-4">
            <div ref={previewWrapRef} className="w-full max-w-full overflow-hidden">
              <div
                className="origin-top-left"
                style={{
                  transform: `scale(${previewScale})`,
                  width: PAGE_WIDTH,
                  height: 1123 * previewScale,
                }}
              >
                <div ref={documentRef} style={{ boxShadow: "0 18px 40px -18px rgba(17,24,39,0.28)" }}>
                  <InvoicePreview data={data} id="invoice-document" />
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            The preview is scaled to fit; the PDF exports at full A4 size using the template you
            selected above.
          </p>
          {mobileTab === "preview" ? (
            <Button
              className="mt-4 w-full min-h-11 lg:hidden"
              variant="outline"
              onClick={() => setMobileTab("edit")}
            >
              <Pencil className="mr-1 size-4" aria-hidden="true" /> Back to editing
            </Button>
          ) : null}
        </div>
      </div>

      {/* Mobile sticky download bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-[96rem] items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11 shrink-0"
            onClick={resetAll}
            aria-label="Reset invoice"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {activeTemplateName} · {money(totals.balanceDue)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {savedAt ? "Draft saved" : "Autosave on"} · Total due
            </p>
          </div>
          <Button size="sm" onClick={download} disabled={exporting} className="min-h-11 shrink-0 px-4">
            {exporting ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="mr-1 size-3.5" aria-hidden="true" />
            )}
            PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
