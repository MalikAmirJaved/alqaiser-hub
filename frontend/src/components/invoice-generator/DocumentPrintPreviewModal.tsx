"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InvoiceData } from "./invoice";
import { InvoicePreview } from "./InvoicePreview";
import { exportInvoicePdf, safeFileName } from "./pdf";

interface DocumentPrintPreviewModalProps {
  open: boolean;
  onClose: () => void;
  data: InvoiceData;
  documentTitle: "Invoice" | "Quote";
}

export function DocumentPrintPreviewModal({
  open,
  onClose,
  data,
  documentTitle,
}: DocumentPrintPreviewModalProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Allow pop-ups to print this document.");
      return;
    }

    const preview = previewRef.current;
    if (!preview) {
      printWindow.close();
      toast.error("The document preview is not ready to print.");
      return;
    }

    const printStyles = `
      <style>
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      </style>
    `;
    printWindow.addEventListener(
      "load",
      async () => {
        const images = Array.from(printWindow.document.images);
        await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
        printWindow.focus();
        printWindow.print();
      },
      { once: true },
    );
    printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });
    printWindow.document.open();
    printWindow.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${documentTitle}</title>${printStyles}</head><body>${preview.outerHTML}</body></html>`,
    );
    printWindow.document.close();
  };

  const handleDownloadPdf = async () => {
    if (!previewRef.current) {
      toast.error("The document preview is not ready to export.");
      return;
    }

    setPdfLoading(true);
    try {
      await exportInvoicePdf(
        previewRef.current,
        safeFileName(data.invoiceNumber, "", documentTitle.toLowerCase()),
      );
    } catch (error) {
      console.error("Document PDF export failed:", error);
      toast.error("Could not export the document as a PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto p-0">
        <DialogTitle className="sr-only">
          {documentTitle} - {data.invoiceNumber}
        </DialogTitle>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
          <span className="text-sm font-medium">
            {documentTitle} #{data.invoiceNumber}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-1.5 h-4 w-4" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
            >
              {pdfLoading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              PDF
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" aria-label="Close print preview">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </div>
        <div className="overflow-x-auto bg-muted/30 p-4">
          <div ref={previewRef} className="mx-auto w-fit shadow-lg">
            <InvoicePreview
              data={data}
              documentTitle={documentTitle}
              id="crm-document-print-preview"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
