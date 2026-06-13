// src/app/(app)/hr/leave/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { useLeaves, useCreateLeaveRequest, useApproveLeave, useLeaveStats, LEAVE_TYPES } from "@/hooks/useLeaves";
import { useActiveEmployees } from "@/hooks/useEmployees";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { TableView, Column } from "@/components/reuseable/TableGridView";
import { LeaveFormModal } from "@/components/leave/LeaveFormModal";
import { LeaveDetailDrawer } from "@/components/leave/LeaveDetailDrawer";
import { LeaveCard } from "@/components/leave/LeaveCard";
import { ApprovalActions } from "@/components/leave/ApprovalActions";
import { getPermissions } from "@/lib/permissions";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  CalendarDays,
  UserCheck,
  Clock,
  Shield,
  RefreshCw,
  Plus,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  LayoutGrid,
  Table,
  FileText,
} from "lucide-react";

interface LeaveFormData {
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  reason: string;
  emergency_contact: string;
}

type ViewMode = "grid" | "table";

export default function LeaveManagementPage() {
  const { user } = useAuth();
  const api = useApi();

  const [activeTab, setActiveTab] = useState("my-leaves");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);


    const permissions = useSelector(
  (state: RootState) => state.permissions.permissions
);

const leavePermissions = getPermissions(
  permissions,
  "HR",
  "leave"
);

  // Fetch data with React Query
  const { data: leaves = [], refetch: refetchLeaves, isLoading: leavesLoading } = useLeaves();
  const { data: employees = [] } = useActiveEmployees();
  const { data: stats, refetch: refetchStats } = useLeaveStats();

  // Mutations
  const createLeave = useCreateLeaveRequest();
  const approveLeave = useApproveLeave();

  const refreshData = useCallback(() => {
    refetchLeaves();
    refetchStats();
  }, [refetchLeaves, refetchStats]);

  const getUserLeaves = () => {
    const userEmployee = employees.find((e: any) => e.email === user?.email);
    if (!userEmployee) return leaves.filter((l: any) => l.created_by === user?.id);
    return leaves.filter((l: any) => l.employee_id === userEmployee.id);
  };

  const getPendingApprovals = () => {
    return leaves.filter((l: any) => l.status === "PENDING");
  };

  const getAllLeavesForAdmin = () => {
    return leaves;
  };

  const handleApply = async (formData: LeaveFormData) => {
    try {
      await createLeave.mutateAsync({
        employee_id: formData.employee_id,
        leave_type: formData.leave_type,
        start_date: formData.start_date,
        end_date: formData.end_date || formData.start_date,
        is_half_day: formData.is_half_day,
        reason: formData.reason,
        emergency_contact: formData.emergency_contact,
      });

      setIsApplyOpen(false);
      refreshData();
    } catch (error: any) {
    }
  };

  const handleApproval = async (leaveId: string, status: string, rejectionReason = "") => {
    try {
      await approveLeave.mutateAsync({
        id: leaveId,
        action: status as "APPROVED" | "REJECTED",
        rejection_reason: rejectionReason || undefined,
      });
      refreshData();
      setIsDrawerOpen(false);
    } catch (error: any) {
    }
  };

  const handleDelete = async (leaveId: string) => {
    if (!confirm("Delete this leave request?")) return;

    try {
      await api(`/api/hr/leaves/`, {
        method: "DELETE",
        body: JSON.stringify({ id: leaveId }),
      });
      refreshData();
    } catch (error: any) {
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
      APPROVED: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
      REJECTED: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
      CANCELLED: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700",
    };
    return styles[status] || styles.PENDING;
  };

  // Format date for display
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };

  const getLeaveTypeLabel = (leaveType: string) => {
    const found = LEAVE_TYPES.find(t => t.value === leaveType);
    return found?.label || leaveType;
  };


  if (!leavePermissions.view && !(user?.role === "COMPANY_ADMIN")) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You don't have permission to view Leave Management.
          </p>
        </div>
      </div>
    );
  }

  const userLeaves = getUserLeaves();
  const pendingApprovals = getPendingApprovals();
  const allLeaves = getAllLeavesForAdmin();
  const myStats = stats?.my_leaves || { total: 0, approved: 0, pending: 0, rejected: 0 };

  // Stats cards configuration
  const statsCards = [
    { id: "total", label: "My Leave Requests", value: myStats.total, valueClassName: "text-foreground" },
    { id: "approved", label: "Approved", value: myStats.approved, valueClassName: "text-green-600" },
    { id: "pending", label: "Pending", value: myStats.pending, valueClassName: "text-yellow-600" },
    { id: "rejected", label: "Rejected", value: myStats.rejected, valueClassName: "text-red-600" },
  ];

  // Table columns for My Leaves
  const myLeavesColumns: Column<any>[] = [
    { key: "leave_type_display", label: "Leave Type", sortable: true },
    { key: "start_date", label: "Start Date", sortable: true },
    { key: "end_date", label: "End Date", sortable: true },
    { 
      key: "total_days", 
      label: "Days", 
      sortable: true,
      render: (value: unknown, row: any) => (
        <span>{String(value)}{row.is_half_day && " (Half)"}</span>
      )
    },
    { 
      key: "reason", 
      label: "Reason", 
      sortable: false,
      render: (value: unknown) => (
        <div className="max-w-[200px] truncate" title={String(value)}>
          {String(value)}
        </div>
      )
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value: unknown) => (
        <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full border ${getStatusBadge(String(value))}`}>
          {String(value)}
        </span>
      )
    },
    {
      key: "approval_info",
      label: "Approved/Rejected By",
      sortable: false,
      render: (_: unknown, row: any) => {
        if (row.status === "APPROVED" && row.approved_by_name) {
          return (
            <div>
              <div className="text-sm font-medium text-green-700">{row.approved_by_name}</div>
              {row.approval_date && (
                <div className="text-xs text-muted-foreground">{formatDateTime(row.approval_date)}</div>
              )}
            </div>
          );
        }
        if (row.status === "REJECTED" && row.approved_by_name) {
          return (
            <div>
              <div className="text-sm font-medium text-red-700">{row.approved_by_name}</div>
              {row.approval_date && (
                <div className="text-xs text-muted-foreground">{formatDateTime(row.approval_date)}</div>
              )}
            </div>
          );
        }
        return <span className="text-muted-foreground">—</span>;
      }
    },
    {
      key: "rejection_reason",
      label: "Rejection Reason",
      sortable: false,
      render: (value: unknown) => (
        value ? (
          <div className="max-w-[150px] truncate text-red-600" title={String(value)}>
            {String(value)}
          </div>
        ) : <span className="text-muted-foreground">—</span>
      )
    },
  ];

  // Table columns for Approvals
  const approvalsColumns: Column<any>[] = [
    { key: "employee_name", label: "Employee", sortable: true },
    { 
      key: "department", 
      label: "Department", 
      sortable: true,
      render: (_: unknown, row: any) => {
        const employee = employees.find((e: any) => e.id === row.employee_id);
        return employee?.department_name || employee?.department || "—";
      }
    },
    { key: "leave_type_display", label: "Leave Type", sortable: true },
    { 
      key: "dates", 
      label: "Dates", 
      sortable: false,
      render: (_: unknown, row: any) => `${row.start_date} → ${row.end_date}`
    },
    { key: "total_days", label: "Days", sortable: true },
    { 
      key: "reason", 
      label: "Reason", 
      sortable: false,
      render: (value: unknown) => (
        <div className="max-w-[150px] truncate" title={String(value)}>
          {String(value)}
        </div>
      )
    },
    {
      key: "applied_at",
      label: "Applied On",
      sortable: true,
      render: (value: unknown) => formatDateTime(String(value))
    },
  ];

  // Table columns for All Leaves (admin)
  const allLeavesColumns: Column<any>[] = [
    { key: "employee_name", label: "Employee", sortable: true },
    { key: "leave_type_display", label: "Leave Type", sortable: true },
    { key: "start_date", label: "Start Date", sortable: true },
    { key: "end_date", label: "End Date", sortable: true },
    { key: "total_days", label: "Days", sortable: true },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value: unknown) => (
        <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full border ${getStatusBadge(String(value))}`}>
          {String(value)}
        </span>
      )
    },
    {
      key: "approved_by",
      label: "Approved/Rejected By",
      sortable: false,
      render: (_: unknown, row: any) => {
        if ((row.status === "APPROVED" || row.status === "REJECTED") && row.approved_by_name) {
          return (
            <div>
              <div className="text-sm font-medium">{row.approved_by_name}</div>
              {row.approval_date && (
                <div className="text-xs text-muted-foreground">{formatDateTime(row.approval_date)}</div>
              )}
            </div>
          );
        }
        return <span className="text-muted-foreground">—</span>;
      }
    },
    {
      key: "rejection_reason",
      label: "Rejection Reason",
      sortable: false,
      render: (value: unknown) => (
        value ? (
          <div className="max-w-[150px] truncate text-red-600" title={String(value)}>
            {String(value)}
          </div>
        ) : <span className="text-muted-foreground">—</span>
      )
    },
  ];

  // Render grid view for leaves
  const renderGridView = (leavesData: any[], showApprovalInfo: boolean = true, showCancel: boolean = true) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {leavesData.length === 0 ? (
        <div className="col-span-full text-center py-10 text-muted-foreground">
          No leave records found.
        </div>
      ) : (
        leavesData.map((leave) => (
          <LeaveCard
            key={leave.id}
            leave={leave}
            onView={() => { setSelectedLeave(leave); setIsDrawerOpen(true); }}
            onCancel={showCancel && leave.status === "PENDING" ? () => handleDelete(leave.id) : undefined}
            getStatusBadge={getStatusBadge}
            showApprovalInfo={showApprovalInfo}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        subtitle="Apply for leave, track requests, and manage approvals"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-background text-sm hover:bg-muted transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            {leavePermissions.create && (
              <button
                onClick={() => setIsApplyOpen(true)}
                className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity shadow-sm"
              >
                <Plus className="w-4 h-4" /> Apply for Leave
              </button>
            )}
          </div>
        }
      />

      {/* Stats Cards */}
      <StatsCards stats={statsCards} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/40 mb-6">
          <TabsTrigger value="my-leaves">
            <CalendarDays className="w-4 h-4 mr-2" /> My Leaves
          </TabsTrigger>
          {leavePermissions.approve && (
            <TabsTrigger value="approvals">
              <UserCheck className="w-4 h-4 mr-2" /> Approvals
              {pendingApprovals.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">
                  {pendingApprovals.length}
                </span>
              )}
            </TabsTrigger>
          )}
          {leavePermissions.approve && (
            <TabsTrigger value="all-leaves">
              <FileText className="w-4 h-4 mr-2" /> All Leaves
            </TabsTrigger>
          )}
        </TabsList>

        {/* My Leaves Tab */}
        <TabsContent value="my-leaves" className="m-0">
          {/* View Toggle */}
          <div className="flex justify-end mb-4">
            <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-background shadow-sm" : "hover:bg-muted"}`}
                title="Table View"
              >
                <Table className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-background shadow-sm" : "hover:bg-muted"}`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {viewMode === "table" ? (
            <TableView
              columns={myLeavesColumns}
              data={userLeaves}
              loading={leavesLoading}
              emptyMessage="No leave records found. Click 'Apply for Leave' to submit a request."
              actions={(row) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => { setSelectedLeave(row); setIsDrawerOpen(true); }}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {row.status === "PENDING" && (
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="p-1.5 rounded-md hover:bg-red-100 text-red-600 transition-colors"
                      title="Cancel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            />
          ) : (
            renderGridView(userLeaves, true, true)
          )}
        </TabsContent>

        {/* Approvals Tab */}
        {leavePermissions.approve && (
          <TabsContent value="approvals" className="m-0">
            <TableView
              columns={approvalsColumns}
              data={pendingApprovals}
              loading={leavesLoading}
              emptyMessage="No pending leave requests."
              actions={(row) => (
                <ApprovalActions
                  onApprove={() => handleApproval(row.id, "APPROVED")}
                  onReject={() => {
                    const reason = prompt("Rejection reason (optional):");
                    handleApproval(row.id, "REJECTED", reason || undefined);
                  }}
                  onView={() => { setSelectedLeave(row); setIsDrawerOpen(true); }}
                />
              )}
            />
          </TabsContent>
        )}

        {/* All Leaves Tab (Admin only) */}
        {leavePermissions.approve && (
          <TabsContent value="all-leaves" className="m-0">
            <div className="flex justify-end mb-4">
              <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-background shadow-sm" : "hover:bg-muted"}`}
                  title="Table View"
                >
                  <Table className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-background shadow-sm" : "hover:bg-muted"}`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>

            {viewMode === "table" ? (
              <TableView
                columns={allLeavesColumns}
                data={allLeaves}
                loading={leavesLoading}
                emptyMessage="No leave records found."
                actions={(row) => (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => { setSelectedLeave(row); setIsDrawerOpen(true); }}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                )}
              />
            ) : (
              renderGridView(allLeaves, true, false)
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Apply Leave Modal */}
      {leavePermissions.create && (
        <LeaveFormModal
          isOpen={isApplyOpen}
          onClose={() => setIsApplyOpen(false)}
          onSubmit={handleApply}
          employees={employees}
          isSubmitting={createLeave.isPending}
        />
      )}

      {/* Leave Detail Drawer */}
      <LeaveDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        leave={selectedLeave}
        onApprove={() => selectedLeave && handleApproval(selectedLeave.id, "APPROVED")}
        onReject={() => {
          const reason = prompt("Rejection reason (optional):");
          selectedLeave && handleApproval(selectedLeave.id, "REJECTED", reason || undefined);
        }}
        canApprove={leavePermissions.approve}
        getStatusBadge={getStatusBadge}
      />
    </div>
  );
}