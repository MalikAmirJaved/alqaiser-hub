"use client";

import { useRef, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, X, Loader2 } from "lucide-react";

// ── Types ──────────────────────────────────────────

export interface DocLine {
  variant_name?: string;
  variant_sku?: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_amount: number;
}

export interface DocCompany {
  companyName: string;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  phone: string;
  email: string;
  taxId?: string;
  logo?: string;
  /** Full absolute URL for the logo (used in PDF generation where env vars aren't available) */
  logoUrl?: string;
}

export interface QuoteInvoiceData {
  type: "QUOTE" | "INVOICE";
  documentNumber: string;
  date: string;
  dueDate?: string;
  expirationDate?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  lines: DocLine[];
  totalAmount: number;
  overallDiscountPercent?: number;
  overallTaxPercent?: number;
  status?: string;
  paymentStatus?: string;
  notes?: string;
}

interface QuoteInvoiceDocumentProps {
  data: QuoteInvoiceData;
  company: DocCompany;
  termsContent: string;
  formatCurrency: (value: number) => string;
}

// ── Helpers ────────────────────────────────────────

function buildLocationString(company: DocCompany): string {
  const parts = [company.city, company.state, company.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "";
}

/** Load a remote image URL into a base64 data URI */
async function imageUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
  });
}

// ── Document Component ─────────────────────────────

