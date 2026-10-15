"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FONT_FAMILY_OPTIONS,
  HEADING_LEVELS,
  createDefaultTypography,
  normalizeTypography,
  type InvoiceData,
  type InvoiceFontFamily,
  type InvoiceHeadingLevel,
  type InvoiceTypography,
} from "./invoice";
import { InvoicePreview } from "./InvoicePreview";
import { TEMPLATES } from "./templates";

export interface DocumentAppearance {
  template_slug: string;
  accent_color: string;
  typography: InvoiceTypography;
  use_company_logo: boolean;
  watermark_enabled: boolean;
  watermark_text: string;
  watermark_opacity: number;
  watermark_logo: boolean;
}

export function createDefaultDocumentAppearance(): DocumentAppearance {
  return {
    template_slug: "modern",
    accent_color: "",
    typography: createDefaultTypography(),
    use_company_logo: true,
    watermark_enabled: false,
    watermark_text: "PAID",
    watermark_opacity: 0.14,
    watermark_logo: false,
  };
}

export function documentAppearanceFromRecord(
  record: Partial<Pick<DocumentAppearance, "template_slug" | "accent_color">> & {
    typography?: (Partial<InvoiceTypography> & Partial<Record<
      "useCompanyLogo" | "watermarkEnabled" | "watermarkText" | "watermarkOpacity" | "watermarkLogo",
      boolean | string | number
    >>) | null;
  },
): DocumentAppearance {
  const defaults = createDefaultDocumentAppearance();
  const stored = record.typography;
  return {
    template_slug: record.template_slug || defaults.template_slug,
    accent_color: record.accent_color || defaults.accent_color,
    typography: normalizeTypography(stored),
    use_company_logo:
      typeof stored?.useCompanyLogo === "boolean"
        ? stored.useCompanyLogo
        : defaults.use_company_logo,
    watermark_enabled:
      typeof stored?.watermarkEnabled === "boolean"
        ? stored.watermarkEnabled
        : defaults.watermark_enabled,
    watermark_text:
      typeof stored?.watermarkText === "string"
        ? stored.watermarkText
        : defaults.watermark_text,
    watermark_opacity:
      typeof stored?.watermarkOpacity === "number"
        ? Math.min(0.45, Math.max(0.04, stored.watermarkOpacity))
        : defaults.watermark_opacity,
    watermark_logo:
      typeof stored?.watermarkLogo === "boolean"
        ? stored.watermarkLogo
        : defaults.watermark_logo,
  };
}

export function serializeDocumentTypography(appearance: DocumentAppearance) {
  return {
    ...appearance.typography,
    useCompanyLogo: appearance.use_company_logo,
    watermarkEnabled: appearance.watermark_enabled,
    watermarkText: appearance.watermark_text,
    watermarkOpacity: appearance.watermark_opacity,
    watermarkLogo: appearance.watermark_logo,
  };
}

interface Props {
  appearance: DocumentAppearance;
  previewData: InvoiceData;
  documentTitle?: "Invoice" | "Quote";
  onChange: (appearance: DocumentAppearance) => void;
}

