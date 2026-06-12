// src/app/(app)/hr/leave/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { useLeaves, useLeaveBalances, useCreateLeaveRequest, useApproveLeave, useLeaveStats, useLeaveTypes } from "@/hooks/useLeaves";
import { useEmployees } from "@/hooks/useEmployees";
import { useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/reuseable/DatePicker";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import {
  Plus, CalendarDays, CheckCircle, XCircle, Clock, FileText,
  AlertCircle, Eye, Download, Trash2, Shield, UserCheck, RefreshCw
} from "lucide-react";
import { DateRangePickerRac } from "@/components/reuseable/DateRangePickerRac";

export default function LeaveManagementPage() {
  const { user, ready } = useAuth();
  const api = useApi();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("my-leaves");
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // Fetch data with React Query
  const { data: leaves = [], refetch: refetchLeaves, isLoading: leavesLoading } = useLeaves();
  const { data: leaveBalances = [], refetch: refetchBalances } = useLeaveBalances({ year: currentYear.toString() });
  const { data: leaveTypes = [] } = useLeaveTypes();
  const { data: employees = [] } = useEmployees();
  const { data: stats, refetch: refetchStats } = useLeaveStats();
  console.log("leaves:: ", leaves)
  // Mutations
  const createLeave = useCreateLeaveRequest();
  const approveLeave = useApproveLeave();
  
  const [permissions, setPermissions] = useState({
    canApprove: false,
    canCreate: false,
    canView: true,
    loading: true,
  });

  const [formData, setFormData] = useState({
    employee_id: "",
    leave_type_id: "",
    leave_year: new Date().getFullYear(),
    start_date: "",
    end_date: "",
    is_half_day: "false",
    reason: "",
    contact_number: "",
    document_url: "",
  });

  useEffect(() => {
    // Check permissions based on user role
    const canApprove = user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN";
    const canCreate = true; // All authenticated users can apply for leave
    
    setPermissions({
      canApprove,
      canCreate,
      canView: true,
      loading: false,
    });
  }, [user]);

  // Refresh all data
  const refreshData = useCallback(() => {
    refetchLeaves();
    refetchBalances();
    refetchStats();
  }, [refetchLeaves, refetchBalances, refetchStats]);

  const getEmployeeBalance = (employeeId: number, leaveTypeId: number) => {
    const balance = leaveBalances.find(
      b => b.employee_id === employeeId && b.leave_type_id === leaveTypeId
    );
    return balance || { allocated: 0, used: 0, available: 0, carry_forward_from: 0 };
  };

  const getUserLeaves = () => {
    // Find employee record for current user
    const userEmployee = employees.find(e => e.email === user?.email);
    if (!userEmployee) return leaves.filter(l => l.created_by === user?.id);
    return leaves.filter(l => l.employee_id === userEmployee.id);
  };

  const getPendingApprovals = () => {
    return leaves.filter(l => l.status === "PENDING");
  };

  const calculateTotalDays = (startDate: string, endDate: string, isHalfDay: string) => {
    // This will be calculated by backend, but we show preview
    if (!startDate) return 0;
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return isHalfDay === "true" && diffDays === 1 ? 0.5 : diffDays;
  };

  const handleApply = async () => {
    if (!formData.employee_id || !formData.leave_type_id || !formData.start_date || !formData.reason) {
      alert("Please fill all required fields");
      return;
    }

    try {
      await createLeave.mutateAsync({
        employee_id: parseInt(formData.employee_id),
        leave_type_id: parseInt(formData.leave_type_id),
        leave_year: formData.leave_year,
        start_date: formData.start_date,
        end_date: formData.end_date || formData.start_date,
        is_half_day: formData.is_half_day,
        reason: formData.reason,
        contact_number: formData.contact_number,
        document_url: formData.document_url,
      });
      
      setIsApplyOpen(false);
      setFormData({
        employee_id: "",
        leave_type_id: "",
        leave_year: new Date().getFullYear(),
        start_date: "",
        end_date: "",
        is_half_day: "false",
        reason: "",
        contact_number: "",
        document_url: "",
      });
      refreshData();
    } catch (error: any) {
      alert(error.message || "Failed to submit leave request");
    }
  };

  const handleApproval = async (leaveId: number, status: string, rejectionReason = "") => {
    try {
      await approveLeave.mutateAsync({
        id: leaveId,
        action: status as "APPROVED" | "REJECTED",
        rejection_reason: rejectionReason || undefined,
      });
      refreshData();
    } catch (error: any) {
      alert(error.message || `Failed to ${status.toLowerCase()} leave request`);
    }
  };

  const handleDelete = async (leaveId: number) => {
    if (!confirm("Delete this leave request?")) return;
    
    try {
      await api(`/api/hr/leaves/`, {
        method: "DELETE",
        body: JSON.stringify({ id: leaveId }),
      });
      refreshData();
    } catch (error: any) {
      alert(error.message || "Failed to delete leave request");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
      APPROVED: "bg-green-100 text-green-800 border-green-200",
      REJECTED: "bg-red-100 text-red-800 border-red-200",
      CANCELLED: "bg-gray-100 text-gray-600 border-gray-200",
      DRAFT: "bg-gray-100 text-gray-500 border-gray-200",
    };
    return styles[status] || styles.PENDING;
  };

  if (permissions.loading || !ready) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!permissions.canView && !(user?.role === "COMPANY_ADMIN")) {
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
  const myStats = stats?.my_leaves || { total: 0, approved: 0, pending: 0, rejected: 0 };

  // Employee options for apply form
  const employeeOptions = employees.map((e: any) => ({
    value: e.id.toString(),
    label: `${e.employee_id} - ${e.first_name} ${e.last_name || ""} (${e.department})`
  }));

  // Leave type options
  const leaveTypeOptions = leaveTypes.map((t: any) => ({ 
    value: t.id.toString(), 
    label: `${t.name} (${t.defaultDaysPerYear} days/year)`
  }));

  return (
    <div>
      <PageHeader
        title="Leave Management"
        subtitle="Apply for leave, track requests, and manage approvals"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-background text-sm hover:bg-muted"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            {permissions.canCreate && (
              <button
                onClick={() => setIsApplyOpen(true)}
                className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm"
              >
                <Plus className="w-4 h-4" /> Apply for Leave
              </button>
            )}
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">My Leave Requests</div>
          <div className="text-2xl font-semibold">{myStats.total}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Approved</div>
          <div className="text-2xl font-semibold text-green-600">
            {myStats.approved}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-semibold text-yellow-600">
            {myStats.pending}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Rejected</div>
          <div className="text-2xl font-semibold text-red-600">
            {myStats.rejected}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/40 mb-6">
          <TabsTrigger value="my-leaves">
            <CalendarDays className="w-4 h-4 mr-2" /> My Leaves
          </TabsTrigger>
          {permissions.canApprove && (
            <TabsTrigger value="approvals">
              <UserCheck className="w-4 h-4 mr-2" /> Approvals
              {pendingApprovals.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">
                  {pendingApprovals.length}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="balances">
            <Clock className="w-4 h-4 mr-2" /> Leave Balances
          </TabsTrigger>
        </TabsList>

        {/* My Leaves Tab */}
        <TabsContent value="my-leaves" className="m-0">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Leave Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Start Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">End Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Days</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reason</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userLeaves.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        No leave records found. Click "Apply for Leave" to submit a request.
                      </td>
                    </tr>
                  )}
                  {userLeaves.map((l: any) => {
                    const leaveType = leaveTypes.find((t: any) => t.id === l.leave_type_id);
                    return (
                      <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{leaveType?.name || l.leave_type_name}</td>
                        <td className="px-4 py-3">{l.start_date}</td>
                        <td className="px-4 py-3">{l.end_date}</td>
                        <td className="px-4 py-3">{l.total_days}{l.is_half_day === "true" && " (Half)"}</td>
                        <td className="px-4 py-3 max-w-[200px] truncate">{l.reason}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full border ${getStatusBadge(l.status)}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => { setSelectedLeave(l); setIsViewOpen(true); }}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {l.status === "PENDING" && (
                            <button
                              onClick={() => handleDelete(l.id)}
                              className="p-1.5 rounded-md hover:bg-red-100 text-red-600 transition-colors ml-1"
                              title="Cancel"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Approvals Tab */}
        {permissions.canApprove && (
          <TabsContent value="approvals" className="m-0">
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Leave Type</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dates</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Days</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reason</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingApprovals.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-muted-foreground">
                          No pending leave requests.
                        </td>
                      </tr>
                    )}
                    {pendingApprovals.map((l: any) => {
                      const employee = employees.find((e: any) => e.id === l.employee_id);
                      const leaveType = leaveTypes.find((t: any) => t.id === l.leave_type_id);
                      return (
                        <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="font-medium">{l.employee_name}</div>
                            <div className="text-xs text-muted-foreground">{employee?.employee_id}</div>
                          </td>
                          <td className="px-4 py-3">{employee?.department || "—"}</td>
                          <td className="px-4 py-3">{leaveType?.name || l.leave_type_name}</td>
                          <td className="px-4 py-3">
                            {l.start_date} → {l.end_date}
                          </td>
                          <td className="px-4 py-3">{l.total_days}</td>
                          <td className="px-4 py-3 max-w-[150px] truncate">{l.reason}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproval(l.id, "APPROVED")}
                                className="px-3 py-1.5 rounded-md bg-green-100 text-green-700 text-sm hover:bg-green-200 transition-colors flex items-center gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt("Rejection reason (optional):");
                                  handleApproval(l.id, "REJECTED", reason || undefined);
                                }}
                                className="px-3 py-1.5 rounded-md bg-red-100 text-red-700 text-sm hover:bg-red-200 transition-colors flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                              <button
                                onClick={() => { setSelectedLeave(l); setIsViewOpen(true); }}
                                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        )}

        {/* Leave Balances Tab */}
        <TabsContent value="balances" className="m-0">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Leave Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Allocated</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Used</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Available</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Carried Forward</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveBalances.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        No leave balance records found.
                      </td>
                    </tr>
                  )}
                  {leaveBalances.map((b: any) => {
                    const employee = employees.find((e: any) => e.id === b.employee_id);
                    return (
                      <tr key={b.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{b.employee_name}</div>
                          <div className="text-xs text-muted-foreground">{employee?.employee_id}</div>
                        </td>
                        <td className="px-4 py-3">{employee?.department || "—"}</td>
                        <td className="px-4 py-3">{b.leave_type_name}</td>
                        <td className="px-4 py-3 font-medium">{b.allocated} days</td>
                        <td className="px-4 py-3 text-yellow-600">{b.used} days</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${b.available < 5 ? "text-red-600" : "text-green-600"}`}>
                            {b.available} days
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{b.carry_forward_from || 0} days</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Apply Leave Modal */}
      {isApplyOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Apply for Leave
              </h2>
              <button onClick={() => setIsApplyOpen(false)} className="p-1.5 rounded-md hover:bg-muted">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm flex flex-col gap-1.5">
                  <span className="text-muted-foreground">Employee <span className="text-red-500">*</span></span>
                  <SearchableSelect
                    value={formData.employee_id}
                    onChange={(val) => setFormData({ ...formData, employee_id: val })}
                    options={employeeOptions}
                    required
                    placeholder="Select Employee"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1.5">
                  <span className="text-muted-foreground">Leave Year <span className="text-red-500">*</span></span>
                  <input
                    type="number"
                    value={formData.leave_year}
                    onChange={(e) => setFormData({ ...formData, leave_year: parseInt(e.target.value) })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm flex flex-col gap-1.5">
                  <span className="text-muted-foreground">Leave Type <span className="text-red-500">*</span></span>
                  <SearchableSelect
                    value={formData.leave_type_id}
                    onChange={(val) => setFormData({ ...formData, leave_type_id: val })}
                    options={leaveTypeOptions}
                    required
                    placeholder="Select Leave Type"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1.5">
                  <span className="text-muted-foreground">Half Day?</span>
                  <select
                    value={formData.is_half_day}
                    onChange={(e) => setFormData({ ...formData, is_half_day: e.target.value })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="false">No (Full Day)</option>
                    <option value="true">Yes (Half Day)</option>
                  </select>
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm flex flex-col gap-1.5">
                  <span className="text-muted-foreground">Leave Period <span className="text-red-500">*</span></span>
                  <DateRangePickerRac
                    startDate={formData.start_date}
                    endDate={formData.end_date}
                    onChange={(start, end) => {
                      setFormData({ ...formData, start_date: start || "", end_date: end || "" });
                    }}
                    placeholder="Select leave period"
                    required
                  />
                </label>
              </div>

              <label className="text-sm flex flex-col gap-1.5">
                <span className="text-muted-foreground">Reason <span className="text-red-500">*</span></span>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Please provide a detailed reason for your leave request..."
                />
              </label>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm flex flex-col gap-1.5">
                  <span className="text-muted-foreground">Emergency Contact Number</span>
                  <input
                    type="tel"
                    value={formData.contact_number}
                    onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                    placeholder="During leave period"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1.5">
                  <span className="text-muted-foreground">Supporting Document URL</span>
                  <input
                    type="text"
                    value={formData.document_url}
                    onChange={(e) => setFormData({ ...formData, document_url: e.target.value })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Link to medical certificate, etc."
                  />
                </label>
              </div>

              {formData.start_date && formData.leave_type_id && formData.employee_id && (
                <div className="bg-blue-50 rounded-xl p-3">
                  <div className="text-sm font-medium text-blue-800">Leave Summary</div>
                  <div className="text-xs text-blue-600 mt-1">
                    Calculated Days: {calculateTotalDays(formData.start_date, formData.end_date || formData.start_date, formData.is_half_day)} days
                  </div>
                  <div className="text-xs text-blue-600">
                    Available Balance: {getEmployeeBalance(parseInt(formData.employee_id), parseInt(formData.leave_type_id)).available} days
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
              <button onClick={() => setIsApplyOpen(false)} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleApply} 
                disabled={createLeave.isPending}
                className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {createLeave.isPending ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Leave Modal */}
      {isViewOpen && selectedLeave && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-semibold text-lg">Leave Request Details</h2>
              <button onClick={() => setIsViewOpen(false)} className="p-1.5 rounded-md hover:bg-muted">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground">Leave Type:</div>
                <div className="font-medium">{selectedLeave.leave_type_name}</div>

                <div className="text-muted-foreground">Period:</div>
                <div>{selectedLeave.start_date} → {selectedLeave.end_date}</div>

                <div className="text-muted-foreground">Total Days:</div>
                <div>{selectedLeave.total_days}{selectedLeave.is_half_day === "true" && " (Half Day)"}</div>

                <div className="text-muted-foreground">Status:</div>
                <div>
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full border ${getStatusBadge(selectedLeave.status)}`}>
                    {selectedLeave.status}
                  </span>
                </div>

                <div className="text-muted-foreground">Applied On:</div>
                <div>{selectedLeave.applied_at ? new Date(selectedLeave.applied_at).toLocaleDateString() : "—"}</div>

                <div className="text-muted-foreground">Reason:</div>
                <div className="col-span-2 bg-muted/30 p-2 rounded-md">{selectedLeave.reason}</div>

                {selectedLeave.contact_number && (
                  <>
                    <div className="text-muted-foreground">Emergency Contact:</div>
                    <div>{selectedLeave.contact_number}</div>
                  </>
                )}

                {selectedLeave.document_url && (
                  <>
                    <div className="text-muted-foreground">Document:</div>
                    <div>
                      <a href={selectedLeave.document_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        View Document
                      </a>
                    </div>
                  </>
                )}

                {selectedLeave.rejection_reason && (
                  <>
                    <div className="text-muted-foreground">Rejection Reason:</div>
                    <div className="text-red-600">{selectedLeave.rejection_reason}</div>
                  </>
                )}

                {selectedLeave.approved_by && (
                  <>
                    <div className="text-muted-foreground">Approved By:</div>
                    <div>{selectedLeave.approved_by}</div>
                  </>
                )}

                {selectedLeave.approval_date && (
                  <>
                    <div className="text-muted-foreground">Approved On:</div>
                    <div>{new Date(selectedLeave.approval_date).toLocaleDateString()}</div>
                  </>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <button onClick={() => setIsViewOpen(false)} className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}