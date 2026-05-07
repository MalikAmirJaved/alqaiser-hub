// @ts-nocheck
"use client";

// ============================================
// FILE: src/routes/_app.hr.employees.jsx (UPDATED - with default shift handling)
// ============================================

import { useState, useEffect } from "react";
import { ls, uid } from "@/services/localStorageService";
import { companyContext } from "@/services/companyContextService";
import { permissionService } from "@/services/permissionService";
import PageHeader from "@/components/PageHeader";
import EmployeeForm from "@/components/Forms/EmployeeForm";
import { Plus, Pencil, Trash2, Search, Download, Shield, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default EmployeesPage;

function EmployeesPage() {
  const { user, ready } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canView: true,
    loading: true,
  });

  useEffect(() => {
    permissionService.init();
    companyContext.init();
    
    const canCreate = permissionService.hasPermission("HR", "Employee Management", "create");
    const canUpdate = permissionService.hasPermission("HR", "Employee Management", "update");
    const canDelete = permissionService.hasPermission("HR", "Employee Management", "delete");
    const canView = permissionService.hasPermission("HR", "Employee Management", "view");
    
    setPermissions({
      canCreate,
      canUpdate,
      canDelete,
      canView,
      loading: false,
    });
    
    loadEmployees();
    loadShiftTemplates();
  }, []);

  const loadEmployees = () => {
    const allEmployees = ls.get<any[]>("employees", []) || [];
    // Filter by company context (multi-tenant isolation)
    const filtered = companyContext.filterByContext(allEmployees);
    setEmployees(filtered);
  };

  const loadShiftTemplates = () => {
    const templates = ls.get<any[]>("shifts_templates", []) || [];
    const activeTemplates = templates.filter(t => t.is_active === true);
    setShiftTemplates(activeTemplates);
  };

  // Helper function to get employee's current default shift template name
  const getEmployeeDefaultShiftName = (employeeId, defaultShiftId) => {
    // First check employee_default_shifts table for active default
    const defaultShifts = ls.get<any[]>("employee_default_shifts", []) || [];
    const today = new Date().toISOString().split("T")[0];
    
    const activeDefault = defaultShifts.find(d => 
      d.employee_id === employeeId &&
      d.effective_from <= today &&
      (d.effective_to === null || d.effective_to >= today)
    );
    
    if (activeDefault) {
      const template = shiftTemplates.find(t => t.id === activeDefault.template_id);
      return template?.name || null;
    }
    
    // Fallback to employee's default_shift_id
    if (defaultShiftId) {
      const template = shiftTemplates.find(t => t.id === defaultShiftId);
      return template?.name || null;
    }
    
    return null;
  };

  const handleSaveEmployee = (employeeData) => {
    let updatedEmployees;
    let savedEmployee;
    
    if (editingEmployee) {
      // Store original default shift ID for comparison
      const originalDefaultShiftId = editingEmployee.default_shift_id;
      
      // Update existing employee
      savedEmployee = { 
        ...editingEmployee, 
        ...employeeData, 
        updated_at: new Date().toISOString() 
      };
      
      const index = employees.findIndex(emp => emp.id === editingEmployee.id);
      updatedEmployees = [...employees];
      updatedEmployees[index] = savedEmployee;
      
      // Handle default shift changes
      if (employeeData.default_shift_id !== originalDefaultShiftId) {
        updateEmployeeDefaultShift(savedEmployee, employeeData.default_shift_id, originalDefaultShiftId);
      }
    } else {
      // Create new employee with company context
      const newEmployee = companyContext.addContextToRecord({
        id: uid("emp"),
        ...employeeData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      savedEmployee = newEmployee;
      updatedEmployees = [newEmployee, ...employees];
      
      // Create default shift assignment if provided
      if (employeeData.default_shift_id && employeeData.joining_date) {
        createEmployeeDefaultShift(savedEmployee.id, employeeData.default_shift_id, employeeData.joining_date);
      }
    }
    
    ls.set("employees", updatedEmployees);

    if (employeeData.asset_category_id && !editingEmployee) {
  const cats = ls.get<any[]>("hrAssetCategories", []) || [];
  const cat = cats.find(c => c.id === employeeData.asset_category_id);
  if (cat) {
    const assetIds = JSON.parse(cat.asset_ids || "[]");
    const newAssignments: any[] = assetIds.map(aId => {
      const asset = ls.get<any[]>("hrAssets", []).find(a => a.id === aId);
      return companyContext.addContextToRecord({
        id: uid("hrt_as"),
        employee_id: savedEmployee.id,
        employee_name: `${savedEmployee.first_name} ${savedEmployee.last_name || ""}`,
        category_id: cat.id,
        category_name: cat.name,
        asset_id: aId,
        asset_name: asset?.name || aId,
        serial_number: null,
        assigned_date: new Date().toISOString().split("T")[0],
        status: "ACTIVE",
        condition: "NEW",
        notes: "Assigned via Employee Creation"
      });
    });
    const existingAssignments = ls.get<any[]>("employeeAssetAssignments", []) || [];
    ls.set("employeeAssetAssignments", [...newAssignments, ...existingAssignments]);
  }
}

    setEmployees(updatedEmployees);
    setModalOpen(false);
    setEditingEmployee(null);
  };

  // Create default shift for a new employee
  const createEmployeeDefaultShift = (employeeId, templateId, effectiveFrom) => {
    const defaultShifts = ls.get<any[]>("employee_default_shifts", []) || [];
    
    // Check if there's already an open-ended default for this employee
    const existingOpenEnded = defaultShifts.find(d => 
      d.employee_id === employeeId && d.effective_to === null
    );
    
    if (existingOpenEnded) {
      // Update existing instead of creating new
      const updated = defaultShifts.map(d => 
        d.id === existingOpenEnded.id 
          ? { ...d, template_id: templateId, effective_from: effectiveFrom }
          : d
      );
      ls.set("employee_default_shifts", updated);
      return;
    }
    
    // Create new default shift
    const newDefaultShift = {
      id: uid("eds"),
      employee_id: employeeId,
      template_id: templateId,
      effective_from: effectiveFrom,
      effective_to: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    ls.set("employee_default_shifts", [newDefaultShift, ...defaultShifts]);
  };

  // Update employee's default shift when changed in edit
  const updateEmployeeDefaultShift = (employee, newTemplateId, oldTemplateId) => {
    const defaultShifts = ls.get("employee_default_shifts", []);
    const today = new Date().toISOString().split("T")[0];
    
    // Find active default shift
    const activeDefault = defaultShifts.find(d => 
      d.employee_id === employee.id &&
      d.effective_from <= today &&
      (d.effective_to === null || d.effective_to >= today)
    );
    
    if (activeDefault) {
      // Update existing active default
      const updated = defaultShifts.map(d => 
        d.id === activeDefault.id 
          ? { ...d, template_id: newTemplateId, updated_at: new Date().toISOString() }
          : d
      );
      ls.set("employee_default_shifts", updated);
    } else if (newTemplateId) {
      // Create new default shift starting from today
      const newDefaultShift = {
        id: uid("eds"),
        employee_id: employee.id,
        template_id: newTemplateId,
        effective_from: today,
        effective_to: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      ls.set("employee_default_shifts", [newDefaultShift, ...defaultShifts]);
    }
  };

  const handleDelete = (employee) => {
    if (!permissions.canDelete) {
      alert("You don't have permission to delete employees.");
      return;
    }
    if (!confirm(`Delete employee "${employee.first_name} ${employee.last_name}"? This will also remove their shift assignments.`)) return;
    
    // Also delete employee's default shifts and assignments
    const defaultShifts = ls.get<any[]>("employee_default_shifts", []) || [];
    const updatedDefaultShifts = defaultShifts.filter(d => d.employee_id !== employee.id);
    ls.set("employee_default_shifts", updatedDefaultShifts);
    
    const assignments = ls.get<any[]>("shifts_assignments", []) || [];
    const updatedAssignments = assignments.filter(a => !a.employeeIds.includes(employee.id));
    ls.set("shifts_assignments", updatedAssignments);
    
    const updatedEmployees = employees.filter(emp => emp.id !== employee.id);
    ls.set("employees", updatedEmployees);
    setEmployees(updatedEmployees);
  };

  const openAddModal = () => {
    if (!permissions.canCreate) {
      alert("You don't have permission to add employees.");
      return;
    }
    setEditingEmployee(null);
    setModalOpen(true);
  };

  const openEditModal = (employee) => {
    if (!permissions.canUpdate) {
      alert("You don't have permission to edit employees.");
      return;
    }
    setEditingEmployee(employee);
    setModalOpen(true);
  };

  const exportCsv = () => {
    const headers = ["Employee ID", "First Name", "Last Name", "Department", "Designation", "Employment Type", "Status", "Phone", "Email", "Default Shift"];
    const rows = filteredEmployees.map(emp => [
      emp.employee_id,
      emp.first_name,
      emp.last_name || "",
      emp.department,
      emp.designation || "",
      emp.employment_type,
      emp.employment_status,
      emp.phone,
      emp.email || "",
      getEmployeeDefaultShiftName(emp.id, emp.default_shift_id) || "—",
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

  const filteredEmployees = employees.filter(emp =>
    emp.employee_id?.toLowerCase().includes(query.toLowerCase()) ||
    emp.first_name?.toLowerCase().includes(query.toLowerCase()) ||
    emp.last_name?.toLowerCase().includes(query.toLowerCase()) ||
    emp.department?.toLowerCase().includes(query.toLowerCase()) ||
    emp.designation?.toLowerCase().includes(query.toLowerCase())
  );

  if (permissions.loading) {
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
          <div className="text-xl font-semibold">{employees.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Active</div>
          <div className="text-xl font-semibold text-success">{employees.filter(e => e.employment_status === "ACTIVE").length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">On Leave</div>
          <div className="text-xl font-semibold text-warning">{employees.filter(e => e.employment_status === "ON_LEAVE").length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Departments</div>
          <div className="text-xl font-semibold">{new Set(employees.map(e => e.department)).size}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">With Default Shift</div>
          <div className="text-xl font-semibold">
            {employees.filter(e => e.default_shift_id || getEmployeeDefaultShiftName(e.id, e.default_shift_id)).length}
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
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-muted-foreground">
                    No employees found.
                  </td>
                </tr>
              )}
              {filteredEmployees.map((employee) => {
                const defaultShiftName = getEmployeeDefaultShiftName(employee.id, employee.default_shift_id);
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