// src/app/(dashboard)/settings/leave-types/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  useLeaveTypes,
  useCreateLeaveTypeMutation,
  useUpdateLeaveTypeMutation,
  useDeleteLeaveTypeMutation,
} from "@/hooks/useLeaveTypes";
import DataTable from "@/components/reuseable/DataTable";
import PageHeader from "@/components/PageHeader";
import FormModal from "@/components/reuseable/FormModal";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { permissionService } from "@/services/permissionService";
import { useAuth } from "@/hooks/useAuth";

export default function LeaveTypesPage() {
  const { user } = useAuth();
  const { data: leaveTypes = [], isLoading, error } = useLeaveTypes();
  const createLeaveType = useCreateLeaveTypeMutation();
  const updateLeaveType = useUpdateLeaveTypeMutation();
  const deleteLeaveType = useDeleteLeaveTypeMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    isPaid: true,
    defaultDaysPerYear: 20,
    maxCarryForwardDays: 0,
    minDaysPerRequest: 1,
    maxDaysPerRequest: 30,
    requiresApproval: true,
    requiresDocument: false,
    isActive: true,
    applicableAfterMonths: 0,
    genderSpecific: "ALL" as const,
  });

  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    loading: true,
  });

  useEffect(() => {
    permissionService.init();
    setPermissions({
      canCreate: permissionService.hasPermission("SETTINGS", "Leave Types", "create"),
      canUpdate: permissionService.hasPermission("SETTINGS", "Leave Types", "update"),
      canDelete: permissionService.hasPermission("SETTINGS", "Leave Types", "delete"),
      loading: false,
    });
  }, []);

  const handleCreate = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      isPaid: true,
      defaultDaysPerYear: 20,
      maxCarryForwardDays: 0,
      minDaysPerRequest: 1,
      maxDaysPerRequest: 30,
      requiresApproval: true,
      requiresDocument: false,
      isActive: true,
      applicableAfterMonths: 0,
      genderSpecific: "ALL",
    });
    setEditingLeaveType(null);
    setModalOpen(true);
  };

  const handleEdit = (row: any) => {
    setFormData({
      name: row.name || "",
      code: row.code || "",
      description: row.description || "",
      isPaid: row.isPaid ?? true,
      defaultDaysPerYear: row.defaultDaysPerYear || 20,
      maxCarryForwardDays: row.maxCarryForwardDays || 0,
      minDaysPerRequest: row.minDaysPerRequest || 1,
      maxDaysPerRequest: row.maxDaysPerRequest || 30,
      requiresApproval: row.requiresApproval ?? true,
      requiresDocument: row.requiresDocument ?? false,
      isActive: row.isActive ?? true,
      applicableAfterMonths: row.applicableAfterMonths || 0,
      genderSpecific: row.genderSpecific || "ALL",
    });
    setEditingLeaveType(row);
    setModalOpen(true);
  };

  const handleDelete = async (row: any) => {
    if (!confirm(`Are you sure you want to delete "${row.name}"? This will affect existing leave records.`)) return;
    try {
      await deleteLeaveType.mutateAsync(row.id);
    } catch (error) {
      console.error("Failed to delete leave type:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.code.trim()) {
      alert("Name and Code are required");
      return;
    }

    try {
      if (editingLeaveType) {
        await updateLeaveType.mutateAsync({
          id: editingLeaveType.id,
          ...formData,
        });
      } else {
        await createLeaveType.mutateAsync(formData);
      }
      setModalOpen(false);
    } catch (error) {
      console.error("Failed to save leave type:", error);
    }
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      sortable: true,
      render: (value: string) => (
        <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
          {value}
        </code>
      ),
    },
    {
      key: "defaultDaysPerYear",
      label: "Days/Year",
      sortable: true,
      render: (value: number) => (
        <span className="font-medium">{value} days</span>
      ),
    },
    {
      key: "isPaid",
      label: "Type",
      render: (value: boolean) => (
        <Badge variant="default" className="bg-green-100 text-green-700">
          {value ? "Paid" : "Unpaid"}
        </Badge>
      ),
    },
    {
      key: "requiresApproval",
      label: "Approval",
      render: (value: boolean) => (
        <Badge variant={value ? "default" : "secondary"} className="text-xs">
          {value ? "Required" : "Auto"}
        </Badge>
      ),
    },
  ];

  if (permissions.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading permissions...</p>
        </div>
      </div>
    );
  }

  if (!permissions.canCreate && !permissions.canUpdate && !permissions.canDelete && user?.role !== "COMPANY_ADMIN") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/15 flex items-center justify-center">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You don't have permission to access leave types configuration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Leave Types"
        subtitle="Configure leave policies and types for your organization"
        actions={
          (permissions.canCreate || user?.role === "COMPANY_ADMIN") && (
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Add Leave Type
            </Button>
          )
        }
      />

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Types</span>
          </div>
          <div className="text-2xl font-semibold">{leaveTypes.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
          <div className="text-2xl font-semibold text-success">
            {leaveTypes.filter(lt => lt.isActive).length}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-warning" />
            <span className="text-xs text-muted-foreground">Paid Types</span>
          </div>
          <div className="text-2xl font-semibold">
            {leaveTypes.filter(lt => lt.isPaid).length}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-xs text-muted-foreground">Inactive</span>
          </div>
          <div className="text-2xl font-semibold text-destructive">
            {leaveTypes.filter(lt => !lt.isActive).length}
          </div>
        </div>
      </div>

      <DataTable
        data={leaveTypes}
        columns={columns}
        title="All Leave Types"
        subtitle={`${leaveTypes.length} leave type${leaveTypes.length !== 1 ? "s" : ""} configured`}
        searchable
        searchFields={["name", "code", "description"]}
        onEdit={(row) => (permissions.canUpdate || user?.role === "COMPANY_ADMIN") && handleEdit(row)}
        onDelete={(row) => (permissions.canDelete || user?.role === "COMPANY_ADMIN") && handleDelete(row)}
        defaultPageSize={10}
      />

      {/* Create/Edit Modal */}
      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingLeaveType ? "Edit Leave Type" : "Create Leave Type"}
        onSubmit={handleSubmit}
        loading={createLeaveType.isPending || updateLeaveType.isPending}
        size="xl"
      >
        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Leave Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none"
                  placeholder="e.g., Annual Leave"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Code <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none font-mono"
                  placeholder="e.g., AL"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none resize-none"
                  placeholder="Brief description of this leave type..."
                />
              </div>
            </div>
          </div>

          {/* Leave Configuration */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Leave Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Days Per Year
                </label>
                <input
                  type="number"
                  value={formData.defaultDaysPerYear}
                  onChange={(e) => setFormData({ ...formData, defaultDaysPerYear: Number(e.target.value) })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none"
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Min Days Per Request
                </label>
                <input
                  type="number"
                  value={formData.minDaysPerRequest}
                  onChange={(e) => setFormData({ ...formData, minDaysPerRequest: Number(e.target.value) })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none"
                  min="1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Max Days Per Request
                </label>
                <input
                  type="number"
                  value={formData.maxDaysPerRequest}
                  onChange={(e) => setFormData({ ...formData, maxDaysPerRequest: Number(e.target.value) })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none"
                  min="1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Max Carry Forward Days
                </label>
                <input
                  type="number"
                  value={formData.maxCarryForwardDays}
                  onChange={(e) => setFormData({ ...formData, maxCarryForwardDays: Number(e.target.value) })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none"
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Available After (Months)
                </label>
                <input
                  type="number"
                  value={formData.applicableAfterMonths}
                  onChange={(e) => setFormData({ ...formData, applicableAfterMonths: Number(e.target.value) })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none"
                  min="0"
                  placeholder="0 = Immediately"
                />
              </div>

            </div>
          </div>

          {/* Settings */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Leave Type
                </label>
                <select
                  value={formData.isPaid ? "paid" : "unpaid"}
                  onChange={(e) => setFormData({ ...formData, isPaid: e.target.value === "paid" })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none"
                >
                  <option value="paid">Paid Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Gender Specific
                </label>
                <select
                  value={formData.genderSpecific}
                  onChange={(e) => setFormData({ ...formData, genderSpecific: e.target.value as any })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none"
                >
                  <option value="ALL">All Employees</option>
                  <option value="MALE">Male Only</option>
                  <option value="FEMALE">Female Only</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.requiresApproval}
                  onChange={(e) => setFormData({ ...formData, requiresApproval: e.target.checked })}
                  className="w-4 h-4 rounded accent-primary"
                />
                <div>
                  <div className="text-sm font-medium">Requires Approval</div>
                  <div className="text-xs text-muted-foreground">Manager must approve leave requests</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.requiresDocument}
                  onChange={(e) => setFormData({ ...formData, requiresDocument: e.target.checked })}
                  className="w-4 h-4 rounded accent-primary"
                />
                <div>
                  <div className="text-sm font-medium">Requires Document</div>
                  <div className="text-xs text-muted-foreground">Supporting document must be uploaded</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </FormModal>
    </div>
  );
}