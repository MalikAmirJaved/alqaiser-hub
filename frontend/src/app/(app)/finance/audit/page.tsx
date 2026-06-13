"use client";

import { useState } from "react";
import { DynamicModulePage, type Column } from "@/components/reuseable/final/DynamicModulePage";
import { useAuditLogs } from "@/hooks/finance/useAuditLogs";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLogs({ page });
  const permissions = useFeaturePermissions("FINANCE", "audit_log");

  const columns: Column<any>[] = [
    { key: "created_at", label: "Timestamp", sortable: true },
    { key: "user_name", label: "User", sortable: true },
    { key: "action", label: "Action", sortable: true },
    { key: "entity_type", label: "Entity", sortable: true },
    { key: "entity_id", label: "Entity ID", mono: true },
    { key: "source_module", label: "Module" },
  ];

  // Expandable row to show field changes
  const renderExpandedRow = (log: any) => (
    <div className="p-4 bg-muted/10 rounded-md">
      <div className="text-sm font-medium mb-2">Field Changes</div>
      <table className="w-full text-xs border border-border">
        <thead className="bg-surface/40">
          <tr>
            <th className="px-2 py-1 text-left">Field</th>
            <th className="px-2 py-1 text-left">Old Value</th>
            <th className="px-2 py-1 text-left">New Value</th>
          </tr>
        </thead>
        <tbody>
          {log.field_changes?.map((change: any, idx: number) => (
            <tr key={idx} className="border-t border-border/60">
              <td className="px-2 py-1 font-mono">{change.field_name}</td>
              <td className="px-2 py-1 text-destructive line-through">{change.old_value || "—"}</td>
              <td className="px-2 py-1 text-success">{change.new_value || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <DynamicModulePage
      breadcrumbs={["Governance", "Audit Logs"]}
      title="Audit Logs"
      description="Complete history of all changes across the system"
      data={data?.results || []}
      isLoading={isLoading}
      columns={columns}
      getRowId={(log) => log.id}
      permissions={{ view: permissions.view, create: false, update: false, delete: false }}
      exportEnabled={permissions.export}
    />
  );
}