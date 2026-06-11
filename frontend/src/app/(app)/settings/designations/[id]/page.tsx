"use client";

import { useParams } from "next/navigation";
import { useDesignation, useDesignationEmployees } from "@/hooks/useDesignations";
import { useAuditLogs } from "@/hooks/useAudit";
import { DetailLayout, StandardSidebar } from "@/components/reuseable/final/DetailLayout";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

export default function DesignationDetailPage() {
  const { id } = useParams();
  const { data: designation, isLoading: desLoading } = useDesignation(id as string);
  const { data: employees = [], isLoading: empLoading } = useDesignationEmployees(id as string);
  const { data: auditData, isLoading: auditLoading } = useAuditLogs({
    model_name: "designation",
    record_id: id as string,
  });
  const permissions = useFeaturePermissions("SETTINGS", "designation");

  if (desLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!designation) return <div className="p-8 text-center">Designation not found</div>;

  const employeeColumns: Column<any>[] = [
    { key: "employee_id", label: "ID" },
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "department", label: "Department" },
  ];

  const auditColumns: Column<any>[] = [
    {
      key: "created_at",
      label: "Date",
      render: (v: unknown) => {
        if (!v) return "—";
        try {
          return new Date(v as string).toLocaleString();
        } catch {
          return String(v);
        }
      },
    },
    { key: "user_name", label: "User" },
    { key: "action_display", label: "Action" },
    {
      key: "changes",
      label: "Changes",
      render: (changes: unknown) => {
        if (!changes || typeof changes !== "object") return "—";
        const changesObj = changes as Record<string, { old: any; new: any }>;
        return (
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {Object.entries(changesObj).map(([field, { old, new: newVal }]) => (
              <div key={field} className="text-xs">
                <span className="font-mono">{field}:</span>{" "}
                {old !== undefined ? `${old} → ` : ""}
                {newVal !== undefined ? newVal : "DELETED"}
              </div>
            ))}
          </div>
        );
      },
    },
  ];

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      render: () => (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Name", designation.name],
            ["Department", designation.department_name === "ALL" ? "All Departments" : (designation.department_name || "—")],
            ["Description", designation.description || "—"],
            ["Status", designation.isActive ? "Active" : "Inactive"],
            ["Created", new Date(designation.created_at).toLocaleDateString()],   // ✅ snake_case
            ["Updated", new Date(designation.updated_at).toLocaleDateString()],   // ✅ snake_case
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "employees",
      label: "Employees",
      count: employees.length,
      render: () => (
        <TableView
          columns={employeeColumns as Column<Record<string, unknown>>[]}
          data={employees as unknown as Record<string, unknown>[]}
          loading={empLoading}
          emptyMessage="No employees with this designation"
        />
      ),
    },
    {
      id: "audit",
      label: "Audit History",
      count: auditData?.count || 0,
      render: () => (
        <TableView
          columns={auditColumns as Column<Record<string, unknown>>[]}
          data={auditData?.results as unknown as Record<string, unknown>[] || []}
          loading={auditLoading}
          emptyMessage="No audit records found"
        />
      ),
    },
  ];

  return (
    <DetailLayout
      breadcrumbs={["Settings", "Designations", designation.name]}
      entityId={designation.name}
      title={designation.name}
      status={designation.isActive ? "Active" : "Inactive"}
      subtitle={designation.description || "No description"}
      data={designation}
      meta={[
        { label: "Department", value: designation.department_name === "ALL" ? "All Departments" : (designation.department_name || "—") },
      ]}
      summary={[
        { label: "Employees", value: employees.length, isCurrency: false, tone: "info" },
        { label: "Status", value: designation.isActive ? "Active" : "Inactive" },
      ]}
      tabs={tabs}
      permissions={{ edit: permissions.update, delete: permissions.delete }}
      onEdit={() => (window.location.href = `/settings/designations?edit=${designation.id}`)}
      sidebar={
        <StandardSidebar
          metadata={[
            ["Updated", new Date(designation.updated_at).toLocaleString()],
            ["Updated by", "System"],
          ]}
        />
      }
    />
  );
}