function DocumentContent({
  data,
  company,
  termsContent,
  formatCurrency,
}: QuoteInvoiceDocumentProps) {
  const docType = data.type === "QUOTE" ? "QUOTE" : "INVOICE";
  const calcSubtotal = data.lines.reduce(
    (sum, l) => sum + l.quantity * l.unit_price,
    0,
  );
  const calcDiscount = data.lines.reduce(
    (sum, l) => sum + (l.discount_amount || 0),
    0,
  );
  const locationStr = buildLocationString(company);

  return (
    <div className="bg-white text-gray-900 p-8 max-w-4xl mx-auto font-sans">
      {/* ── Header ───────────────────────────── */}
      <div className="flex justify-between items-start border-b-2 border-gray-300 pb-6 mb-6">
        <div className="flex items-start gap-4">
          {company.logo && (
            <img
              src={`${process.env.NEXT_PUBLIC_API_URL}${company.logo}`}
              alt={`${company.companyName} logo`}
              className="w-16 h-16 object-contain rounded"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{company.companyName}</h1>
            <div className="mt-2 text-sm text-gray-900 space-y-0.5">
              {company.address && <p>{company.address}</p>}
              {locationStr && <p>{locationStr}</p>}
              <p>{[company.phone, company.email].filter(Boolean).join("  |  ")}</p>
              {company.taxId && <p>TRN: {company.taxId}</p>}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">{docType}</h2>
          <p className="text-sm text-gray-900 mt-1">#{data.documentNumber}</p>
        </div>
      </div>

      {/* ── Bill To & Dates ──────────────────── */}
      <div className="flex justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Bill To
          </h3>
          <p className="mt-1 text-base font-medium">{data.customerName}</p>
          {data.customerEmail && (
            <p className="text-sm text-gray-900">{data.customerEmail}</p>
          )}
          {data.customerPhone && (
            <p className="text-sm text-gray-900">{data.customerPhone}</p>
          )}
        </div>
        <div className="text-right text-sm text-gray-900 space-y-0.5">
          <p>
            <span className="font-medium">Date:</span> {data.date}
          </p>
          {data.type === "INVOICE" && data.dueDate && (
            <p>
              <span className="font-medium">Due Date:</span> {data.dueDate}
            </p>
          )}
          {data.type === "QUOTE" && data.expirationDate && (
            <p>
              <span className="font-medium">Expires:</span>{" "}
              {data.expirationDate}
            </p>
          )}
        </div>
      </div>

      {/* ── Line Items ────────────────────────── */}
      <table className="w-full text-sm border-collapse mb-6">
        <thead>
          <tr className="bg-gray-100 border-b-2 border-gray-300">
            <th className="text-left py-2 px-3 font-semibold text-gray-900">
              Product
            </th>
            <th className="text-left py-2 px-3 font-semibold text-gray-900">
              Qty
            </th>
            <th className="text-left py-2 px-3 font-semibold text-gray-900">
              Unit Price
            </th>
            <th className="text-left py-2 px-3 font-semibold text-gray-900">
              Discount
            </th>
            <th className="text-left py-2 px-3 font-semibold text-gray-900">
              Tax
            </th>
            <th className="text-right py-2 px-3 font-semibold text-gray-900">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, idx) => {
            const subtotal = line.quantity * line.unit_price;
            const discount = line.discount_amount || 0;
            const tax = (subtotal - discount) * (line.tax_rate / 100);
            const lineTotal = subtotal - discount + tax;
            return (
              <tr
                key={idx}
                className="border-b border-gray-200 hover:bg-gray-50"
              >
                <td className="py-2 px-3 text-gray-900">
                  <div className="font-medium">
                    {line.variant_name || "Product"}
                  </div>
                  <div className="text-xs">
                    SKU: {line.variant_sku || "—"}
                  </div>
                </td>
                <td className="py-2 px-3 text-left text-gray-900">{line.quantity}</td>
                <td className="py-2 px-3 text-left text-gray-900">
                  {formatCurrency(line.unit_price)}
                </td>
                <td className="py-2 px-3 text-left text-gray-900">
                  {discount > 0 ? formatCurrency(discount) : "—"}
                </td>
                <td className="py-2 px-3 text-left text-gray-900">{line.tax_rate}%</td>
                <td className="py-2 px-3 text-right font-medium text-gray-900">
                  {formatCurrency(lineTotal)}
                </td>
              </tr>
            );
          })}
          {data.lines.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="py-8 text-center text-gray-900"
              >
                No items
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300">
            <td colSpan={5} className="py-2 px-3 text-right font-semibold text-gray-900">
              Subtotal
            </td>
            <td className="py-2 px-3 text-right text-gray-900">
              {formatCurrency(calcSubtotal)}
            </td>
          </tr>
          {calcDiscount > 0 && (
            <tr className="border-t border-gray-200">
              <td
                colSpan={5}
                className="py-2 px-3 text-right font-semibold text-gray-900"
              >
                Line Discount
              </td>
              <td className="py-2 px-3 text-right text-gray-900">
                -{formatCurrency(calcDiscount)}
              </td>
            </tr>
          )}
          {data.overallDiscountPercent && data.overallDiscountPercent > 0 && (
            <tr className="border-t border-gray-200">
              <td colSpan={5} className="py-2 px-3 text-right font-semibold text-gray-900">
                Discount ({data.overallDiscountPercent}%)
              </td>
              <td className="py-2 px-3 text-right text-gray-900">
                -{formatCurrency(calcSubtotal * (data.overallDiscountPercent / 100))}
              </td>
            </tr>
          )}
          {data.overallTaxPercent && data.overallTaxPercent > 0 && (
            <tr className="border-t border-gray-200">
              <td colSpan={5} className="py-2 px-3 text-right font-semibold text-gray-900">
                Tax ({data.overallTaxPercent}%)
              </td>
              <td className="py-2 px-3 text-right text-gray-900">
                {formatCurrency(
                  (calcSubtotal - (calcSubtotal * ((data.overallDiscountPercent || 0) / 100))) *
                  (data.overallTaxPercent / 100)
                )}
              </td>
            </tr>
          )}
          <tr className="border-t-2 border-gray-300">
            <td colSpan={5} className="py-2 px-3 text-right font-bold text-lg text-gray-900">
              Total
            </td>
            <td className="py-2 px-3 text-right font-bold text-lg text-gray-900">
              {formatCurrency(data.totalAmount)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── Notes ────────────────────────────── */}
      {data.notes && (
        <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200 text-sm text-gray-900">
          <span className="font-semibold text-gray-900">Notes:</span>{" "}
          {data.notes}
        </div>
      )}

      {/* ── Terms & Conditions ───────────────── */}
      {termsContent && (
        <div className="border-t-2 border-gray-300 pt-4 mt-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
            Terms & Conditions
          </h3>
          <div
            className="text-sm text-gray-900 leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: termsContent }}
          />
        </div>
      )}
    </div>
  );
}

// ── PDF Generator ──────────────────────────────────