export function InvoiceAppearanceEditor({
  appearance,
  previewData,
  documentTitle = "Invoice",
  onChange,
}: Props) {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.5);
  const typography = useMemo(
    () => normalizeTypography(appearance.typography),
    [appearance.typography],
  );
  const template = TEMPLATES.find(({ slug }) => slug === appearance.template_slug) ?? TEMPLATES[0]!;
  const preview = {
    ...previewData,
    templateSlug: template.slug,
    accentColor: appearance.accent_color || null,
    typography,
    logo: appearance.use_company_logo ? previewData.logo : null,
    watermarkEnabled: appearance.watermark_enabled,
    watermarkText: appearance.watermark_text,
    watermarkOpacity: appearance.watermark_opacity,
    watermarkImage:
      appearance.watermark_logo && appearance.use_company_logo
        ? previewData.logo
        : null,
  };

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const updateScale = () => {
      setPreviewScale(Math.min(1, Math.max(0.2, (container.clientWidth - 32) / 794)));
    };

    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    updateScale();
    return () => observer.disconnect();
  }, []);

  const updateTypography = (changes: Partial<InvoiceTypography>) =>
    onChange({
      ...appearance,
      typography: normalizeTypography({ ...typography, ...changes }),
    });

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Document design
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose the template, typography and branding saved with this document.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.6fr)]">
        <div className="rounded-lg border border-border">
          <div className="border-b border-border px-4 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Template & typography
            </h4>
          </div>
          <div className="space-y-5 p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TEMPLATES.map((item) => {
          const selected = item.slug === template.slug;
          return (
            <button
              key={item.slug}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onChange({
                  ...appearance,
                  template_slug: item.slug,
                  accent_color: item.accent,
                })
              }
              className={`rounded-lg border p-2 text-left transition-colors ${
                selected
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-accent/10"
              }`}
            >
              <span
                className="block h-5 rounded"
                style={{ background: item.accent }}
                aria-hidden="true"
              />
              <span className="mt-1.5 block truncate text-xs font-semibold">
                {item.name}
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {item.industry}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-medium">
          Accent color
          <span className="flex h-10 items-center gap-2 rounded-md border border-input px-2">
            <input
              aria-label="Document accent color"
              type="color"
              value={appearance.accent_color || template.accent}
              onChange={(event) =>
                onChange({ ...appearance, accent_color: event.target.value })
              }
              className="size-7 cursor-pointer border-0 bg-transparent p-0"
            />
            <span className="font-mono uppercase text-muted-foreground">
              {appearance.accent_color || template.accent}
            </span>
          </span>
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Font family
          <select
            value={typography.fontFamily}
            onChange={(event) =>
              updateTypography({
                fontFamily: event.target.value as InvoiceFontFamily,
                enabled: true,
              })
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {FONT_FAMILY_OPTIONS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Base font size ({typography.baseSize}px)
          <input
            type="range"
            min={11}
            max={18}
            value={typography.baseSize}
            onChange={(event) =>
              updateTypography({
                baseSize: Number(event.target.value),
                enabled: true,
              })
            }
            className="h-10 accent-primary"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Title size
          <select
            value={typography.titleLevel}
            onChange={(event) =>
              updateTypography({
                titleLevel: event.target.value as InvoiceHeadingLevel,
                enabled: true,
              })
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {HEADING_LEVELS.map((level) => (
              <option key={level.id} value={level.id}>
                {level.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["enabled", "Use custom typography"],
            ["boldTitles", "Bold titles"],
            ["boldBody", "Bold body text"],
            ["italicBody", "Italic body text"],
            ["italicNotes", "Italic notes"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-xs"
          >
            <input
              type="checkbox"
              checked={typography[key]}
              onChange={(event) =>
                updateTypography({ [key]: event.target.checked })
              }
              className="accent-primary"
            />
            {label}
          </label>
        ))}
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Branding
        </h5>
        <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-xs">
          <input
            type="checkbox"
            checked={appearance.use_company_logo}
            onChange={(event) =>
              onChange({ ...appearance, use_company_logo: event.target.checked })
            }
            className="accent-primary"
          />
          Use company logo
        </label>
        <p className="text-[11px] text-muted-foreground">
          Change the uploaded logo in{" "}
          <a className="text-primary underline-offset-2 hover:underline" href="/settings/company">
            Company Settings
          </a>
          .
        </p>
        <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-xs">
          <input
            type="checkbox"
            checked={appearance.watermark_enabled}
            onChange={(event) =>
              onChange({ ...appearance, watermark_enabled: event.target.checked })
            }
            className="accent-primary"
          />
          Show watermark
        </label>
        {appearance.watermark_enabled && (
          <>
            <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-xs">
              <input
                type="checkbox"
                checked={appearance.watermark_logo}
                disabled={!appearance.use_company_logo}
                onChange={(event) =>
                  onChange({ ...appearance, watermark_logo: event.target.checked })
                }
                className="accent-primary"
              />
              Use company logo as watermark
            </label>
            {!appearance.watermark_logo && (
              <label className="grid gap-1.5 text-xs font-medium">
                Watermark text
                <input
                  value={appearance.watermark_text}
                  onChange={(event) =>
                    onChange({ ...appearance, watermark_text: event.target.value })
                  }
                  maxLength={40}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                />
              </label>
            )}
            <label className="grid gap-1.5 text-xs font-medium">
              Watermark opacity ({Math.round(appearance.watermark_opacity * 100)}%)
              <input
                type="range"
                min={4}
                max={45}
                value={Math.round(appearance.watermark_opacity * 100)}
                onChange={(event) =>
                  onChange({
                    ...appearance,
                    watermark_opacity: Number(event.target.value) / 100,
                  })
                }
                className="h-8 accent-primary"
              />
            </label>
          </>
        )}
      </div>
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-border">
          <div className="border-b border-border px-4 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Live preview · {template.name}
            </h4>
          </div>
          <div
            ref={previewContainerRef}
            className="bg-muted/30 p-4"
          >
            <div
              className="mx-auto"
              style={{
                width: 794 * previewScale,
                height: 1123 * previewScale,
              }}
            >
              <div
                style={{
                  width: 794,
                  height: 1123,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                }}
              >
          <InvoicePreview
            data={preview}
            documentTitle={documentTitle}
            id={`crm-${documentTitle.toLowerCase()}-preview`}
          />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
