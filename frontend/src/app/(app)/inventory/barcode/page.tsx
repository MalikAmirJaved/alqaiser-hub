"use client";

import { useState } from "react";
import { useBarcodes, type BarcodeItem } from "@/hooks/useBarcodes";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import { Search, Printer } from "lucide-react";

export default function BarcodesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useBarcodes(debouncedSearch, page, pageSize);
  const items = (data?.results || []) as (BarcodeItem & Record<string, unknown>)[];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Stats: total variants, variants with barcode, without barcode
  const totalVariants = totalCount;
  const withBarcode = items.filter(i => i.barcode && i.barcode.trim() !== "").length;
  const withoutBarcode = totalVariants - withBarcode;

  const stats = [
    { id: "total", label: "Total Variants", value: totalVariants, valueClassName: "" },
    { id: "with", label: "With Barcode", value: withBarcode, valueClassName: "text-green-600" },
    { id: "without", label: "Missing Barcode", value: withoutBarcode, valueClassName: "text-red-600" },
  ];

  const handleSearch = () => {
    setDebouncedSearch(search);
    setPage(1);
  };

  const handlePrint = (barcode: string, sku: string) => {
    // You can implement a print dialog or open a barcode image generator
    // For now, just console log
    console.log("Print barcode:", barcode, sku);
    // Example: window.open(`/api/inventory/barcodes/print/?barcode=${barcode}`, "_blank");
  };

  const columns: Column<BarcodeItem & Record<string, unknown>>[] = [
    { key: "product_name", label: "Product" },
    { key: "sku", label: "SKU" },
    { key: "barcode", label: "Barcode", render: (_, row) => row.barcode || "—" },
    {
      key: "actions",
      label: "",
      render: (_, row) =>
        row.barcode ? (
          <Button variant="ghost" size="sm" onClick={() => handlePrint(row.barcode, row.sku)}>
            <Printer className="h-4 w-4" />
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Barcode Directory" subtitle="All product variants and their barcodes" />

      <StatsCards stats={stats} />

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            placeholder="Search by product, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch}>
          <Search className="h-4 w-4 mr-2" /> Search
        </Button>
      </div>

      <TableView
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage="No barcodes found."
      />
    </div>
  );
}