// src/app/(app)/hr/leave/page.tsx - Complete replacement
"use client";

import { useState, useEffect } from "react";
import { ls, uid } from "@/services/localStorageService";
import { companyContext } from "@/services/companyContextService";
import { permissionService } from "@/services/permissionService";
import { LeaveEngine } from "@/services/leaveEngine";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/reuseable/DatePicker";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import {
  Plus, CalendarDays, CheckCircle, XCircle, Clock, FileText,
  AlertCircle, Eye, Download, Trash2, Shield, UserCheck
} from "lucide-react";
import { DateRangePickerRac } from "@/components/reuseable/DateRangePickerRac";
import { useAuth } from "@/context/AuthContext";

export default function LeaveManagementPage() {
  const { user, ready } = useAuth();
  const [activeTab, setActiveTab] = useState("my-leaves");
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);

  const [isViewOpen, setIsViewOpen] = useState(false);
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

  const leaveEngine = new LeaveEngine();
  const currentUser = permissionService.getCurrentUser();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    permissionService.init();
    setPermissions({
      canApprove: permissionService.hasPermission("HR", "Leave Management", "update"),
      canCreate: permissionService.hasPermission("HR", "Leave Management", "create"),
      canView: permissionService.hasPermission("HR", "Leave Management", "view"),
      loading: false,
    });
    loadData();
  }, []);

  const loadData = () => {
    const allLeaves = ls.get<any[]>("leaves", []) || [];
    const filteredLeaves = companyContext.filterByContext(allLeaves);
    setLeaves(filteredLeaves);
  
    const allTypes = ls.get<any[]>("leaveTypes", []) || [];
    const activeTypes = allTypes.filter((t: any) => t.status === "ACTIVE");
    setLeaveTypes(activeTypes);
  
    const allEmployees = ls.get<any[]>("employees", []) || [];
    const activeEmployees = allEmployees.filter((e: any) => e.employment_status === "ACTIVE");
    setEmployees(activeEmployees);

    loadLeaveBalances(activeEmployees, activeTypes);
  };

  const loadLeaveBalances = (empList: any[], typesList: any[]) => {
    const storedBalances = ls.get<any[]>("leaveBalances", []) || [];
    const filtered = storedBalances.filter(b => b.year === currentYear);

    // If no balances exist, create default ones
    if (filtered.length === 0 && typesList.length > 0 && empList.length > 0) {
      const newBalances: any[] = [];

      empList.forEach(emp => {
        typesList.forEach(type => {
          newBalances.push(companyContext.addContextToRecord({
            id: uid("lb"),
            employee_id: emp.id,
            employee_name: `${emp.first_name} ${emp.last_name || ""}`,
            leave_type_id: type.id,
            leave_type_name: type.name,
            year: currentYear,
            allocated: type.max_days_per_year,
            used: 0,
            available: type.max_days_per_year,
            carry_forward_from: 0,
          }));
        });
      });
      if (newBalances.length > 0) {
        ls.set("leaveBalances", newBalances);
        setLeaveBalances(newBalances);
        return;
      }
    }
    setLeaveBalances(filtered);
  };

  const getEmployeeBalance = (employeeId, leaveTypeId) => {
    const balance = leaveBalances.find(
      b => b.employee_id === employeeId && b.leave_type_id === leaveTypeId
    );
    return balance || { allocated: 0, used: 0, available: 0 };
  };

  const getUserLeaves = () => {
    // Find employee record for current user
    const userEmployee = employees.find(e => e.email === currentUser?.email);
    if (!userEmployee) return leaves.filter(l => l.created_by === currentUser?.id);
    return leaves.filter(l => l.employee_id === userEmployee.id);
  };

  const getPendingApprovals = () => {
    return leaves.filter(l => l.status === "PENDING");
  };

  const calculateTotalDays = (startDate, endDate, isHalfDay) => {
    const days = leaveEngine.calculateWorkingDays(startDate, endDate);
    return isHalfDay === "true" ? 0.5 : days;
  };

  const handleApply = () => {
    if (!formData.employee_id || !formData.leave_type_id || !formData.start_date || !formData.reason) {
      alert("Please fill all required fields");
      return;
    }

    const selectedEmployee = employees.find(e => e.id === formData.employee_id);
    const selectedType = leaveTypes.find(t => t.id === formData.leave_type_id);
    const totalDays = calculateTotalDays(formData.start_date, formData.end_date || formData.start_date, formData.is_half_day);
    const balance = getEmployeeBalance(formData.employee_id, formData.leave_type_id);

    if (balance.available < totalDays) {
      alert(`Insufficient leave balance. Available: ${balance.available}, Requested: ${totalDays}`);
      return;
    }

    const record = companyContext.addContextToRecord({
      id: uid("lv"),
      employee_id: formData.employee_id,
      employee_name: selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name || ""}` : "",
      leave_type_id: formData.leave_type_id,
      leave_type_name: selectedType?.name || "",
      leave_year: formData.leave_year,
      start_date: formData.start_date,
      end_date: formData.end_date || formData.start_date,
      total_days: totalDays,
      is_half_day: formData.is_half_day,
      reason: formData.reason,
      contact_number: formData.contact_number,
      document_url: formData.document_url,
      status: "PENDING",
      applied_at: new Date().toISOString(),
    });

    const updated = [record, ...leaves];
    setLeaves(updated);
    ls.set("leaves", updated);
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
  };

  const handleApproval = (leaveId, status, rejectionReason = "") => {
    const updated = leaves.map(l => {
      if (l.id === leaveId) {
        const updatedLeave = {
          ...l,
          status,
          approved_by_id: currentUser?.id,
          approval_date: status === "APPROVED" ? new Date().toISOString() : null,
          rejection_reason: status === "REJECTED" ? rejectionReason : null,
        };

        // Update leave balances if approved
        if (status === "APPROVED") {
          updateLeaveBalance(l.employee_id, l.leave_type_id, l.total_days);
        }
        return updatedLeave;
      }
      return l;
    });

    setLeaves(updated);
    ls.set("leaves", updated);
    loadLeaveBalances(employees, leaveTypes);
  };

  const updateLeaveBalance = (employeeId: string, leaveTypeId: string, daysUsed: number) => {
    const balances = ls.get<any[]>("leaveBalances", []) || [];
    const idx = balances.findIndex(b =>
      b.employee_id === employeeId && b.leave_type_id === leaveTypeId && b.year === currentYear
    );

    if (idx !== -1) {
      balances[idx].used += daysUsed;
      balances[idx].available = balances[idx].allocated - balances[idx].used + (balances[idx].carry_forward_from || 0);
      ls.set("leaveBalances", balances);
      loadLeaveBalances(employees, leaveTypes);
    }
  };

  const handleDelete = (leaveId) => {
    if (!confirm("Delete this leave request?")) return;
    const updated = leaves.filter(l => l.id !== leaveId);
    setLeaves(updated);
    ls.set("leaves", updated);
  };

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: "bg-warning/15 text-warning border-warning/30",
      APPROVED: "bg-success/15 text-success border-success/30",
      REJECTED: "bg-destructive/15 text-destructive border-destructive/30",
      CANCELLED: "bg-muted text-muted-foreground border-border",
      DRAFT: "bg-muted/40 text-muted-foreground border-border",
    };
    return styles[status] || styles.PENDING;
  };

  if (permissions.loading) {
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
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/15 flex items-center justify-center">
            <Shield className="w-8 h-8 text-destructive" />
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

  // Employee options for apply form
  const employeeOptions = employees.map(e => ({
    value: e.id,
    label: `${e.employee_id} - ${e.first_name} ${e.last_name || ""} (${e.department})`
  }));

  // Leave type options
  const leaveTypeOptions = leaveTypes.map(t => ({ value: t.id, label: `${t.name} (${t.max_days_per_year} days/year)` }));

  return (
    <div>
      <PageHeader
        title="Leave Management"
        subtitle="Apply for leave, track requests, and manage approvals"
        actions={
          permissions.canCreate && (
            <button
              onClick={() => setIsApplyOpen(true)}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm"
            >
              <Plus className="w-4 h-4" /> Apply for Leave
            </button>
          )
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">My Leave Requests</div>
          <div className="text-2xl font-semibold">{userLeaves.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Approved</div>
          <div className="text-2xl font-semibold text-success">
            {userLeaves.filter(l => l.status === "APPROVED").length}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Pending</div>
          <div className="text-2xl font-semibold text-warning">
            {userLeaves.filter(l => l.status === "PENDING").length}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Rejected</div>
          <div className="text-2xl font-semibold text-destructive">
            {userLeaves.filter(l => l.status === "REJECTED").length}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/40 mb-4">
          <TabsTrigger value="my-leaves">
            <CalendarDays className="w-4 h-4 mr-1" /> My Leaves
          </TabsTrigger>
          {permissions.canApprove && (
            <TabsTrigger value="approvals">
              <UserCheck className="w-4 h-4 mr-1" /> Approvals
              {pendingApprovals.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-destructive text-destructive-foreground">
                  {pendingApprovals.length}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="balances">
            <Clock className="w-4 h-4 mr-1" /> Leave Balances
          </TabsTrigger>
        </TabsList>

        {/* My Leaves Tab */}
        <TabsContent value="my-leaves" className="m-0">
          <div className="bg-card border border-border rounded-2xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Leave Type</th>
                    <th className="text-left px-4 py-3">Start Date</th>
                    <th className="text-left px-4 py-3">End Date</th>
                    <th className="text-left px-4 py-3">Days</th>
                    <th className="text-left px-4 py-3">Reason</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
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
                  {userLeaves.map(l => {
                    const leaveType = leaveTypes.find(t => t.id === l.leave_type_id);
                    return (
                      <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{leaveType?.name || l.leave_type_id}</td>
                        <td className="px-4 py-3">{l.start_date}</td>
                        <td className="px-4 py-3">{l.end_date}</td>
                        <td className="px-4 py-3">{l.total_days}{l.is_half_day === "true" && " (Half)"}</td>
                        <td className="px-4 py-3 max-w-[200px] truncate">{l.reason}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border ${getStatusBadge(l.status)}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => { setSelectedLeave(l); setIsViewOpen(true); }}
                            className="p-1.5 rounded-md hover:bg-muted"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {l.status === "DRAFT" && (
                            <button
                              onClick={() => handleDelete(l.id)}
                              className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive"
                              title="Delete"
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
            <div className="bg-card border border-border rounded-2xl shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3">Employee</th>
                      <th className="text-left px-4 py-3">Department</th>
                      <th className="text-left px-4 py-3">Leave Type</th>
                      <th className="text-left px-4 py-3">Dates</th>
                      <th className="text-left px-4 py-3">Days</th>
                      <th className="text-left px-4 py-3">Reason</th>
                      <th className="px-4 py-3 text-right">Actions</th>
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
                    {pendingApprovals.map(l => {
                      const employee = employees.find(e => e.id === l.employee_id);
                      const leaveType = leaveTypes.find(t => t.id === l.leave_type_id);
                      return (
                        <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">
                            {employee?.first_name} {employee?.last_name || ""}
                            <div className="text-xs text-muted-foreground">{employee?.employee_id}</div>
                          </td>
                          <td className="px-4 py-3">{employee?.department || "—"}</td>
                          <td className="px-4 py-3">{leaveType?.name || l.leave_type_id}</td>
                          <td className="px-4 py-3">
                            {l.start_date} → {l.end_date}
                          </td>
                          <td className="px-4 py-3">{l.total_days}</td>
                          <td className="px-4 py-3 max-w-[150px] truncate">{l.reason}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproval(l.id, "APPROVED")}
                                className="px-2.5 py-1 rounded-md bg-success/15 text-success text-xs hover:bg-success/20 flex items-center gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt("Rejection reason (optional):");
                                  handleApproval(l.id, "REJECTED", reason || undefined);
                                }}
                                className="px-2.5 py-1 rounded-md bg-destructive/15 text-destructive text-xs hover:bg-destructive/20 flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                              <button
                                onClick={() => { setSelectedLeave(l); setIsViewOpen(true); }}
                                className="p-1.5 rounded-md hover:bg-muted"
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
          <div className="bg-card border border-border rounded-2xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Employee</th>
                    <th className="text-left px-4 py-3">Department</th>
                    <th className="text-left px-4 py-3">Leave Type</th>
                    <th className="text-left px-4 py-3">Allocated</th>
                    <th className="text-left px-4 py-3">Used</th>
                    <th className="text-left px-4 py-3">Available</th>
                    <th className="text-left px-4 py-3">Carried Forward</th>
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
                  {leaveBalances.map(b => {
                    const employee = employees.find(e => e.id === b.employee_id);
                    const leaveType = leaveTypes.find(t => t.id === b.leave_type_id);
                    return (
                      <tr key={b.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">
                          {employee?.first_name} {employee?.last_name || ""}
                          <div className="text-xs text-muted-foreground">{employee?.employee_id}</div>
                        </td>
                        <td className="px-4 py-3">{employee?.department || "—"}</td>
                        <td className="px-4 py-3">{b.leave_type_name || leaveType?.name || b.leave_type_id}</td>
                        <td className="px-4 py-3 font-medium">{b.allocated} days</td>
                        <td className="px-4 py-3 text-warning">{b.used} days</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${b.available < 5 ? "text-destructive" : "text-success"}`}>
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
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
              <h2 className="font-semibold flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Apply for Leave
              </h2>
              <button onClick={() => setIsApplyOpen(false)} className="p-1.5 rounded-md hover:bg-muted">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Employee *</span>
                  <SearchableSelect
                    value={formData.employee_id}
                    onChange={(val) => setFormData({ ...formData, employee_id: val })}
                    options={employeeOptions}
                    required
                    placeholder="Select Employee"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Leave Year *</span>
                  <input
                    type="number"
                    value={formData.leave_year}
                    onChange={(e) => setFormData({ ...formData, leave_year: parseInt(e.target.value) })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Leave Type *</span>
                  <SearchableSelect
                    value={formData.leave_type_id}
                    onChange={(val) => setFormData({ ...formData, leave_type_id: val })}
                    options={leaveTypeOptions}
                    required
                    placeholder="Select Leave Type"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
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
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Leave Period *</span>
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

              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Reason *</span>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Please provide a detailed reason for your leave request..."
                />
              </label>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Emergency Contact Number</span>
                  <input
                    type="tel"
                    value={formData.contact_number}
                    onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                    placeholder="During leave period"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
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
                <div className="bg-info/10 rounded-xl p-3">
                  <div className="text-sm font-medium text-info">Leave Summary</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Calculated Days: {calculateTotalDays(formData.start_date, formData.end_date || formData.start_date, formData.is_half_day)} days
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Available Balance: {getEmployeeBalance(formData.employee_id, formData.leave_type_id).available} days
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
              <button onClick={() => setIsApplyOpen(false)} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
                Cancel
              </button>
              <button onClick={handleApply} className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Leave Modal */}
      {isViewOpen && selectedLeave && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-semibold">Leave Request Details</h2>
              <button onClick={() => setIsViewOpen(false)} className="p-1.5 rounded-md hover:bg-muted">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Leave Type:</div>
                <div className="font-medium">{leaveTypes.find(t => t.id === selectedLeave.leave_type_id)?.name || selectedLeave.leave_type_id}</div>

                <div className="text-muted-foreground">Period:</div>
                <div>{selectedLeave.start_date} → {selectedLeave.end_date}</div>

                <div className="text-muted-foreground">Total Days:</div>
                <div>{selectedLeave.total_days}{selectedLeave.is_half_day === "true" && " (Half Day)"}</div>

                <div className="text-muted-foreground">Status:</div>
                <div><span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${getStatusBadge(selectedLeave.status)}`}>{selectedLeave.status}</span></div>

                <div className="text-muted-foreground">Applied On:</div>
                <div>{selectedLeave.applied_at ? new Date(selectedLeave.applied_at).toLocaleDateString() : "—"}</div>

                <div className="text-muted-foreground">Reason:</div>
                <div className="col-span-2">{selectedLeave.reason}</div>

                {selectedLeave.contact_number && (
                  <>
                    <div className="text-muted-foreground">Emergency Contact:</div>
                    <div>{selectedLeave.contact_number}</div>
                  </>
                )}

                {selectedLeave.rejection_reason && (
                  <>
                    <div className="text-muted-foreground">Rejection Reason:</div>
                    <div className="text-destructive">{selectedLeave.rejection_reason}</div>
                  </>
                )}

                {selectedLeave.approved_by_id && (
                  <>
                    <div className="text-muted-foreground">Approved By:</div>
                    <div>{selectedLeave.approved_by_id}</div>
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