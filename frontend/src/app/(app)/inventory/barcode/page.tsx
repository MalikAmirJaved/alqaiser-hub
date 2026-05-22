"use client";

import { useRef, useState } from "react";
import Barcode from "react-barcode";
import jsPDF from "jspdf";

import { useBarcodes, type BarcodeItem } from "@/hooks/useBarcodes";
import {
  TableView,
  type Column,
} from "@/components/reuseable/TableGridView";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Search,
  Printer,
  Download,
  Barcode as BarcodeIcon,
} from "lucide-react";

export default function BarcodesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] =
    useState("");
  const [page, setPage] = useState(1);

  const [
    selectedBarcode,
    setSelectedBarcode,
  ] = useState<BarcodeItem | null>(null);

  const barcodeRef =
    useRef<HTMLDivElement>(null);

  const pageSize = 20;

  const { data, isLoading } = useBarcodes(
    debouncedSearch,
    page,
    pageSize
  );

  const items = (data?.results || []) as (
    BarcodeItem & Record<string, unknown>
  )[];

  const totalCount = data?.count || 0;

  // Stats
  const totalVariants = totalCount;

  const withBarcode = items.filter(
    (i) => i.barcode && i.barcode.trim() !== ""
  ).length;

  const withoutBarcode =
    totalVariants - withBarcode;

  const stats = [
    {
      id: "total",
      label: "Total Variants",
      value: totalVariants,
      valueClassName: "",
    },
    {
      id: "with",
      label: "With Barcode",
      value: withBarcode,
      valueClassName: "text-green-600",
    },
    {
      id: "without",
      label: "Missing Barcode",
      value: withoutBarcode,
      valueClassName: "text-red-600",
    },
  ];

  const handleSearch = () => {
    setDebouncedSearch(search);
    setPage(1);
  };

  const handleOpenBarcode = (
    row: BarcodeItem
  ) => {
    setSelectedBarcode(row);
  };

  // =========================
  // PRINT
  // =========================
  const handlePrint = () => {
    if (!barcodeRef.current) return;

    const printWindow = window.open(
      "",
      "_blank"
    );

    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode</title>

          <link
            rel="stylesheet"
            href="/globals.css"
          />

          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              padding: 20px;
              background: white;
              font-family: Arial, sans-serif;
            }

            .barcode-print-wrapper {
              width: 100%;
              max-width: 500px;
            }

            svg {
              width: 100% !important;
              height: auto !important;
            }
          </style>
        </head>

        <body>
          <div class="barcode-print-wrapper">
            ${barcodeRef.current.innerHTML}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // =========================
  // PDF DOWNLOAD
  // =========================
  const handleDownloadPDF = async () => {
    if (
      !barcodeRef.current ||
      !selectedBarcode
    )
      return;

    try {
      const svgElement =
        barcodeRef.current.querySelector(
          "svg"
        );

      if (!svgElement) return;

      const svgData =
        new XMLSerializer().serializeToString(
          svgElement
        );

      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });

      const url =
        URL.createObjectURL(svgBlob);

      const img = new Image();

      img.onload = () => {
        const canvas =
          document.createElement("canvas");

        canvas.width = img.width * 2;
        canvas.height = img.height * 2;

        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(
          0,
          0,
          canvas.width,
          canvas.height
        );

        ctx.drawImage(
          img,
          0,
          0,
          canvas.width,
          canvas.height
        );

        const imgData =
          canvas.toDataURL("image/png");

        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        // Theme-like styling
        pdf.setFillColor(248, 250, 252);

        pdf.roundedRect(
          10,
          10,
          190,
          90,
          4,
          4,
          "F"
        );

        pdf.setFontSize(18);

        pdf.text(
          selectedBarcode.product_name,
          15,
          25
        );

        pdf.setFontSize(12);

        pdf.text(
          `SKU: ${selectedBarcode.sku}`,
          15,
          35
        );

        pdf.addImage(
          imgData,
          "PNG",
          15,
          45,
          180,
          40
        );

        pdf.save(
          `${selectedBarcode.sku}-barcode.pdf`
        );

        URL.revokeObjectURL(url);
      };

      img.src = url;
    } catch (error) {
      console.error(
        "PDF generation failed:",
        error
      );
    }
  };

  const columns: Column<
    BarcodeItem & Record<string, unknown>
  >[] = [
    {
      key: "product_name",
      label: "Product",
    },

    {
      key: "sku",
      label: "SKU",
    },

    {
      key: "barcode",
      label: "Barcode",
      render: (_, row) =>
        row.barcode || "—",
    },

    {
      key: "actions",
      label: "",
      render: (_, row) =>
        row.barcode ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              handleOpenBarcode(row)
            }
          >
            <BarcodeIcon className="h-4 w-4" />
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Barcode Directory"
        subtitle="All product variants and their barcodes"
      />

      <StatsCards stats={stats} />

      {/* Search */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            placeholder="Search by product, SKU, or barcode..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            onKeyDown={(e) =>
              e.key === "Enter" &&
              handleSearch()
            }
          />
        </div>

        <Button onClick={handleSearch}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      {/* Table */}
      <TableView
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage="No barcodes found."
      />

      {/* Barcode Popup */}
      <Dialog
        open={!!selectedBarcode}
        onOpenChange={() =>
          setSelectedBarcode(null)
        }
      >
        <DialogContent
          className="
            sm:max-w-md
            bg-card
            text-card-foreground
            border-border
          "
        >
          <DialogHeader>
            <DialogTitle>
              Barcode Preview
            </DialogTitle>
          </DialogHeader>

          {selectedBarcode && (
            <div className="space-y-6">
              {/* Barcode Panel */}
              <div
                id="barcode-pdf"
                ref={barcodeRef}
                className="
                  barcode-panel
                  p-6
                  flex
                  flex-col
                  items-center
                  shadow-sm
                "
              >
                <h3 className="font-semibold text-lg text-center">
                  {
                    selectedBarcode.product_name
                  }
                </h3>

                <p
                  className="
                    text-sm
                    text-muted-foreground
                    mb-4
                  "
                >
                  SKU: {selectedBarcode.sku}
                </p>

                <div className="w-full overflow-x-auto flex justify-center">
                  <Barcode
                    value={
                      selectedBarcode.barcode
                    }
                    width={2}
                    height={80}
                    fontSize={16}
                    displayValue
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={handlePrint}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>

                <Button
                  onClick={
                    handleDownloadPDF
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}