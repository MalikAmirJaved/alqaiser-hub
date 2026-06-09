"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download, ChevronLeft, ChevronRight, ArrowUpDown, Search } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface ReportTableProps {
  headers: string[];
  keys: string[];
  data: any[];
  title: string;
  loading?: boolean;
  currency?:string;
}

export function ReportTable({ headers, keys, data, title, loading = false, currency='$' }: ReportTableProps) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  // Handle Search
  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter((row) =>
      keys.some((key) => {
        const val = row[key];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(search.toLowerCase());
      })
    );
  }, [data, keys, search]);

  // Handle Sort
  const sortedData = useMemo(() => {
    const sortableItems = [...filteredData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        const aNum = Number(aVal);
        const bNum = Number(bVal);

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
        }

        const strA = String(aVal).toLowerCase();
        const strB = String(bVal).toLowerCase();

        if (strA < strB) return sortConfig.direction === "asc" ? -1 : 1;
        if (strA > strB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  // Handle Pagination
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return sortedData.slice(startIdx, startIdx + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;

  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const exportToCSV = () => {
    if (!sortedData || sortedData.length === 0) {
      toast.warning("No data to export");
      return;
    }
    const rows = sortedData.map((item) => keys.map((key) => item[key]));
    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  const exportToExcel = () => {
    if (!sortedData || sortedData.length === 0) {
      toast.warning("No data to export");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(
      sortedData.map((item) => {
        const obj: any = {};
        headers.forEach((h, i) => {
          obj[h] = item[keys[i]];
        });
        return obj;
      })
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
    toast.success("Excel exported successfully");
  };

  const exportToPDF = () => {
    if (!sortedData || sortedData.length === 0) {
      toast.warning("No data to export");
      return;
    }
    const doc = new jsPDF();
    doc.text(title, 14, 15);
    doc.text(`Generated: ${format(new Date(), "PPPpp")}`, 14, 23);
    autoTable(doc, {
      startY: 30,
      head: [headers],
      body: sortedData.map((item) => keys.map((key) => {
        const val = item[key];
        return typeof val === "number" ? val : String(val);
      })),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });
    doc.save(`${title.toLowerCase().replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    toast.success("PDF exported successfully");
  };

  return (
    <div className="space-y-4">
      {/* Filters and Exports */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search report records..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <Download className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Table Container */}
      <div className="border rounded-lg overflow-x-auto bg-card">
        <table className="w-full text-sm border-collapse text-left">
          <thead className="bg-muted text-muted-foreground font-semibold border-b">
            <tr>
              {headers.map((header, idx) => (
                <th
                  key={idx}
                  onClick={() => requestSort(keys[idx])}
                  className="p-3 cursor-pointer select-none hover:bg-muted/80 transition-colors"
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs tracking-wider uppercase">
                    {header}
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={headers.length} className="p-8 text-center text-muted-foreground">
                  <div className="flex justify-center items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                    Loading report details...
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="p-8 text-center text-muted-foreground">
                  No records found matching filters
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {keys.map((key, colIdx) => {
                    const value = row[key];
                    let displayValue = String(value);

                    // Formatter logic
                    if (key.includes("amount") || key.includes("revenue") || key.includes("cogs") || key.includes("profit") || key.includes("value") || key.includes("cost")) {
                      const numVal = Number(value);
                      displayValue = !isNaN(numVal) ? `${currency} ${numVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${value}`;
                    } else if (key.includes("rate") || key.includes("percent")) {
                      const numVal = Number(value);
                      displayValue = !isNaN(numVal) ? `${numVal}%` : `${value}%`;
                    }

                    // Highlight dynamic statuses
                    if (key === "status") {
                      return (
                        <td key={colIdx} className="p-3 font-medium">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                              value === "HEALTHY" || value === "active"
                                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                                : value === "SLOW_MOVING"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
                                : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            }`}
                          >
                            {displayValue}
                          </span>
                        </td>
                      );
                    }

                    return (
                      <td key={colIdx} className="p-3">
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
        <div>
          Showing <span className="font-semibold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to{" "}
          <span className="font-semibold text-foreground">
            {Math.min(currentPage * pageSize, sortedData.length)}
          </span>{" "}
          of <span className="font-semibold text-foreground">{sortedData.length}</span> entries
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs">Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-card border rounded p-1 text-xs"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
