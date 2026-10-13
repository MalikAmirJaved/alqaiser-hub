"use client";

import { useMemo } from "react";
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
}

export function createDefaultDocumentAppearance(): DocumentAppearance {
  return {
    template_slug: "modern",
    accent_color: "",
    typography: createDefaultTypography(),
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
  };

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
          Choose the template and typography saved with this document.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(240px,0.72fr)]">
        <div className="space-y-5">
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
                  updateTypography({ baseSize: Number(event.target.value), enabled: true })
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
            {([
              ["enabled", "Use custom typography"],
              ["boldTitles", "Bold titles"],
              ["boldBody", "Bold body text"],
              ["italicBody", "Italic body text"],
              ["italicNotes", "Italic notes"],
            ] as const).map(([key, label]) => (
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
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live preview · {template.name}
          </p>
          <div className="mx-auto h-[405px] w-full max-w-[286px] overflow-hidden rounded-lg border border-border bg-muted/40 p-1">
            <div
              style={{
                width: 794,
                height: 1123,
                transform: "scale(0.35)",
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
    </section>
  );
}
