// src/app/(app)/settings/leave-types/page.tsx
"use client";

import { useState, useEffect } from "react";
import { ls, uid } from "@/services/localStorageService";
import { companyContext } from "@/services/companyContextService";
import { permissionService } from "@/services/permissionService";
import PageHeader from "@/components/PageHeader";
import { Plus, Pencil, Trash2, Search, Shield, CheckCircle, XCircle } from "lucide-react";
import { DatePicker } from "@/components/reuseable/DatePicker";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

export default function LeaveTypesPage() {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canView: true,
    loading: true,
  });

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    max_days_per_year: "",
    is_paid: "true",
    requires_document: "false",
    carry_forward_allowed: "false",
    max_carry_forward_days: "",
    min_advance_notice_days: "",
    applicable_to: "ALL",
    status: "ACTIVE",
  });

  useEffect(() => {
    permissionService.init();
    setPermissions({
      canCreate: permissionService.hasPermission("SETTINGS", "Leave Types", "create"),
      canUpdate: permissionService.hasPermission("SETTINGS", "Leave Types", "update"),
      canDelete: permissionService.hasPermission("SETTINGS", "Leave Types", "delete"),
      canView: permissionService.hasPermission("SETTINGS", "Leave Types", "view"),
      loading: false,
    });
    loadLeaveTypes();
  }, []);

  const loadLeaveTypes = () => {
    const allTypes = ls.get("leaveTypes", []);
    const filtered = companyContext.filterByContext(allTypes);
    setLeaveTypes(filtered);
  };

  const handleSave = () => {
    if (!formData.name || !formData.code || !formData.max_days_per_year) {
      alert("Please fill all required fields");
      return;
    }

    let updatedTypes;
    if (editingType) {
      updatedTypes = leaveTypes.map(t =>
        t.id === editingType.id
          ? { ...t, ...formData, updated_at: new Date().toISOString() }
          : t
      );
    } else {
      const newType = companyContext.addContextToRecord({
        id: uid("lt"),
        ...formData,
        max_days_per_year: Number(formData.max_days_per_year),
        max_carry_forward_days: formData.max_carry_forward_days ? Number(formData.max_carry_forward_days) : null,
        min_advance_notice_days: formData.min_advance_notice_days ? Number(formData.min_advance_notice_days) : null,
      });
      updatedTypes = [newType, ...leaveTypes];
    }

    ls.set("leaveTypes", updatedTypes);
    setLeaveTypes(updatedTypes);
    setModalOpen(false);
    setEditingType(null);
    setFormData({
      name: "",
      code: "",
      max_days_per_year: "",
      is_paid: "true",
      requires_document: "false",
      carry_forward_allowed: "false",
      max_carry_forward_days: "",
      min_advance_notice_days: "",
      applicable_to: "ALL",
      status: "ACTIVE",
    });
  };

  const handleDelete = (type) => {
    if (!confirm(`Delete leave type "${type.name}"? This will affect existing leave records.`)) return;
    const updated = leaveTypes.filter(t => t.id !== type.id);
    ls.set("leaveTypes", updated);
    setLeaveTypes(updated);
  };

  const filteredTypes = leaveTypes.filter(t =>
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (permissions.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!permissions.canView) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/15 flex items-center justify-center">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You don't have permission to configure leave types.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Leave Types Configuration"
        subtitle="Define leave policies that employees can request"
        actions={
          permissions.canCreate && (
            <button
              onClick={() => {
                setEditingType(null);
                setFormData({
                  name: "",
                  code: "",
                  max_days_per_year: "",
                  is_paid: "true",
                  requires_document: "false",
                  carry_forward_allowed: "false",
                  max_carry_forward_days: "",
                  min_advance_notice_days: "",
                  applicable_to: "ALL",
                  status: "ACTIVE",
                });
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm"
            >
              <Plus className="w-4 h-4" /> Add Leave Type
            </button>
          )
        }
      />

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Total Leave Types</div>
          <div className="text-xl font-semibold">{leaveTypes.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Active Types</div>
          <div className="text-xl font-semibold">{leaveTypes.filter(t => t.status === "ACTIVE").length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Paid Types</div>
          <div className="text-xl font-semibold">{leaveTypes.filter(t => t.is_paid === "true").length}</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-card border border-border rounded-2xl shadow-sm">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leave types by name or code..."
              className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Leave Types Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Code</th>
                <th className="text-left px-4 py-2.5">Max Days/Year</th>
                <th className="text-left px-4 py-2.5">Paid</th>
                <th className="text-left px-4 py-2.5">Carry Forward</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTypes.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    No leave types found. Click "Add Leave Type" to create one.
                  </td>
                </tr>
              )}
              {filteredTypes.map((type) => (
                <tr key={type.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{type.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{type.code}</td>
                  <td className="px-4 py-2.5">{type.max_days_per_year} days</td>
                  <td className="px-4 py-2.5">
                    {type.is_paid === "true" ? (
                      <CheckCircle className="w-4 h-4 text-success" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {type.carry_forward_allowed === "true" ? (
                      <span className="text-xs">{type.max_carry_forward_days || "Unlimited"} days</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                      type.status === "ACTIVE"
                        ? "bg-success/15 text-success border-success/30"
                        : "bg-destructive/15 text-destructive border-destructive/30"
                    }`}>
                      {type.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {permissions.canUpdate && (
                      <button
                        onClick={() => {
                          setEditingType(type);
                          setFormData({
                            name: type.name,
                            code: type.code,
                            max_days_per_year: type.max_days_per_year,
                            is_paid: type.is_paid,
                            requires_document: type.requires_document || "false",
                            carry_forward_allowed: type.carry_forward_allowed || "false",
                            max_carry_forward_days: type.max_carry_forward_days || "",
                            min_advance_notice_days: type.min_advance_notice_days || "",
                            applicable_to: type.applicable_to || "ALL",
                            status: type.status,
                          });
                          setModalOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted"
                        aria-label="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {permissions.canDelete && (
                      <button
                        onClick={() => handleDelete(type)}
                        className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
              <h2 className="font-semibold">
                {editingType ? "Edit Leave Type" : "Add New Leave Type"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-md hover:bg-muted">
                ✕
              </button>
            </div>

            <div className="p-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Leave Type Name *</span>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g., Annual Leave"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Code *</span>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring font-mono"
                    placeholder="e.g., AL"
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mt-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Max Days Per Year *</span>
                  <input
                    type="number"
                    value={formData.max_days_per_year}
                    onChange={(e) => setFormData({ ...formData, max_days_per_year: e.target.value })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g., 20"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Min Advance Notice (Days)</span>
                  <input
                    type="number"
                    value={formData.min_advance_notice_days}
                    onChange={(e) => setFormData({ ...formData, min_advance_notice_days: e.target.value })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g., 2"
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mt-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Paid Leave</span>
                  <select
                    value={formData.is_paid}
                    onChange={(e) => setFormData({ ...formData, is_paid: e.target.value })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="true">Yes (Paid)</option>
                    <option value="false">No (Unpaid)</option>
                  </select>
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Requires Supporting Document</span>
                  <select
                    value={formData.requires_document}
                    onChange={(e) => setFormData({ ...formData, requires_document: e.target.value })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes (e.g., Medical Certificate)</option>
                  </select>
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mt-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Carry Forward Allowed</span>
                  <select
                    value={formData.carry_forward_allowed}
                    onChange={(e) => setFormData({ ...formData, carry_forward_allowed: e.target.value })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </label>
                {formData.carry_forward_allowed === "true" && (
                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground">Max Carry Forward Days</span>
                    <input
                      type="number"
                      value={formData.max_carry_forward_days}
                      onChange={(e) => setFormData({ ...formData, max_carry_forward_days: e.target.value })}
                      className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Leave empty for unlimited"
                    />
                  </label>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mt-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Applicable To</span>
                  <select
                    value={formData.applicable_to}
                    onChange={(e) => setFormData({ ...formData, applicable_to: e.target.value })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="ALL">All Employees</option>
                    <option value="FULL_TIME">Full Time Only</option>
                    <option value="CONTRACT">Contract Only</option>
                    <option value="PROBATION">Probation Only</option>
                  </select>
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Status</span>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
                Cancel
              </button>
              <button onClick={handleSave} className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
                {editingType ? "Save Changes" : "Create Leave Type"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}