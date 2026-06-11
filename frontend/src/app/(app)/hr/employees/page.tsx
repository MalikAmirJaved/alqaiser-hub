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
import { StatsCards } from "@/components/reuseable/StatsCards";
import { TableView, GridView } from "@/components/reuseable/TableGridView";
import { Plus, Pencil, Trash2, Search, Download, Shield, Clock, LayoutGrid, LayoutList } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function EmployeesPage() {
  const { user, ready } = useAuth();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  
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
      setSelectedRows(new Set()); // Clear selections after save
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
      setSelectedRows(new Set()); // Clear selections after delete
    } catch (error: any) {
      toast.error(error.message || "Failed to delete employee");
    }
  };

  const handleBulkDelete = async () => {
    if (!permissions.canDelete) {
      toast.error("You don't have permission to delete employees.");
      return;
    }
    
    const selectedEmployees = Array.from(selectedRows).map(idx => employees[idx]);
    if (selectedEmployees.length === 0) return;
    
    if (!confirm(`Delete ${selectedEmployees.length} employee(s)? This action cannot be undone.`)) return;
    
    try {
      // TODO: Replace with bulk delete API when available
      // For now, delete one by one
      await Promise.all(selectedEmployees.map(emp => deleteEmployee.mutateAsync(emp.id)));
      setSelectedRows(new Set());
      toast.success(`${selectedEmployees.length} employee(s) deleted successfully`);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete employees");
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

  // Prepare stats data for the reusable component
  const employeeStats = [
    {
      id: "total-employees",
      label: "Total Employees",
      value: stats?.totalEmployees || employees.length
    },
    {
      id: "active",
      label: "Active",
      value: stats?.activeEmployees || employees.filter(e => e.employment_status === "ACTIVE").length,
      valueClassName: "text-success"
    },
    {
      id: "on-leave",
      label: "On Leave",
      value: stats?.onLeave || employees.filter(e => e.employment_status === "ON_LEAVE").length,
      valueClassName: "text-warning"
    },
    {
      id: "departments",
      label: "Departments",
      value: stats?.departments || new Set(employees.map(e => e.department)).size
    },
    {
      id: "default-shift",
      label: "With Default Shift",
      value: stats?.withDefaultShift || employees.filter(e => e.default_shift_id || e.default_shift_name).length
    }
  ];

  // Define columns for the table
  const employeeColumns = [
    {
      key: "employee_id",
      label: "Employee ID",
      sortable: true,
      render: (value) => <span className="font-mono text-xs">{value}</span>
    },
    {
      key: "full_name",
      label: "Full Name",
      sortable: true,
      render: (_, row) => `${row.first_name} ${row.last_name || ""}`
    },
    {
      key: "department",
      label: "Department",
      sortable: true
    },
    {
      key: "designation",
      label: "Designation",
      render: (value) => value || "—"
    },
    {
      key: "employment_type",
      label: "Employment Type",
      render: (value) => value?.replace("_", " ")
    },
    {
      key: "employment_status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
          value === "ACTIVE"
            ? "bg-success/15 text-success border-success/30"
            : value === "ON_LEAVE"
            ? "bg-warning/15 text-warning border-warning/30"
            : "bg-destructive/15 text-destructive border-destructive/30"
        }`}>
          {value}
        </span>
      )
    },
    {
      key: "default_shift",
      label: "Default Shift",
      render: (_, row) => {
        const shiftName = getEmployeeDefaultShiftName(row);
        return shiftName ? (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs">{shiftName}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        );
      }
    },
    {
      key: "phone",
      label: "Phone"
    }
  ];

  // Define actions for each row
  const renderActions = (row, idx) => (
    <>
      {permissions.canUpdate && (
        <button
          onClick={() => openEditModal(row)}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="Edit"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}
      {permissions.canDelete && (
        <button
          onClick={() => handleDelete(row)}
          className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive transition-colors"
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </>
  );

  // Render card for grid view
  const renderEmployeeCard = (employee, idx) => {
    const isSelected = selectedRows.has(idx);
    const defaultShiftName = getEmployeeDefaultShiftName(employee);
    
    return (
      <div 
        className={`relative rounded-xl border transition-all hover:shadow-md ${
          isSelected 
            ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
            : "border-border bg-card hover:border-primary/50"
        }`}
      >
        {/* Selection Checkbox */}
        {permissions.canDelete && (
          <div className="absolute top-3 left-3 z-10">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                const newSelected = new Set(selectedRows);
                if (e.target.checked) {
                  newSelected.add(idx);
                } else {
                  newSelected.delete(idx);
                }
                setSelectedRows(newSelected);
              }}
              className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}
        
        {/* Card Content */}
        <div className="p-4">
          {/* Employee ID & Status Badge */}
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs text-muted-foreground">{employee.employee_id}</span>
            <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
              employee.employment_status === "ACTIVE"
                ? "bg-success/15 text-success border-success/30"
                : employee.employment_status === "ON_LEAVE"
                ? "bg-warning/15 text-warning border-warning/30"
                : "bg-destructive/15 text-destructive border-destructive/30"
            }`}>
              {employee.employment_status}
            </span>
          </div>
          
          {/* Name */}
          <h3 className="font-semibold text-lg mb-1">
            {employee.first_name} {employee.last_name || ""}
          </h3>
          
          {/* Designation & Department */}
          <div className="space-y-2 mb-3">
            {employee.designation && (
              <p className="text-sm text-muted-foreground">{employee.designation}</p>
            )}
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-muted">{employee.department}</span>
              <span className="text-muted-foreground">{employee.employment_type?.replace("_", " ")}</span>
            </div>
          </div>
          
          {/* Shift Info */}
          {defaultShiftName && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
              <Clock className="w-3 h-3" />
              <span>{defaultShiftName}</span>
            </div>
          )}
          
          {/* Contact Info */}
          {employee.phone && (
            <p className="text-xs text-muted-foreground mb-3">{employee.phone}</p>
          )}
          
          {/* Actions */}
          {(permissions.canUpdate || permissions.canDelete) && (
            <div className="flex items-center justify-end gap-1 pt-2 border-t border-border">
              {permissions.canUpdate && (
                <button
                  onClick={() => openEditModal(employee)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                  aria-label="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {permissions.canDelete && (
                <button
                  onClick={() => handleDelete(employee)}
                  className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
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
          <div className="flex items-center gap-2">
            {/* Bulk Delete Button */}
            {selectedRows.size > 0 && permissions.canDelete && (
              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-destructive text-destructive-foreground text-sm hover:bg-destructive/90 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete Selected ({selectedRows.size})
              </button>
            )}
            
            {/* Export Button */}
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-muted transition-colors"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            
            {/* View Toggle Buttons */}
            <div className="flex items-center gap-1 p-0.5 rounded-md border border-border">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === "table" 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted text-muted-foreground"
                }`}
                aria-label="Table view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === "grid" 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted text-muted-foreground"
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            
            {/* Add Employee Button */}
            {permissions.canCreate && (
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Employee
              </button>
            )}
          </div>
        }
      />

      {/* Stats Cards */}
      <StatsCards stats={employeeStats} />

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employees by ID, name, department, designation..."
            className="w-full bg-background pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring border border-border"
          />
        </div>
      </div>

      {/* View Mode Toggle */}
      {viewMode === "table" ? (
        <TableView
          columns={employeeColumns}
          data={employees}
          loading={isLoading}
          selectedRows={selectedRows}
          onRowSelect={setSelectedRows}
          onRowClick={(row, idx) => {
            // Optional: Navigate to employee detail page
            console.log("Row clicked:", row);
          }}
          actions={permissions.canUpdate || permissions.canDelete ? renderActions : undefined}
          stickyHeader={true}
        />
      ) : (
        <GridView
          data={employees}
          renderCard={renderEmployeeCard}
          loading={isLoading}
          emptyMessage="No employees found"
          columns={4}
          gap={4}
        />
      )}
      
      {/* Selection Info Bar */}
      {selectedRows.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg px-4 py-2 flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedRows.size} employee{selectedRows.size !== 1 && 's'} selected
            </span>
            {permissions.canDelete && (
              <button
                onClick={handleBulkDelete}
                className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Delete All
              </button>
            )}
            <button
              onClick={() => setSelectedRows(new Set())}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

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