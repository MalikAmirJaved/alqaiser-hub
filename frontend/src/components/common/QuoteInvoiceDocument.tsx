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
  phone: string;
  email: string;
  taxId?: string;
}

export interface QuoteInvoiceData {
  type: "QUOTE" | "INVOICE";
  documentNumber: string;
  date: string;
  dueDate?: string;
  expirationDate?: string;
  customerName: string;
  lines: DocLine[];
  totalAmount: number;
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

  return (
    <div className="bg-white text-gray-900 p-8 max-w-4xl mx-auto font-sans">
      {/* ── Header ───────────────────────────── */}
      <div className="flex justify-between items-start border-b-2 border-gray-300 pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{company.companyName}</h1>
          <div className="mt-2 text-sm text-gray-600 space-y-0.5">
            <p>{company.address}</p>
            <p>{company.phone}</p>
            <p>{company.email}</p>
            {company.taxId && <p>Tax ID: {company.taxId}</p>}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-blue-700">{docType}</h2>
          <p className="text-sm text-gray-500 mt-1">#{data.documentNumber}</p>
        </div>
      </div>

      {/* ── Document Info ─────────────────────── */}
      <div className="flex justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Bill To
          </h3>
          <p className="mt-1 text-base font-medium">{data.customerName}</p>
        </div>
        <div className="text-right text-sm text-gray-600 space-y-0.5">
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
            <th className="text-left py-2 px-3 font-semibold text-gray-700">
              Product
            </th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">
              Qty
            </th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">
              Unit Price
            </th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">
              Discount
            </th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">
              Tax
            </th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">
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
                <td className="py-2 px-3">
                  <div className="font-medium">
                    {line.variant_name || "Product"}
                  </div>
                  <div className="text-xs text-gray-400">
                    SKU: {line.variant_sku || "—"}
                  </div>
                </td>
                <td className="py-2 px-3 text-right">{line.quantity}</td>
                <td className="py-2 px-3 text-right">
                  {formatCurrency(line.unit_price)}
                </td>
                <td className="py-2 px-3 text-right">
                  {discount > 0 ? formatCurrency(discount) : "—"}
                </td>
                <td className="py-2 px-3 text-right">{line.tax_rate}%</td>
                <td className="py-2 px-3 text-right font-medium">
                  {formatCurrency(lineTotal)}
                </td>
              </tr>
            );
          })}
          {data.lines.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="py-8 text-center text-gray-400"
              >
                No items
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300">
            <td colSpan={5} className="py-2 px-3 text-right font-semibold">
              Subtotal
            </td>
            <td className="py-2 px-3 text-right">
              {formatCurrency(calcSubtotal)}
            </td>
          </tr>
          {calcDiscount > 0 && (
            <tr className="border-t border-gray-200">
              <td
                colSpan={5}
                className="py-2 px-3 text-right font-semibold text-red-600"
              >
                Discount
              </td>
              <td className="py-2 px-3 text-right text-red-600">
                -{formatCurrency(calcDiscount)}
              </td>
            </tr>
          )}
          <tr className="border-t border-gray-200">
            <td colSpan={5} className="py-2 px-3 text-right font-bold text-lg">
              Total
            </td>
            <td className="py-2 px-3 text-right font-bold text-lg text-blue-700">
              {formatCurrency(data.totalAmount)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── Notes ────────────────────────────── */}
      {data.notes && (
        <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200 text-sm text-gray-600">
          <span className="font-semibold text-gray-700">Notes:</span>{" "}
          {data.notes}
        </div>
      )}

      {/* ── Terms & Conditions ───────────────── */}
      {termsContent && (
        <div className="border-t-2 border-gray-300 pt-4 mt-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Terms & Conditions
          </h3>
          <div
            className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: termsContent }}
          />
        </div>
      )}
    </div>
  );
}

// ── PDF Generator ──────────────────────────────────

async function generatePdf(
  data: QuoteInvoiceDocumentProps,
): Promise<Blob> {
  const { data: docData, company, termsContent, formatCurrency } = data;
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  // ── Header ──
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(company.companyName, margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(company.address, margin, y);
  y += 4;
  doc.text(`${company.phone}  |  ${company.email}`, margin, y);
  y += 4;
  if (company.taxId) {
    doc.text(`Tax ID: ${company.taxId}`, margin, y);
    y += 4;
  }

  // Document type & number (right-aligned)
  const docType = docData.type === "QUOTE" ? "QUOTE" : "INVOICE";
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text(docType, pageWidth - margin, margin, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`#${docData.documentNumber}`, pageWidth - margin, margin + 6, { align: "right" });

  y += 6;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Bill To & Dates ──
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50);
  doc.text("Bill To", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(docData.customerName, margin, y);
  y += 8;

  // Dates (right-aligned)
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Date: ${docData.date}`, pageWidth - margin, y - 13, { align: "right" });
  if (docData.type === "INVOICE" && docData.dueDate) {
    doc.text(`Due Date: ${docData.dueDate}`, pageWidth - margin, y - 8, { align: "right" });
  }
  if (docData.type === "QUOTE" && docData.expirationDate) {
    doc.text(`Expires: ${docData.expirationDate}`, pageWidth - margin, y - 8, { align: "right" });
  }

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
      textColor: [55, 65, 81],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
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

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);

  const totalX = pageWidth - margin;
  doc.text("Subtotal", totalX - 40, finalY);
  doc.text(formatCurrency(calcSubtotal), totalX, finalY, { align: "right" });

  let nextY = finalY + 5;
  if (calcDiscount > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text("Discount", totalX - 40, nextY);
    doc.text(`-${formatCurrency(calcDiscount)}`, totalX, nextY, {
      align: "right",
    });
    nextY += 5;
  }

  doc.setDrawColor(200);
  doc.line(totalX - 40, nextY, totalX, nextY);
  nextY += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(37, 99, 235);
  doc.text("Total", totalX - 40, nextY);
  doc.text(formatCurrency(docData.totalAmount), totalX, nextY, {
    align: "right",
  });

  // ── Notes ──
  if (docData.notes) {
    nextY += 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
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
    doc.setTextColor(50);
    doc.text("Terms & Conditions", margin, nextY);
    nextY += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);

    const stripped = termsContent.replace(/<[^>]*>/g, "");
    const lines = doc.splitTextToSize(stripped, pageWidth - 2 * margin);
    doc.text(lines, margin, nextY);
  }

  return doc.output("blob");
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

    const style = `
      <style>
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; }
        @page { margin: 15mm; }
        * { box-sizing: border-box; }
      </style>
    `;

    const contentEl = contentRef.current;
    if (!contentEl) return;

    const html = `
      <html>
        <head>${style}</head>
        <body>${contentEl.innerHTML}</body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
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
