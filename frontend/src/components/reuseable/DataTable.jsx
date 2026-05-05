// ============================================
// FILE: src/components/reuseable/DataTable.jsx
// ============================================

"use client";

import { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, Download, Filter, X } from "lucide-react";

/**
 * @param {object} props
 * @param {any[]} props.data
 * @param {any[]} props.columns
 * @param {function} [props.onEdit]
 * @param {function} [props.onDelete]
 * @param {function} [props.onView]
 * @param {function} [props.onExport]
 * @param {string} [props.title]
 * @param {string} [props.subtitle]
 * @param {any} [props.actions]
 * @param {boolean} [props.searchable]
 * @param {any[]} [props.searchFields]
 * @param {number} [props.defaultPageSize]
 * @param {boolean} [props.showPagination]
 */
export default function DataTable({
  data = [],
  columns = [],
  onEdit = null,
  onDelete = null,
  onView = null,
  onExport = null,


  title = "",
  subtitle = "",
  actions = null,
  searchable = true,
  searchFields = [],
  defaultPageSize = 10,
  showPagination = true,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  // Filter data
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    
    const searchFieldsToUse = searchFields.length > 0 
      ? searchFields 
      : columns.map(col => col.key).filter(key => key !== "actions");
    
    return data.filter(row => {
      return searchFieldsToUse.some(field => {
        const value = row[field];
        if (!value) return false;
        return String(value).toLowerCase().includes(searchTerm.toLowerCase());
      });
    });
  }, [data, searchTerm, searchFields, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize, showPagination]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key) => {
    if (sortColumn === key) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(key);
      setSortDirection("asc");
    }
  };

  const handleExport = () => {
    if (onExport) {
      onExport(sortedData);
    } else {
      // Default CSV export
      const headers = columns.filter(col => col.key !== "actions").map(col => col.label);
      const csvData = sortedData.map(row => 
        columns.filter(col => col.key !== "actions").map(col => row[col.key] || "")
      );
      const csv = [headers, ...csvData].map(row => row.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.toLowerCase().replace(/\s/g, "_")}_export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const getBadgeClass = (value) => {
    const str = String(value).toLowerCase();
    if (["active", "published", "paid", "completed", "true", "approved"].some(v => str === v || str.includes(v))) {
      return "bg-success/15 text-success border-success/30";
    }
    if (["inactive", "draft", "pending", "partial", "false", "discontinued"].some(v => str === v || str.includes(v))) {
      return "bg-warning/15 text-warning border-warning/30";
    }
    if (["disabled", "deleted", "cancelled", "archived", "rejected"].some(v => str.includes(v))) {
      return "bg-destructive/15 text-destructive border-destructive/30";
    }
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm">
      {/* Header */}
      {(title || searchable || actions) && (
        <div className="p-4 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              {title && <h2 className="text-lg font-semibold">{title}</h2>}
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {searchable && (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search..."
                    className="pl-9 pr-3 h-9 rounded-md border border-border bg-muted/40 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              )}
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-muted"
              >
                <Download className="w-4 h-4" /> Export
              </button>
              {actions}
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="px-4 py-2 border-b border-border flex justify-between items-center text-sm">
        <span className="text-muted-foreground">
          {filteredData.length} record{filteredData.length !== 1 ? "s" : ""}
          {searchTerm && ` (filtered from ${data.length})`}
        </span>
        {showPagination && totalPages > 1 && (
          <span className="text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left px-4 py-3 font-medium text-muted-foreground ${
                    col.sortable !== false ? "cursor-pointer select-none" : ""
                  }`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortColumn === col.key && (
                      <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
              ))}
              {(onEdit || onDelete || onView) && (
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onEdit || onDelete || onView ? 1 : 0)}
                  className="text-center py-12 text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center">
                      <Search className="w-6 h-6" />
                    </div>
                    <p>No records found</p>
                    <p className="text-xs">Try adjusting your search or filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr key={row.id || idx} className="border-b border-border hover:bg-muted/30 transition">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render ? (
                        col.render(row[col.key], row)
                      ) : col.badge ? (
                        <span className={`inline-flex px-2 py-0.5 text-xs rounded-full border ${getBadgeClass(row[col.key])}`}>
                          {row[col.key] || "—"}
                        </span>
                      ) : (
                        <span className="truncate block max-w-xs">
                          {row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : "—"}
                        </span>
                      )}
                    </td>
                  ))}
                  {(onEdit || onDelete || onView) && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {onView && (
                          <button
                            onClick={() => onView(row)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="View"
                          >
                            👁️
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary"
                            title="Edit"
                          >
                            ✏️
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(row)}
                            className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="p-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-muted/40 border border-border rounded-md px-2 py-1 text-sm"
            >
              {[5, 10, 25, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-md border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}