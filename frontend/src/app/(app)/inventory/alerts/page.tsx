"use client";

import { useState } from "react";
import { useAlerts, useMarkAlertsRead, type Alert } from "@/hooks/useAlerts";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import PageHeader from "@/components/PageHeader";
import { CheckCircle, Bell } from "lucide-react";

export default function AlertsPage() {
  const [filters, setFilters] = useState({
    page: 1,
    page_size: 50,
  });

  const { data, isLoading, refetch } = useAlerts(filters.page, filters.page_size);
  const markRead = useMarkAlertsRead();

  const alerts = (data?.results || []) as (Alert & Record<string, unknown>)[];
  const totalCount = data?.count || 0;
  const unreadCount = alerts.filter((a) => !a.is_read).length;
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  const stats = [
    { id: "total", label: "Total Alerts", value: totalCount, valueClassName: "" },
    { id: "unread", label: "Unread", value: unreadCount, valueClassName: "text-blue-600" },
    { id: "critical", label: "Critical", value: criticalCount, valueClassName: "text-red-600" },
    { id: "warning", label: "Warning", value: warningCount, valueClassName: "text-yellow-600" },
  ];

  const handleMarkRead = (alertId: string) => {
    markRead.mutate([alertId], {
      onSuccess: () => refetch(),
    });
  };

  const handleMarkAllRead = () => {
    const unreadIds = alerts.filter((a) => !a.is_read).map((a) => a.id);
    if (unreadIds.length) {
      markRead.mutate(unreadIds, { onSuccess: () => refetch() });
    }
  };

  const columns: Column<Alert & Record<string, unknown>>[] = [
    {
      key: "created_at",
      label: "Time",
      render: (_, row) => formatDistanceToNow(new Date(row.created_at), { addSuffix: true }),
    },
    {
      key: "severity_display",
      label: "Severity",
      render: (_, row) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            row.severity === "critical"
              ? "bg-red-100 text-red-800"
              : row.severity === "warning"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {row.severity_display}
        </span>
      ),
    },
    {
      key: "type_display",
      label: "Type",
    },
    {
      key: "title",
      label: "Title",
    },
    {
      key: "message",
      label: "Message",
      render: (_, row) => (
        <div className="max-w-md truncate" title={row.message}>
          {row.message}
        </div>
      ),
    },
    // {
    //   key: "is_read",
    //   label: "Read",
    //   render: (_, row) =>
    //     row.is_read ? (
    //       <CheckCircle className="h-4 w-4 text-green-600" />
    //     ) : (
    //       <Button
    //         variant="ghost"
    //         size="sm"
    //         onClick={() => handleMarkRead(row.id)}
    //       >
    //         Mark read
    //       </Button>
    //     ),
    // },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts & Notifications"
        subtitle="Real‑time inventory events that need your attention"
      >
      </PageHeader>

      <StatsCards stats={stats} />

      <TableView
        columns={columns}
        data={alerts}
        loading={isLoading}
        emptyMessage="No alerts – everything looks good."
      />
    </div>
  );
}