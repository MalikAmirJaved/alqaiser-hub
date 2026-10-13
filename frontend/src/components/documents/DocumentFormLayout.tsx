import type { ReactNode } from "react";
import { FileText } from "lucide-react";

interface DocumentFormLayoutProps {
  documentType: "Quote" | "Invoice";
  title: string;
  documentNumber?: string;
  formId: string;
  isPending: boolean;
  submitLabel: string;
  pendingLabel?: string;
  summary: ReactNode;
  onCancel: () => void;
  children: ReactNode;
}

export default function DocumentFormLayout({
  documentType,
  title,
  documentNumber,
  formId,
  isPending,
  submitLabel,
  pendingLabel = "Saving...",
  summary,
  onCancel,
  children,
}: DocumentFormLayoutProps) {
  const isQuote = documentType === "Quote";

  return (
    <main className="">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                isQuote
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              {documentType}
            </span>
            <div>
              <h2 className="text-base font-semibold leading-tight">{title}</h2>
              {documentNumber && (
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {documentNumber}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            Back
          </button>
        </div>

        {children}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-3.5 sm:px-6">
          <p className="text-xs text-muted-foreground">{summary}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-9 rounded-lg border border-border px-4 text-sm transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              disabled={isPending}
              className="h-9 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? pendingLabel : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
