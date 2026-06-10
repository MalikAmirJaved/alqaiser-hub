// app/(app)/settings/departments/[id]/page.tsx

"use client";

import { useParams } from "next/navigation";
import {
  useDepartment,
  useDepartmentDesignations,
  useDepartmentEmployees,
  type DepartmentDesignation,
  type DepartmentEmployee,
} from "@/hooks/useDepartments";
import { useAuditLogs, type AuditLog } from "@/hooks/useAudit";
import { DetailLayout, StandardSidebar } from "@/components/reuseable/final/DetailLayout";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

export default function DepartmentDetailPage() {
  const { id } = useParams();
  const { data: department, isLoading: deptLoading } = useDepartment(id as string);
  const { data: designations = [], isLoading: desLoading } = useDepartmentDesignations(id as string);
  const { data: employees = [], isLoading: empLoading } = useDepartmentEmployees(id as string);
  const { data: auditData, isLoading: auditLoading } = useAuditLogs({
    model_name: "department",
    record_id: id as string,
  });
  const permissions = useFeaturePermissions("SETTINGS", "department");

  if (deptLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!department) return <div className="p-8 text-center">Department not found</div>;

  // Designations columns (typed, will cast when passing to TableView)
const designationColumns: Column<DepartmentDesignation>[] = [
  { key: "name", label: "Designation", sortable: true },
  {
    key: "department",
    label: "Department",

    render: (val: unknown) => {
      const dept = val as string;
      return dept === "ALL" ? "All Departments" : dept || "—";
    },
  },
  { key: "is_active", label: "Status", render: (val) => (val ? "Active" : "Inactive") },
];

  // Employees columns
  const employeeColumns: Column<DepartmentEmployee>[] = [
    { key: "employee_id", label: "ID" },
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "designation", label: "Designation" },
  ];

  // Audit columns – safe date parsing
  const auditColumns: Column<AuditLog>[] = [
    {
      key: "created_at",
      label: "Date",
      render: (v: unknown) => {
        if (!v) return "—";
        const dateStr = typeof v === "string" ? v : String(v);
        try {
          return new Date(dateStr).toLocaleString();
        } catch {
          return dateStr;
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
            ["Code", department.code],
            ["Name", department.name],
            ["Description", department.description || "—"],
            ["Status", department.is_active ? "Active" : "Inactive"],
            ["Created", new Date(department.created_at).toLocaleDateString()],
            ["Updated", new Date(department.updated_at).toLocaleDateString()],
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
      id: "designations",
      label: "Designations",
      count: designations.length,
      render: () => (
       <TableView
  columns={designationColumns as unknown as Column<Record<string, unknown>>[]}
  data={designations as unknown as Record<string, unknown>[]}
  loading={desLoading}
  emptyMessage="No designations in this department"
/>
      ),
    },
    {
      id: "employees",
      label: "Employees",
      count: employees.length,
      render: () => (
        <TableView
  columns={employeeColumns as unknown as Column<Record<string, unknown>>[]}
  data={employees as unknown as Record<string, unknown>[]}
  loading={empLoading}
  emptyMessage="No employees in this department"
/>
      ),
    },
    {
      id: "audit",
      label: "Audit History",
      count: auditData?.count || 0,
      render: () => (
       <TableView
  columns={auditColumns as unknown as Column<Record<string, unknown>>[]}
  data={auditData?.results as unknown as Record<string, unknown>[] || []}
  loading={auditLoading}
  emptyMessage="No audit records found"
/>
      ),
    },
  ];

  return (
    <DetailLayout
      breadcrumbs={["Settings", "Departments", department.name]}
      entityId={department.code}
      title={department.name}
      status={department.is_active ? "Active" : "Inactive"}
      subtitle={department.description || "No description"}
      data={department}
      meta={[
        { label: "Code", value: department.code },
        { label: "Created", value: new Date(department.created_at).toLocaleDateString() },
      ]}
      summary={[
        { label: "Designations", value: designations.length, isCurrency: false, tone: "info" },
        { label: "Employees", value: employees.length, isCurrency: false, tone: "info" },
        { label: "Status", value: department.is_active ? "Active" : "Inactive" },
      ]}
      tabs={tabs}
      permissions={{ edit: permissions.update, delete: permissions.delete }}
      onEdit={() => (window.location.href = `/settings/departments?edit=${department.id}`)}
      sidebar={
        <StandardSidebar
          metadata={[
            ["Updated", new Date(department.updated_at).toLocaleString()],
            ["Updated by", "System"],
          ]}
        />
      }
    />
  );
}