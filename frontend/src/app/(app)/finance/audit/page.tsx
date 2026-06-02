"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useAuditLogs } from "@/hooks/finance/useAuditLogs";

const columns: Column[] = [
  { key: "created_at", label: "Timestamp", sortable: true },
  { key: "action", label: "Action" },
  { key: "entity_type", label: "Entity" },
  { key: "entity_id", label: "Entity ID" },
  { key: "user_id", label: "User ID" },
];

export default function AuditLogsPage() {
  const permissions = useFeaturePermissions("FINANCE", "auditlog");

  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ✅ pagination state (FIX)
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAuditLogs({
    entity_type: entityType || undefined,
    action: action || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    source_module: "finance",
    page,
  });

  const logs = data?.results || [];
  const tableData = logs.map((log) => ({ ...log })) as Record<string, unknown>[];

  const pageSize = 20; // adjust if backend differs
  const totalPages = data ? Math.ceil(data.count / pageSize) : 1;

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Audit Logs" subtitle="Track all changes to financial records" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-sm border border-border rounded-md"
        >
          <option value="">All Entities</option>
          <option value="account">Account</option>
          <option value="supplierbill">Supplier Bill</option>
          <option value="customerinvoice">Customer Invoice</option>
          <option value="payment">Payment</option>
          <option value="expense">Expense</option>
        </select>

        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-sm border border-border rounded-md"
        >
          <option value="">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-sm border border-border rounded-md"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-sm border border-border rounded-md"
        />
      </div>

      {/* Table */}
      <TableView
        columns={columns}
        data={tableData}
        loading={isLoading}
        actions={() => null}
      />

      {/* Pagination */}
      {data && (
        <div className="flex justify-between items-center mt-4 text-sm">
          <span>
            Page {page} of {totalPages} • Total {data.count}
          </span>

          <div className="flex gap-2">
            <button
              disabled={!data.previous}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="px-3 py-1 border rounded-md disabled:opacity-50"
            >
              Previous
            </button>

            <button
              disabled={!data.next}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border rounded-md disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}