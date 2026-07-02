"use client";

import { useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Receipt } from "lucide-react";

// ── Types ──────────────────────────────────────────

export interface ThermalReceiptLine {
  variant_name: string;
  variant_sku?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ThermalReceiptData {
  orderNumber: string;
  date: string;
  time: string;
  customerName?: string;
  lines: ThermalReceiptLine[];
  totalAmount: number;
  paymentMethod?: string;
  paidAmount?: number;
  changeAmount?: number;
  isReturn?: boolean;
}

interface ThermalReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: ThermalReceiptData;
  companyName: string;
  formatCurrency: (value: number | string) => string;
}

// ── Receipt Content (also used directly for auto-print) ──

export function ThermalReceiptContent({
  data,
  companyName,
  formatCurrency,
}: {
  data: ThermalReceiptData;
  companyName: string;
  formatCurrency: (value: number | string) => string;
}) {
  return (
    <div className="thermal-receipt bg-white text-black p-4 font-mono text-xs leading-relaxed max-w-[80mm] mx-auto">
      {/* Header */}
      <div className="text-center mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider">
          {companyName || "Store"}
        </h2>
        <div className="border-t border-dashed border-gray-400 my-2" />
        <p className="text-[10px]">{data.isReturn ? "RETURN RECEIPT" : "SALE RECEIPT"}</p>
        <p className="text-[10px]">#{data.orderNumber}</p>
        <p className="text-[10px]">
          {data.date} {data.time}
        </p>
        {data.customerName && (
          <p className="text-[10px] mt-1">Customer: {data.customerName}</p>
        )}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2" />

      {/* Items */}
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-dashed border-gray-300">
            <th className="text-left py-1 font-semibold">Item</th>
            <th className="text-center py-1 font-semibold">Qty</th>
            <th className="text-right py-1 font-semibold">Price</th>
            <th className="text-right py-1 font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, idx) => (
            <tr key={idx}>
              <td className="py-1 pr-1 truncate max-w-[120px]">
                {line.variant_name}
              </td>
              <td className="py-1 text-center">{line.quantity}</td>
              <td className="py-1 text-right">{formatCurrency(line.unit_price)}</td>
              <td className="py-1 text-right">{formatCurrency(line.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-gray-400 my-2" />

      {/* Total */}
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{formatCurrency(data.totalAmount)}</span>
      </div>

      {data.paymentMethod && (
        <div className="flex justify-between text-[10px] mt-1">
          <span>Paid via {data.paymentMethod}</span>
          <span>{data.paidAmount ? formatCurrency(data.paidAmount) : formatCurrency(data.totalAmount)}</span>
        </div>
      )}
      {data.changeAmount && data.changeAmount > 0 && (
        <div className="flex justify-between text-[10px]">
          <span>Change</span>
          <span>{formatCurrency(data.changeAmount)}</span>
        </div>
      )}

      <div className="border-t border-dashed border-gray-400 my-3" />

      {/* Footer */}
      <div className="text-center text-[9px] text-gray-600 space-y-0.5">
        {data.isReturn ? (
          <p>Return processed successfully</p>
        ) : (
          <>
            <p>Thank you for your purchase!</p>
            <p>Goods sold are not returnable</p>
          </>
        )}
        <p className="font-mono text-[7px] mt-1 tracking-widest">
          {data.orderNumber.replace(/[^A-Za-z0-9]/g, "*")}
        </p>
      </div>
    </div>
  );
}

// ── Print function (uses hidden iframe — no new tab, no auto-close) ──

export function printThermalReceipt(
  data: ThermalReceiptData,
  companyName: string,
  formatCurrency: (value: number | string) => string,
) {
  const receiptHtml = buildReceiptHtml(data, companyName, formatCurrency);
  printHtml(receiptHtml);
}

/** Build the standalone receipt HTML string */
function buildReceiptHtml(
  data: ThermalReceiptData,
  companyName: string,
  formatCurrency: (value: number | string) => string,
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Receipt</title>
      <style>
        @page { width: 80mm; margin: 0; }
        @media print { body { margin: 0; padding: 0; } }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px; line-height: 1.4; color: #000; background: #fff;
          width: 80mm; margin: 0 auto; padding: 4mm; box-sizing: border-box;
        }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { text-align: left; font-weight: 600; border-bottom: 1px dashed #999; padding: 2px 0; }
        td { padding: 2px 0; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .my-1 { margin-top: 2px; margin-bottom: 2px; }
        .my-2 { margin-top: 4px; margin-bottom: 4px; }
        .my-3 { margin-top: 6px; margin-bottom: 6px; }
        .py-1 { padding-top: 2px; padding-bottom: 2px; }
        .text-sm { font-size: 13px; }
        .text-xs { font-size: 11px; }
        .font-bold { font-weight: 700; }
        .font-mono { font-family: 'Courier New', Courier, monospace; }
        .uppercase { text-transform: uppercase; }
        .tracking-wider { letter-spacing: 0.05em; }
        .tracking-widest { letter-spacing: 0.1em; }
        .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }
        .text-gray-600 { color: #666; }
        .mt-1 { margin-top: 2px; }
        .mb-3 { margin-bottom: 6px; }
      </style>
    </head>
    <body>
      <div class="text-center mb-3">
        <h2 class="text-sm font-bold uppercase tracking-wider">${escapeHtml(companyName || "Store")}</h2>
        <div style="border-top: 1px dashed #999; margin: 4px 0;"></div>
        <p class="text-xs">${data.isReturn ? "RETURN RECEIPT" : "SALE RECEIPT"}</p>
        <p class="text-xs">#${escapeHtml(data.orderNumber)}</p>
        <p class="text-xs">${escapeHtml(data.date)} ${escapeHtml(data.time)}</p>
        ${data.customerName ? `<p class="text-xs mt-1">Customer: ${escapeHtml(data.customerName)}</p>` : ""}
      </div>

      <div style="border-top: 1px dashed #999; margin: 4px 0;"></div>

      <table>
        <thead>
          <tr><th class="text-left py-1">Item</th><th class="text-center py-1">Qty</th><th class="text-right py-1">Price</th><th class="text-right py-1">Total</th></tr>
        </thead>
        <tbody>
          ${data.lines.map((line) => `
            <tr>
              <td class="py-1 truncate">${escapeHtml(line.variant_name)}</td>
              <td class="py-1 text-center">${line.quantity}</td>
              <td class="py-1 text-right">${formatCurrency(line.unit_price)}</td>
              <td class="py-1 text-right">${formatCurrency(line.total)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div style="border-top: 1px dashed #999; margin: 4px 0;"></div>

      <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700;">
        <span>TOTAL</span>
        <span>${formatCurrency(data.totalAmount)}</span>
      </div>

      ${data.paymentMethod ? `
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 2px;">
          <span>Paid via ${escapeHtml(data.paymentMethod)}</span>
          <span>${data.paidAmount ? formatCurrency(data.paidAmount) : formatCurrency(data.totalAmount)}</span>
        </div>
      ` : ""}
      ${data.changeAmount && data.changeAmount > 0 ? `
        <div style="display: flex; justify-content: space-between; font-size: 10px;">
          <span>Change</span>
          <span>${formatCurrency(data.changeAmount)}</span>
        </div>
      ` : ""}

      <div style="border-top: 1px dashed #999; margin: 6px 0;"></div>

      <div class="text-center text-gray-600" style="font-size: 9px;">
        ${data.isReturn ? '<p>Return processed successfully</p>' : '<p>Thank you for your purchase!</p><p>Goods sold are not returnable</p>'}
        <p style="font-family: 'Courier New', Courier, monospace; font-size: 7px; margin-top: 2px; letter-spacing: 0.1em;">
          ${data.orderNumber.replace(/[^A-Za-z0-9]/g, "*")}
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Print HTML content using a hidden iframe.
 * No new tab/window is opened. The browser's native print dialog appears,
 * and after the user acts on it the iframe is cleaned up automatically.
 */
let printIframeId = 0;
function printHtml(html: string) {
  const id = `thermal-print-iframe-${++printIframeId}`;

  // Create a hidden iframe
  const iframe = document.createElement("iframe");
  iframe.id = id;
  iframe.style.position = "absolute";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "80mm";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for content to render, then print
  const win = iframe.contentWindow;
  if (!win) {
    document.body.removeChild(iframe);
    return;
  }

  // Use matchMedia to detect when print dialog closes
  const mediaQuery = win.matchMedia("print");
  const cleanup = () => {
    // Remove the iframe after a short delay to ensure print job completes
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 500);
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", function listener(evt) {
      if (!evt.matches) {
        mediaQuery.removeEventListener("change", listener);
        cleanup();
      }
    });
  } else {
    // Fallback: cleanup after a timeout
    setTimeout(cleanup, 3000);
  }

  // Focus and print
  win.focus();
  setTimeout(() => {
    win.print();
  }, 300);
}

/** Simple HTML-escape to prevent injection in the standalone document */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Modal Component ──

export default function ThermalReceiptModal({
  open,
  onClose,
  data,
  companyName,
  formatCurrency,
}: ThermalReceiptModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    printThermalReceipt(data, companyName, formatCurrency);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
        <DialogTitle className="sr-only">Thermal Receipt</DialogTitle>

        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-gray-100 border-b px-4 py-3">
          <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Receipt Preview
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-1.5 h-4 w-4" />
              Print Receipt
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </div>

        {/* Receipt */}
        <div
          ref={contentRef}
          className="bg-gray-100 flex justify-center py-4"
          style={{ background: "#f3f4f6" }}
        >
          <div className="shadow-lg rounded-sm overflow-hidden">
            <ThermalReceiptContent
              data={data}
              companyName={companyName}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
