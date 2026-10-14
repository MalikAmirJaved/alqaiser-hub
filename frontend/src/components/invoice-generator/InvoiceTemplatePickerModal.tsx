"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { TEMPLATES } from "./templates";
import type { InvoiceData } from "./invoice";

interface InvoiceTemplatePickerModalProps {
  open: boolean;
  data: InvoiceData | null;
  isPaid?: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSelect: (data: InvoiceData) => void | Promise<void>;
}

export function InvoiceTemplatePickerModal({
  open,
  data,
  isPaid = false,
  isSaving = false,
  onClose,
  onSelect,
}: InvoiceTemplatePickerModalProps) {
  const [templateSlug, setTemplateSlug] = useState("modern");
  const [useCompanyLogo, setUseCompanyLogo] = useState(true);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkLogo, setWatermarkLogo] = useState(false);
  const [watermarkText, setWatermarkText] = useState("PAID");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.14);

  useEffect(() => {
    if (!open || !data) return;
    setTemplateSlug(data.templateSlug || "modern");
    setUseCompanyLogo(Boolean(data.logo));
    setWatermarkEnabled(data.watermarkEnabled);
    setWatermarkLogo(Boolean(data.watermarkImage));
    setWatermarkText(data.watermarkText || "PAID");
    setWatermarkOpacity(data.watermarkOpacity);
  }, [data, open]);

  const selectedTemplate =
    TEMPLATES.find((template) => template.slug === templateSlug) ?? TEMPLATES[0]!;

  const handleSelect = async () => {
    if (!data) return;
    const logo = useCompanyLogo ? data.logo : null;
    await onSelect({
      ...data,
      templateSlug: selectedTemplate.slug,
      accentColor:
        selectedTemplate.slug === data.templateSlug && data.accentColor
          ? data.accentColor
          : selectedTemplate.accent,
      logo,
      watermarkEnabled,
      watermarkText,
      watermarkOpacity,
      watermarkImage: watermarkEnabled && watermarkLogo && useCompanyLogo ? logo : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Choose an invoice template</DialogTitle>
        <DialogDescription>
          Select the design and branding to use for this invoice.
        </DialogDescription>
        {isPaid && (
          <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            This invoice is paid and locked. Your selection will apply to this
            preview and print only; it won’t change the saved invoice.
          </p>
        )}

        <div className="grid max-h-[42vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {TEMPLATES.map((template) => {
            const selected = template.slug === selectedTemplate.slug;
            return (
              <button
                key={template.slug}
                type="button"
                aria-pressed={selected}
                onClick={() => setTemplateSlug(template.slug)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent/10"
                }`}
              >
                <span
                  className="mb-2 block h-7 rounded"
                  style={{ background: template.accent }}
                  aria-hidden="true"
                />
                <span className="block text-sm font-semibold">{template.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {template.industry}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
            <input
              type="checkbox"
              checked={useCompanyLogo}
              onChange={(event) => setUseCompanyLogo(event.target.checked)}
              className="accent-primary"
            />
            Use company logo
          </label>
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
            <input
              type="checkbox"
              checked={watermarkEnabled}
              onChange={(event) => setWatermarkEnabled(event.target.checked)}
              className="accent-primary"
            />
            Show watermark
          </label>
          {watermarkEnabled && (
            <>
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
                <input
                  type="checkbox"
                  checked={watermarkLogo}
                  disabled={!useCompanyLogo}
                  onChange={(event) => setWatermarkLogo(event.target.checked)}
                  className="accent-primary"
                />
                Use company logo as watermark
              </label>
              {!watermarkLogo && (
                <label className="grid gap-1 text-xs font-medium">
                  Watermark text
                  <input
                    value={watermarkText}
                    onChange={(event) => setWatermarkText(event.target.value)}
                    maxLength={40}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  />
                </label>
              )}
              <label className="grid gap-1 text-xs font-medium sm:col-span-2">
                Watermark opacity ({Math.round(watermarkOpacity * 100)}%)
                <input
                  type="range"
                  min={4}
                  max={45}
                  value={Math.round(watermarkOpacity * 100)}
                  onChange={(event) =>
                    setWatermarkOpacity(Number(event.target.value) / 100)
                  }
                  className="h-8 accent-primary"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSelect}
            disabled={!data || isSaving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Preview invoice"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