async function generatePdf(
  props: QuoteInvoiceDocumentProps,
): Promise<Blob> {
  const { data: docData, company, termsContent, formatCurrency } = props;
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;
  const locationStr = buildLocationString(company);

  // ── Header ──
  // Company logo (if provided) - load async and add as image, max 14mm height
  const logoSourceUrl = company.logoUrl || company.logo;
  if (logoSourceUrl) {
    try {
      const logoDataUrl = await imageUrlToBase64(logoSourceUrl);
      const logoHeight = 14;
      const logoWidth = 14;
      // Detect format from data URI
      const format = logoDataUrl.startsWith("data:image/png") ? "PNG" :
                     logoDataUrl.startsWith("data:image/jpeg") ? "JPEG" :
                     logoDataUrl.startsWith("data:image/gif") ? "GIF" :
                     logoDataUrl.startsWith("data:image/webp") ? "WEBP" : "JPEG";
      doc.addImage(logoDataUrl, format, margin, y - 2, logoWidth, logoHeight);
      // Shift text to the right of the logo
      const textX = margin + logoWidth + 6;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text(company.companyName, textX, y + 2);
      y += 8;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      if (company.address) {
        doc.text(company.address, textX, y);
        y += 3.5;
      }
      if (locationStr) {
        doc.text(locationStr, textX, y);
        y += 3.5;
      }
      const contactParts: string[] = [];
      if (company.phone) contactParts.push(company.phone);
      if (company.email) contactParts.push(company.email);
      if (contactParts.length > 0) {
        doc.text(contactParts.join("  |  "), textX, y);
        y += 3.5;
      }
      if (company.taxId) {
        doc.text(`TRN: ${company.taxId}`, textX, y);
        y += 3.5;
      }
      y += 2;
    } catch {
      // Fallback if logo fails to load - just text
      y = _renderCompanyText(doc, company, locationStr, margin, y);
    }
  } else {
    y = _renderCompanyText(doc, company, locationStr, margin, y);
  }

  // Document type & number (right-aligned)
  const docType = docData.type === "QUOTE" ? "QUOTE" : "INVOICE";
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(docType, pageWidth - margin, margin + 2, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  doc.text(`#${docData.documentNumber}`, pageWidth - margin, margin + 8, { align: "right" });

  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Bill To & Dates ──
  let billToY = y;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Bill To", margin, billToY);
  billToY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(docData.customerName, margin, billToY);
  billToY += 5;

  doc.setFontSize(9);
  doc.setTextColor(0);
  if (docData.customerEmail) {
    doc.text(docData.customerEmail, margin, billToY);
    billToY += 4;
  }
  if (docData.customerPhone) {
    doc.text(docData.customerPhone, margin, billToY);
    billToY += 4;
  }

  // Dates (right-aligned) - align with billToY
  const dateY = y + 1;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  doc.text(`Date: ${docData.date}`, pageWidth - margin, dateY, { align: "right" });
  if (docData.type === "INVOICE" && docData.dueDate) {
    doc.text(`Due Date: ${docData.dueDate}`, pageWidth - margin, dateY + 5, { align: "right" });
  }
  if (docData.type === "QUOTE" && docData.expirationDate) {
    doc.text(`Expires: ${docData.expirationDate}`, pageWidth - margin, dateY + 5, { align: "right" });
  }

  y = Math.max(billToY, y + 14) + 4;

  // ── Line Items Table ──
  const tableHeaders = ["Product", "Qty", "Unit Price", "Discount", "Tax", "Total"];
  const tableBody = docData.lines.map((l) => {
    const subtotal = l.quantity * l.unit_price;
    const discount = l.discount_amount || 0;
    const tax = (subtotal - discount) * (l.tax_rate / 100);
    const lineTotal = subtotal - discount + tax;
    return [
      `${l.variant_name || "Product"} (SKU: ${l.variant_sku || "—"})`,
      String(l.quantity),
      formatCurrency(l.unit_price),
      discount > 0 ? formatCurrency(discount) : "—",
      `${l.tax_rate}%`,
      formatCurrency(lineTotal),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [tableHeaders],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    margin: { left: margin, right: margin },
    tableWidth: pageWidth - 2 * margin,
  });

  // ── Totals ──
  const finalY = (doc as any).lastAutoTable.finalY + 6;
  const calcSubtotal = docData.lines.reduce(
    (s, l) => s + l.quantity * l.unit_price,
    0,
  );
  const calcDiscount = docData.lines.reduce(
    (s, l) => s + (l.discount_amount || 0),
    0,
  );
  const overallDiscPct = docData.overallDiscountPercent || 0;
  const overallTaxPct = docData.overallTaxPercent || 0;
  const overallDiscAmt = calcSubtotal * (overallDiscPct / 100);
  const afterDisc = calcSubtotal - overallDiscAmt;
  const overallTaxAmt = afterDisc * (overallTaxPct / 100);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);

  const totalX = pageWidth - margin;
  doc.text("Subtotal", totalX - 40, finalY);
  doc.text(formatCurrency(calcSubtotal), totalX, finalY, { align: "right" });

  let nextY = finalY + 5;
  if (calcDiscount > 0) {
    doc.setTextColor(0);
    doc.text("Line Discount", totalX - 40, nextY);
    doc.text(`-${formatCurrency(calcDiscount)}`, totalX, nextY, {
      align: "right",
    });
    nextY += 5;
  }

  if (overallDiscPct > 0) {
    doc.setTextColor(0);
    doc.text(`Discount (${overallDiscPct}%)`, totalX - 40, nextY);
    doc.text(`-${formatCurrency(overallDiscAmt)}`, totalX, nextY, {
      align: "right",
    });
    nextY += 5;
  }

  if (overallTaxPct > 0) {
    doc.setTextColor(0);
    doc.text(`Tax (${overallTaxPct}%)`, totalX - 40, nextY);
    doc.text(formatCurrency(overallTaxAmt), totalX, nextY, {
      align: "right",
    });
    nextY += 5;
  }

  doc.setDrawColor(200);
  doc.line(totalX - 40, nextY, totalX, nextY);
  nextY += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Total", totalX - 40, nextY);
  doc.text(formatCurrency(docData.totalAmount), totalX, nextY, {
    align: "right",
  });

  // ── Notes ──
  if (docData.notes) {
    nextY += 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text("Notes:", margin, nextY);
    nextY += 4;
    doc.text(docData.notes, margin, nextY, { maxWidth: pageWidth - 2 * margin });
    nextY += 6;
  }

  // ── Terms & Conditions ──
  if (termsContent) {
    nextY += 6;
    doc.setDrawColor(200);
    doc.line(margin, nextY, pageWidth - margin, nextY);
    nextY += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Terms & Conditions", margin, nextY);
    nextY += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);

    // Convert common HTML to readable plain text with structure preserved
    let text = termsContent
      // Replace block-level closing tags with newlines
      .replace(/<\/(?:p|div|li|h[1-6]|blockquote|tr|table)>/gi, "\n")
      // Replace <br> and <br/> with newlines
      .replace(/<br\s*\/?>/gi, "\n")
      // Replace <li> with bullet prefix
      .replace(/<li[^>]*>/gi, "  • ")
      // Replace <td> or <th> with tab-like spacing
      .replace(/<\/(?:td|th)>/gi, "  ")
      // Strip remaining HTML tags
      .replace(/<[^>]*>/g, "")
      // Decode common entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      // Collapse multiple consecutive newlines into max 2
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
    doc.text(lines, margin, nextY);
  }

  return doc.output("blob");
}

