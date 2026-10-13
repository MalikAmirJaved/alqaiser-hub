import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/**
 * Renders the invoice in a blank iframe so Tailwind's oklch/oklab stylesheets
 * are never parsed by html2canvas (which cannot handle those color functions).
 * InvoicePreview already uses inline hex colours, so no external CSS is needed.
 */
async function rasterizeInvoice(element: HTMLElement): Promise<HTMLCanvasElement> {
  const width = Math.max(element.scrollWidth, element.offsetWidth, 794);
  const height = Math.max(element.scrollHeight, element.offsetHeight, 1);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${width}px`,
    `height:${height + 40}px`,
    "border:0",
    "opacity:0",
    "pointer-events:none",
  ].join(";");

  document.body.appendChild(iframe);

  const idoc = iframe.contentDocument;
  const iwin = iframe.contentWindow;
  if (!idoc || !iwin) {
    iframe.remove();
    throw new Error("Could not create export frame.");
  }

  idoc.open();
  idoc.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="margin:0;background:#ffffff;"></body></html>`,
  );
  idoc.close();

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.transform = "none";
  clone.style.boxShadow = "none";
  clone.style.margin = "0";
  clone.style.width = `${width}px`;
  idoc.body.appendChild(clone);

  // Let the iframe finish layout before capturing.
  await new Promise<void>((resolve) => {
    iwin.requestAnimationFrame(() => iwin.requestAnimationFrame(() => resolve()));
  });

  try {
    return await html2canvas(clone, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: true,
      logging: false,
      width,
      height: clone.scrollHeight || height,
      windowWidth: width,
      windowHeight: clone.scrollHeight || height,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        // Belt-and-suspenders: drop any styles that slipped in.
        clonedDoc.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => node.remove());
      },
    });
  } finally {
    iframe.remove();
  }
}

/**
 * Rasterises the on-screen invoice document and writes it into an A4 PDF.
 * Multi-page safe: tall documents are sliced across pages.
 */
export async function exportInvoicePdf(element: HTMLElement, fileName: string) {
  const canvas = await rasterizeInvoice(element);

  if (!canvas.width || !canvas.height) {
    throw new Error("Could not render the invoice preview.");
  }

  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= pageHeight) {
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, imgWidth, imgHeight);
  } else {
    const pageCanvasHeight = Math.floor((canvas.width * pageHeight) / pageWidth);
    let offset = 0;
    let first = true;
    while (offset < canvas.height) {
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.min(pageCanvasHeight, canvas.height - offset);
      const ctx = slice.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, -offset);
      if (!first) pdf.addPage();
      pdf.addImage(
        slice.toDataURL("image/jpeg", 0.92),
        "JPEG",
        0,
        0,
        imgWidth,
        (slice.height * imgWidth) / slice.width,
      );
      first = false;
      offset += slice.height;
    }
  }

  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

export function safeFileName(invoiceNumber: string, client: string) {
  const clean = (v: string) =>
    v
      .trim()
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-|-$/g, "");
  return `invoice-${clean(invoiceNumber) || "draft"}${client ? `-${clean(client)}` : ""}.pdf`.toLowerCase();
}
