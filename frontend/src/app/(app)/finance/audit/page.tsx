"use client";

import { useState } from "react";
import { useAuditLogs, type AuditLog } from "@/hooks/useAuditLogs";
import {
  TableView,
  type Column,
} from "@/components/reuseable/TableGridView";
import { StatsCards } from "@/components/reuseable/StatsCards";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";
import { Eye } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default function AuditLogsPage() {
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    { name: "action", label: "Action", type: "select", options: [
      { value: "CREATE", label: "Create" },
      { value: "UPDATE", label: "Update" },
      { value: "DELETE", label: "Delete" },
    ]},
    { name: "entity_type", label: "Entity", type: "select", options: [
      { value: "account", label: "Account" },
      { value: "customerinvoice", label: "Customer Invoice" },
      { value: "supplierbill", label: "Supplier Bill" },
      { value: "payment", label: "Payment" },
      { value: "journalentry", label: "Journal Entry" },
      { value: "expense", label: "Expense" },
      { value: "bankaccount", label: "Bank Account" },
      { value: "banktransaction", label: "Bank Transaction" },
      { value: "budget", label: "Budget" },
    ]},
    { name: "start_date", label: "From", type: "date" },
    { name: "end_date", label: "To", type: "date" },
  ];

  const apiFilters = {
    search: filterState.search || undefined,
    action: filterState.action || undefined,
    entity_type: filterState.entity_type || undefined,
    start_date: filterState.start_date || undefined,
    end_date: filterState.end_date || undefined,
    page,
    page_size: 20,
  };

  const { data, isLoading } = useAuditLogs(apiFilters);

  const logs = (data?.results || []) as (AuditLog & Record<string, unknown>)[];
  const totalCount = data?.count || 0;

  const createCount = logs.filter((l) => l.action === "CREATE").length;
  const updateCount = logs.filter((l) => l.action === "UPDATE").length;
  const deleteCount = logs.filter((l) => l.action === "DELETE").length;
  const uniqueUsers = new Set(logs.map((l) => l.user_id)).size;

  const stats = [
    { id: "total", label: "Total Events", value: totalCount, valueClassName: "" },
    { id: "create", label: "Creates", value: createCount, valueClassName: "text-green-600" },
    { id: "update", label: "Updates", value: updateCount, valueClassName: "text-blue-600" },
    { id: "delete", label: "Deletes", value: deleteCount, valueClassName: "text-red-600" },
    { id: "users", label: "Active Users", value: uniqueUsers, valueClassName: "" },
  ];

  const columns: Column<AuditLog & Record<string, unknown>>[] = [
    {
      key: "created_at",
      label: "Timestamp",
      render: (_, row) =>
        format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss"),
    },
    {
      key: "user_name",
      label: "User",
      render: (_, row) => row.user_name || `User ${row.user_id}`,
    },
    {
      key: "action_display",
      label: "Action",
      render: (_, row) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            row.action === "CREATE"
              ? "bg-green-100 text-green-800"
              : row.action === "UPDATE"
              ? "bg-blue-100 text-blue-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {row.action_display}
        </span>
      ),
    },
    {
      key: "entity_type",
      label: "Entity",
      render: (_, row) => (
        <span className="capitalize">
          {(row.entity_type as string).replace(/_/g, " ")}
        </span>
      ),
    },
    {
      key: "entity_name",
      label: "Entity Name",
      render: (val, _row) => (
        <span className="font-medium">
          {String(val || "—")}
        </span>
      ),
    },
    {
      key: "ip_address",
      label: "IP Address",
    },
    {
      key: "actions",
      label: "",
      render: (_, row) => (
        <Link href={`/finance/audit/${row.id}`}>
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4" />
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        subtitle="Track all changes across the financial system"
      />

      <StatsCards stats={stats} />

      <FilterBar
        fields={filterFields}
        filters={filterState}
        onChange={setFilterState}
      />

      <TableView
        columns={columns}
        data={logs}
        loading={isLoading}
        emptyMessage="No audit logs found."
      />
    </div>
  );
}