// ── Helper: render company text block (no logo) ────
function _renderCompanyText(
  doc: jsPDF,
  company: DocCompany,
  locationStr: string,
  margin: number,
  startY: number,
): number {
  let y = startY;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(company.companyName, margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  if (company.address) {
    doc.text(company.address, margin, y);
    y += 3.5;
  }
  if (locationStr) {
    doc.text(locationStr, margin, y);
    y += 3.5;
  }
  const contactParts: string[] = [];
  if (company.phone) contactParts.push(company.phone);
  if (company.email) contactParts.push(company.email);
  if (contactParts.length > 0) {
    doc.text(contactParts.join("  |  "), margin, y);
    y += 3.5;
  }
  if (company.taxId) {
    doc.text(`TRN: ${company.taxId}`, margin, y);
    y += 3.5;
  }
  y += 2;
  return y;
}

// ── Print Preview Modal ────────────────────────────

interface PrintPreviewModalProps {
  open: boolean;
  onClose: () => void;
  documentProps: QuoteInvoiceDocumentProps;
}

export function PrintPreviewModal({
  open,
  onClose,
  documentProps,
}: PrintPreviewModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const contentEl = contentRef.current;
    if (!contentEl) return;

    // Copy all stylesheet link tags from the current page so Tailwind CSS is available
    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((link) => link.outerHTML)
      .join('\n');

    // Also copy any inline style tags that contain critical CSS (CSS variables, etc.)
    const inlineStyles = Array.from(document.querySelectorAll('style'))
      .map((s) => s.outerHTML)
      .join('\n');

    const printStyles = `
      <style>
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; }
        @page { margin: 10mm; }
        * { box-sizing: border-box; }
        img { max-width: 64px; max-height: 64px; }
      </style>
    `;

    const html = `
      <html>
        <head>
          ${styleLinks}
          ${inlineStyles}
          ${printStyles}
        </head>
        <body>${contentEl.innerHTML}</body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Wait for stylesheets to fully load before triggering print
    printWindow.addEventListener('load', () => {
      printWindow.print();
    });
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const blob = await generatePdf(documentProps);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const prefix = documentProps.data.type === "QUOTE" ? "quote" : "invoice";
      a.download = `${prefix}_${documentProps.data.documentNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">
          {documentProps.data.type} - {documentProps.data.documentNumber}
        </DialogTitle>

        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-gray-100 border-b px-4 py-3">
          <span className="text-sm font-medium text-gray-600">
            {documentProps.data.type} #{documentProps.data.documentNumber}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
            >
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
              <Button variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </div>

        {/* Document */}
        <div ref={contentRef}>
          <DocumentContent {...documentProps} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
