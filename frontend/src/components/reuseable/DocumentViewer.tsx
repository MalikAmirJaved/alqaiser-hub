"use client";

import { useState, useEffect, useRef } from "react";
import { X, Download, FileText, FileImage, FileSpreadsheet, File, ExternalLink, Loader2 } from "lucide-react";
import { BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Document, Page, pdfjs } from "react-pdf";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface DocumentViewerProps {
  open: boolean;
  onClose: () => void;
  url: string;
  filename?: string;
  mimeType?: string;
  title?: string;
}

const getFileIcon = (url: string, mimeType?: string) => {
  const ext = url.split(".").pop()?.toLowerCase();
  if (mimeType?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || ""))
    return FileImage;
  if (["pdf"].includes(ext || "")) return FileText;
  if (["xls", "xlsx", "csv"].includes(ext || "")) return FileSpreadsheet;
  if (["doc", "docx"].includes(ext || "")) return FileText;
  return File;
};

const getFileType = (url: string, mimeType?: string): "image" | "pdf" | "xlsx" | "docx" | "text" | "other" => {
  if (mimeType?.startsWith("image/")) return "image";
  const ext = url.split(".").pop()?.toLowerCase();
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (mimeType?.includes("spreadsheet") || ["xls", "xlsx"].includes(ext || "")) return "xlsx";
  if (mimeType?.includes("document") || ["doc", "docx"].includes(ext || "")) return "docx";
  if (mimeType === "text/plain" || ext === "txt") return "text";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) return "image";
  return "other";
};

function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageWidth, setPageWidth] = useState(600);

  useEffect(() => {
    setPageWidth(Math.min(window.innerWidth - 80, 900));
  }, []);

  return (
    <div className="flex flex-col items-center w-full min-h-[400px]">
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }
        error={
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="w-12 h-12 text-destructive mb-3" />
            <p className="text-sm text-muted-foreground">Failed to load PDF</p>
          </div>
        }
      >
        <Page
          pageNumber={pageNumber}
          width={pageWidth}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          className="shadow-lg rounded-lg overflow-hidden"
        />
      </Document>
      {numPages > 1 && (
        <div className="flex items-center gap-3 mt-4 pb-4">
          <button
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            className="px-3 h-8 rounded-md border border-border text-xs hover:bg-muted disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {pageNumber} of {numPages}
          </span>
          <button
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            className="px-3 h-8 rounded-md border border-border text-xs hover:bg-muted disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function XlsxViewer({ url }: { url: string }) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const htmlStr = XLSX.utils.sheet_to_html(firstSheet, { id: "xlsx-viewer" });
        setHtml(htmlStr);
      })
      .catch(() => setError(true));
  }, [url]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileSpreadsheet className="w-12 h-12 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground">Failed to load spreadsheet</p>
        <a
          href={url}
          download
          className="mt-3 inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm"
        >
          <Download className="w-4 h-4" /> Download
        </a>
      </div>
    );
  }

  return (
    <div
      className="w-full overflow-auto p-4"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        ["--xlsx-border" as string]: "var(--border)",
        ["--xlsx-header-bg" as string]: "var(--muted)",
      }}
    />
  );
}

function DocxViewer({ url }: { url: string }) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buffer) => mammoth.convertToHtml({ arrayBuffer: buffer }))
      .then((result) => setHtml(result.value))
      .catch(() => setError(true));
  }, [url]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="w-12 h-12 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground">Failed to load document</p>
        <a
          href={url}
          download
          className="mt-3 inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm"
        >
          <Download className="w-4 h-4" /> Download
        </a>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="w-full p-6 prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function DocumentViewer({ open, onClose, url, filename, mimeType, title }: DocumentViewerProps) {
  const [loading, setLoading] = useState(true);
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
  const displayName = filename || url.split("/").pop() || "Document";
  const Icon = getFileIcon(url, mimeType);
  const fileType = getFileType(url, mimeType);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setTimeout(() => setLoading(false), 500);
    }
  }, [open, url]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate">{title || displayName}</h3>
              {title && <p className="text-xs text-muted-foreground truncate">{displayName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={fullUrl}
              download={displayName}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md hover:bg-muted transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </a>
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md hover:bg-muted transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div ref={contentRef} className="flex-1 overflow-auto bg-muted/20 min-h-[300px] flex items-start justify-center relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/50 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {fileType === "image" ? (
            <img
              src={fullUrl}
              alt={displayName}
              className={cn(
                "max-w-full max-h-full object-contain p-4",
                "transition-opacity duration-200",
                loading ? "opacity-0" : "opacity-100"
              )}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          ) : fileType === "pdf" ? (
            <PdfViewer url={fullUrl} />
          ) : fileType === "xlsx" ? (
            <XlsxViewer url={fullUrl} />
          ) : fileType === "docx" ? (
            <DocxViewer url={fullUrl} />
          ) : fileType === "text" ? (
            <RawTextViewer url={fullUrl} />
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Icon className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">{displayName}</p>
              <p className="text-xs text-muted-foreground mb-4">
                Preview not available for this file type
              </p>
              <a
                href={fullUrl}
                download={displayName}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
              >
                <Download className="w-4 h-4" />
                Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RawTextViewer({ url }: { url: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(url)
      .then((res) => res.text())
      .then(setText)
      .catch(() => setError(true));
  }, [url]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="w-12 h-12 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground">Failed to load file</p>
      </div>
    );
  }

  return (
    <pre className="w-full p-6 text-sm font-mono whitespace-pre-wrap break-words max-h-[80vh] overflow-auto">
      {text || "Loading..."}
    </pre>
  );
}
