// @ts-nocheck
"use client";

// ============================================
// FILE: src/app/(dashboard)/hr/employees/page.tsx (BACKEND INTEGRATED)
// ============================================

import { useState, useEffect } from "react";
import { useEmployees, useEmployeeStats, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from "@/hooks/useEmployees";
import { useShiftTemplates } from "@/hooks/useShiftTemplates";
import { permissionService } from "@/services/permissionService";
import PageHeader from "@/components/PageHeader";
import EmployeeForm from "@/components/Forms/EmployeeForm";
import { Plus, Pencil, Trash2, Search, Download, Shield, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function EmployeesPage() {
  const { user, ready } = useAuth();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  
  const { data: employees = [], isLoading } = useEmployees(
    query ? { search: query } : undefined
  );
  const { data: stats } = useEmployeeStats();
  const { data: shiftTemplates = [] } = useShiftTemplates();
  
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canView: true,
    loading: true,
  });

  useEffect(() => {
    permissionService.init();
    
    setPermissions({
      canCreate: permissionService.hasPermission("HR", "Employee Management", "create"),
      canUpdate: permissionService.hasPermission("HR", "Employee Management", "update"),
      canDelete: permissionService.hasPermission("HR", "Employee Management", "delete"),
      canView: permissionService.hasPermission("HR", "Employee Management", "view"),
      loading: false,
    });
  }, []);

  const getEmployeeDefaultShiftName = (employee) => {
    if (employee.default_shift_name) return employee.default_shift_name;
    if (employee.default_shift_id) {
      const template = shiftTemplates.find(t => t.id === employee.default_shift_id);
      return template?.name || null;
    }
    return null;
  };

  const handleSaveEmployee = async (employeeData) => {
    try {
      if (editingEmployee) {
        await updateEmployee.mutateAsync({
          id: editingEmployee.id,
          ...employeeData,
        });
      } else {
        await createEmployee.mutateAsync(employeeData);
      }
      
      setModalOpen(false);
      setEditingEmployee(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to save employee");
    }
  };

  const handleDelete = async (employee) => {
    if (!permissions.canDelete) {
      toast.error("You don't have permission to delete employees.");
      return;
    }
    if (!confirm(`Delete employee "${employee.first_name} ${employee.last_name || ''}"?`)) return;
    
    try {
      await deleteEmployee.mutateAsync(employee.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete employee");
    }
  };

  const openAddModal = () => {
    if (!permissions.canCreate) {
      toast.error("You don't have permission to add employees.");
      return;
    }
    setEditingEmployee(null);
    setModalOpen(true);
  };

  const openEditModal = (employee) => {
    if (!permissions.canUpdate) {
      toast.error("You don't have permission to edit employees.");
      return;
    }
    setEditingEmployee(employee);
    setModalOpen(true);
  };

  const exportCsv = () => {
    const headers = ["Employee ID", "First Name", "Last Name", "Department", "Designation", "Employment Type", "Status", "Phone", "Email", "Default Shift"];
    const rows = employees.map(emp => [
      emp.employee_id,
      emp.first_name,
      emp.last_name || "",
      emp.department,
      emp.designation || "",
      emp.employment_type,
      emp.employment_status,
      emp.phone,
      emp.email || "",
      getEmployeeDefaultShiftName(emp) || "—",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (permissions.loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
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
            You don't have permission to view Employee Management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Employee Management"
        subtitle="Manage employee records, employment details, and default shifts"
        actions={
          <>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-muted"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            {permissions.canCreate && (
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
              >
                <Plus className="w-4 h-4" /> Add Employee
              </button>
            )}
          </>
        }
      />

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-5 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Total Employees</div>
          <div className="text-xl font-semibold">{stats?.totalEmployees || employees.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Active</div>
          <div className="text-xl font-semibold text-success">
            {stats?.activeEmployees || employees.filter(e => e.employment_status === "ACTIVE").length}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">On Leave</div>
          <div className="text-xl font-semibold text-warning">
            {stats?.onLeave || employees.filter(e => e.employment_status === "ON_LEAVE").length}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Departments</div>
          <div className="text-xl font-semibold">
            {stats?.departments || new Set(employees.map(e => e.department)).size}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">With Default Shift</div>
          <div className="text-xl font-semibold">
            {stats?.withDefaultShift || employees.filter(e => e.default_shift_id || e.default_shift_name).length}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-card border border-border rounded-2xl shadow-sm">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employees by ID, name, department, designation..."
              className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Employees Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Employee ID</th>
                <th className="text-left px-4 py-2.5">Full Name</th>
                <th className="text-left px-4 py-2.5">Department</th>
                <th className="text-left px-4 py-2.5">Designation</th>
                <th className="text-left px-4 py-2.5">Employment Type</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Default Shift</th>
                <th className="text-left px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-muted-foreground">
                    No employees found.
                  </td>
                </tr>
              )}
              {employees.map((employee) => {
                const defaultShiftName = getEmployeeDefaultShiftName(employee);
                return (
                  <tr key={employee.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{employee.employee_id}</td>
                    <td className="px-4 py-2.5 font-medium">
                      {employee.first_name} {employee.last_name || ""}
                    </td>
                    <td className="px-4 py-2.5">{employee.department}</td>
                    <td className="px-4 py-2.5">{employee.designation || "—"}</td>
                    <td className="px-4 py-2.5">{employee.employment_type?.replace("_", " ")}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                        employee.employment_status === "ACTIVE"
                          ? "bg-success/15 text-success border-success/30"
                          : employee.employment_status === "ON_LEAVE"
                          ? "bg-warning/15 text-warning border-warning/30"
                          : "bg-destructive/15 text-destructive border-destructive/30"
                      }`}>
                        {employee.employment_status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {defaultShiftName ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs">{defaultShiftName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{employee.phone}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {permissions.canUpdate && (
                        <button
                          onClick={() => openEditModal(employee)}
                          className="p-1.5 rounded-md hover:bg-muted"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {permissions.canDelete && (
                        <button
                          onClick={() => handleDelete(employee)}
                          className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {!permissions.canUpdate && !permissions.canDelete && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Form Modal */}
      {modalOpen && (
        <EmployeeForm
          initialData={editingEmployee}
          onSubmit={handleSaveEmployee}
          onCancel={() => {
            setModalOpen(false);
            setEditingEmployee(null);
          }}
        />
      )}
    </div>
  );
}