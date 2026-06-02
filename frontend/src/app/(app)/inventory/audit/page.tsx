"use client";

import { useState } from "react";
import { useAuditLogs, type AuditLog } from "@/hooks/useAuditLogs";
import {
  TableView,
  type Column,
} from "@/components/reuseable/TableGridView";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";
import { Eye } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default function AuditLogsPage() {
  const [filters, setFilters] = useState({
    entity_type: "",
    action: "",
    start_date: "",
    end_date: "",
    page: 1,
    page_size: 20,
  });

  const { data, isLoading, error } = useAuditLogs(filters);

  // 👇 cast for TableView generic constraint
  const logs = (data?.results || []) as (AuditLog &
    Record<string, unknown>)[];

  const totalCount = data?.count || 0;

  // Stats
  const createCount = logs.filter((l) => l.action === "CREATE").length;
  const updateCount = logs.filter((l) => l.action === "UPDATE").length;
  const deleteCount = logs.filter((l) => l.action === "DELETE").length;
  const uniqueUsers = new Set(logs.map((l) => l.user_id)).size;

  // 👇 match StatCardData interface
  const stats = [
    {
      id: "total",
      label: "Total Events",
      value: totalCount,
      valueClassName: "",
    },
    {
      id: "create",
      label: "Creates",
      value: createCount,
      valueClassName: "text-green-600",
    },
    {
      id: "update",
      label: "Updates",
      value: updateCount,
      valueClassName: "text-blue-600",
    },
    {
      id: "delete",
      label: "Deletes",
      value: deleteCount,
      valueClassName: "text-red-600",
    },
    {
      id: "users",
      label: "Active Users",
      value: uniqueUsers,
      valueClassName: "",
    },
  ];

  const columns: Column<
    AuditLog & Record<string, unknown>
  >[] = [
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
        <span className="capitalize">{row.entity_type}</span>
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
        <Link href={`/inventory/audit/${row.id}`}>
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
        subtitle="Track all changes across the inventory system"
      />

      <StatsCards stats={stats} />

      <TableView
        columns={columns}
        data={logs}
        loading={isLoading}
        emptyMessage="No audit logs found."
      />
    </div>
  );
}