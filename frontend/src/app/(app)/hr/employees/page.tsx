// @ts-nocheck
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useEmployees, useEmployeeStats, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from "@/hooks/useEmployees";
import { useShiftTemplates } from "@/hooks/useShiftTemplates";
import PageHeader from "@/components/PageHeader";
import EmployeeForm from "@/components/Forms/EmployeeForm";
import EmployeeStatusModal from "@/components/EmployeeStatusModal";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { TableView, GridView } from "@/components/reuseable/TableGridView";
import { Plus, Pencil, Trash2, Search, Download, Shield, Clock, LayoutGrid, LayoutList, Building2, Briefcase, Award, Phone, Key, ToggleRight, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useConfirmation } from "@/contexts/ConfirmationModalContext";
import { useRouter, useSearchParams } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import PromotionModal from "@/components/payroll/PromotionModal";


export default function EmployeesPage() {
  const { user, ready } = useAuth();
  const { confirm } = useConfirmation();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedEmployeeForStatus, setSelectedEmployeeForStatus] = useState<any>(null);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [storedPrefillData, setStoredPrefillData] = useState<any>(null);
  const [promotionModalOpen, setPromotionModalOpen] = useState(false);
  const [selectedForPromotion, setSelectedForPromotion] = useState<any>(null);
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefill = searchParams.get("prefill");

  const prefillData = useMemo(() => {
    if (!prefill) return null;
    return {
      first_name: searchParams.get("first_name") || "",
      last_name: searchParams.get("last_name") || "",
      email: searchParams.get("email") || "",
      phone: searchParams.get("phone") || "",
      department_id: searchParams.get("department_id") || "",
      designation_id: searchParams.get("designation_id") || "",
      isfrom_user_id: searchParams.get("isfrom_user_id") || null,
      candidate_id: searchParams.get("candidate_id") || null,
      expected_salary: searchParams.get("expected_salary") || null,
    };
  }, [searchParams, prefill]);

  const { data: employees = [], isLoading } = useEmployees(
    query ? { search: query } : undefined
  );
  const permissions = useSelector(
    (state: RootState) => state.permissions.permissions
  );

  const userExistsForEmployee = (employee: any) => {
    return !!employee.isfrom_user_id;
  };

  const employeePermissions = getPermissions(
    permissions,
    "HR",
    "employee"
  );

  const { data: stats } = useEmployeeStats();
  const { data: shiftTemplates = [] } = useShiftTemplates();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const getPrefillUserUrl = (employee: any) => {
    const params = new URLSearchParams({
      prefill: "true",
      first_name: employee.first_name || "",
      last_name: employee.last_name || "",
      email: employee.email || "",
      phone_number: employee.phone || "",
      department_id: employee.department_id || "",
      designation_id: employee.designation_id || "",
      isfrom_employee_id: employee._id || employee.id || "",
    });
    return `/settings/users?${params.toString()}`;
  };

  const getEmployeeDefaultShiftName = (employee) => {
    if (employee.default_shift_name) return employee.default_shift_name;
    if (employee.default_shift_id) {
      const template = shiftTemplates.find(t => t.id === employee.default_shift_id);
      return template?.name || null;
    }
    return null;
  };

  // Auto-open modal when navigated here with prefill params
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (prefill && !hasAutoOpened.current && employeePermissions.create) {
      hasAutoOpened.current = true;
      setStoredPrefillData(prefillData);
      setEditingEmployee(null);
      setModalOpen(true);
      router.replace("/hr/employees", undefined);
    }
  }, [prefill, employeePermissions.create, router, prefillData]);

  const handleSaveEmployee = async (employeeData) => {
    try {
      const payload = { ...employeeData };
      if (!editingEmployee && storedPrefillData?.isfrom_user_id) {
        payload.isfrom_user_id = storedPrefillData.isfrom_user_id;
      }
      if (!editingEmployee && storedPrefillData?.candidate_id) {
        payload.candidate_id = storedPrefillData.candidate_id;
      }
      if (editingEmployee) {
        await updateEmployee.mutateAsync({
          id: editingEmployee.id,
          ...payload,
        });
      } else {
        await createEmployee.mutateAsync(payload);
      }
      setModalOpen(false);
      setEditingEmployee(null);
      setStoredPrefillData(null);
      setSelectedRows(new Set());
    } catch (error: any) {
    }
  };

  const handleDelete = async (employee) => {
    confirm({
      title: "Delete Employee",
      message: `Are you sure you want to delete "${employee.first_name} ${employee.last_name || ''}"? This action cannot be undone.`,
      type: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          await deleteEmployee.mutateAsync(employee.id);
          setSelectedRows(new Set());
        } catch (error: any) {
        }
      },
    });
  };

  const handleBulkDelete = async () => {
    const selectedEmployees = Array.from(selectedRows).map(idx => employees[idx]);
    if (selectedEmployees.length === 0) return;
    confirm({
      title: "Bulk Delete Employees",
      message: `You are about to delete ${selectedEmployees.length} employee(s). This action cannot be undone.`,
      type: "danger",
      confirmText: `Delete ${selectedEmployees.length}`,
      onConfirm: async () => {
        try {
          await Promise.all(selectedEmployees.map(emp => deleteEmployee.mutateAsync(emp.id)));
          setSelectedRows(new Set());
        } catch (error: any) {
        }
      },
    });
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    setStoredPrefillData(null);
    setModalOpen(true);
  };

  const openEditModal = (employee) => {
    setEditingEmployee(employee);
    setStoredPrefillData(null);
    setModalOpen(true);
  };

  const openStatusModal = (employee) => {
    setSelectedEmployeeForStatus(employee);
    setStatusModalOpen(true);
  };

  const exportCsv = () => {
    const headers = ["Employee ID", "First Name", "Last Name", "Department", "Designation", "Employment Type", "Status", "Phone", "Email", "Default Shift"];
    const rows = employees.map(emp => [
      emp.employee_id,
      emp.first_name,
      emp.last_name || "",
      emp.department_name || "",
      emp.designation_name || "",
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
      value: stats?.departments || new Set(employees.map(e => e.department_name)).size
    },
    {
      id: "default-shift",
      label: "With Default Shift",
      value: stats?.withDefaultShift || employees.filter(e => e.default_shift_id || e.default_shift_name).length
    }
  ];

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
      sortAccessor: (row) =>
        `${row.first_name ?? ""} ${row.last_name ?? ""}`.toLowerCase(),
      render: (_, row) => `${row.first_name} ${row.last_name || ""}`
    },
    {
      key: "department_name",
      label: "Department",
      sortable: true,
      sortAccessor: (row) => (row.department_name ?? "").toLowerCase()
    },
    {
      key: "designation_name",
      label: "Designation",
      sortable: true,
      sortAccessor: (row) => (row.designation_name ?? "").toLowerCase()
    },
    {
      key: "employment_type",
      label: "Employment Type",
      sortable: true,
      sortAccessor: (row) => (row.employment_type ?? "").toLowerCase()
    },
    {
      key: "employment_status",
      label: "Status",
      sortable: true,
      render: (value, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (employeePermissions.update) {
              openStatusModal(row);
            }
          }}
          className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${value === "ACTIVE"
            ? "bg-success/15 text-success border-success/30"
            : value === "ON_LEAVE"
              ? "bg-warning/15 text-warning border-warning/30"
              : "bg-destructive/15 text-destructive border-destructive/30"
            }`}
          title={employeePermissions.update ? "Click to change status" : "No permission to change status"}
        >
          {value}
        </button>
      )
    },
    {
      key: "default_shift",
      label: "Default Shift",
      sortable: true,
      sortAccessor: (row) =>
        (getEmployeeDefaultShiftName(row) ?? "").toLowerCase(),
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
      label: "Phone",
      sortable: true,
      sortAccessor: (row) => row.phone?.replace(/\D/g, "") ?? ""
    }
  ];

  const openPromotionModal = (employee: any) => {
    setSelectedForPromotion(employee);
    setPromotionModalOpen(true);
  };

  const renderActions = (row, idx) => (
    <>
      {employeePermissions.update && (
        <>
          <button
            onClick={() => openStatusModal(row)}
            className="p-1.5 rounded-md hover:bg-blue-100 text-blue-600 transition-colors"
            title="Change Employment Status"
            aria-label="Change Status"
          >
            <ToggleRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => openPromotionModal(row)}
            className="p-1.5 rounded-md hover:bg-success/15 text-success transition-colors"
            title="Promotion"
            aria-label="Promotion"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
        </>
      )}
      {!userExistsForEmployee(row) && (
        <button
          onClick={() => router.push(getPrefillUserUrl(row))}
          className="p-1.5 rounded-md hover:bg-primary/15 text-primary transition-colors"
          aria-label="Give Login Access"
        >
          <Key className="w-4 h-4" />
        </button>
      )}
      {employeePermissions.update && (
        <button
          onClick={() => openEditModal(row)}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="Edit"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}
      {employeePermissions.delete && (
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

  const renderEmployeeCard = (employee, idx) => {
    const isSelected = selectedRows.has(idx);
    const defaultShiftName = getEmployeeDefaultShiftName(employee);
    const isActive = employee.employment_status === "ACTIVE";
    const isOnLeave = employee.employment_status === "ON_LEAVE";

    return (
      <div
        className={cn(
          "group relative rounded-xl border transition-all duration-300 ease-out",
          "hover:shadow-lg hover:-translate-y-0.5",
          isSelected
            ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md scale-[1.02]"
            : "border-border bg-card hover:border-primary/30",
          "after:absolute after:inset-0 after:rounded-xl after:opacity-0 after:transition-opacity after:duration-300",
          "after:bg-gradient-to-b after:from-primary/5 after:to-transparent",
          "hover:after:opacity-100"
        )}
      >
        <div className={cn(
          "absolute top-2 left-2 z-10 transition-all duration-200",
          isSelected ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
        )}>
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
            className="w-4 h-4 rounded border-2 border-border checked:border-primary checked:bg-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
          />
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                {employee.employee_id}
              </span>
              {isActive && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                </div>
              )}
            </div>
            <span className={cn(
              "inline-flex px-2.5 py-1 text-[11px] rounded-full border font-medium",
              "transition-transform duration-200 group-hover:scale-105",
              isActive
                ? "bg-success/10 text-success border-success/30"
                : isOnLeave
                  ? "bg-warning/10 text-warning border-warning/30"
                  : "bg-destructive/10 text-destructive border-destructive/30"
            )}>
              {employee.employment_status.replace("_", " ")}
            </span>
          </div>

          <div className="flex items-start gap-3 mb-4">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0",
              "transition-all duration-300",
              isActive
                ? "bg-primary/10 text-primary"
                : isOnLeave
                  ? "bg-warning/10 text-warning"
                  : "bg-destructive/10 text-destructive",
              "group-hover:shadow-md group-hover:scale-105"
            )}>
              {`${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors duration-200">
                {employee.first_name} {employee.last_name || ""}
              </h3>
              {employee.email && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {employee.email}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2.5 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-muted font-medium">
                <Building2 className="w-3 h-3 text-muted-foreground" />
                {employee.department_name}
              </span>
              {employee.employment_type && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-muted/50 text-muted-foreground">
                  <Briefcase className="w-3 h-3" />
                  {employee.employment_type.replace("_", " ")}
                </span>
              )}
            </div>

            {employee.designation_name && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{employee.designation_name}</span>
              </p>
            )}

            {defaultShiftName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{defaultShiftName}</span>
              </div>
            )}

            {employee.phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                {employee.phone}
              </p>
            )}
          </div>

          <div className={cn(
            "flex items-center justify-between pt-3 border-t border-border",
            "transition-all duration-200"
          )}>
            <span className="text-xs text-muted-foreground">
              Updated {new Date(employee.updated_at || Date.now()).toLocaleDateString()}
            </span>
            <div className="flex items-center gap-0.5 relative z-20">
              {renderActions(employee, idx)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading...</p>
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
            {selectedRows.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-destructive text-destructive-foreground text-sm hover:bg-destructive/90 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete Selected ({selectedRows.size})
              </button>
            )}

            {employeePermissions.export && (
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-muted transition-colors"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            )}

            <div className="flex items-center gap-1 p-0.5 rounded-md border border-border">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded transition-colors ${viewMode === "table"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
                  }`}
                aria-label="Table view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded transition-colors ${viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
                  }`}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {employeePermissions.create && (
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

      <StatsCards stats={employeeStats} />

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

      {viewMode === "table" ? (
        <TableView
          columns={employeeColumns}
          data={employees}
          loading={isLoading}
          selectedRows={selectedRows}
          onRowSelect={setSelectedRows}
          onRowClick={(row, idx) => {
            router.push(`employees/${row.id}`)
          }}
          actions={renderActions || undefined}
          stickyHeader={true}
        />
      ) : (
        <GridView
          data={employees}
          renderCard={renderEmployeeCard}
          loading={isLoading}
          emptyMessage="No employees found"
          emptyAction={{
            label: "Add Employee",
            onClick: openAddModal,
          }}
          columns={4}
          gap={4}
        />
      )}

      {selectedRows.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg px-4 py-2 flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedRows.size} employee{selectedRows.size !== 1 && 's'} selected
            </span>
            <button
              onClick={handleBulkDelete}
              className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Delete All
            </button>
            <button
              onClick={() => setSelectedRows(new Set())}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {selectedForPromotion && (
        <PromotionModal
          employee={selectedForPromotion}
          isOpen={promotionModalOpen}
          onClose={() => {
            setPromotionModalOpen(false);
            setSelectedForPromotion(null);
          }}
          onSuccess={() => {}}
          formatCurrency={formatCurrency}
        />
      )}

      {(modalOpen && (editingEmployee ? employeePermissions.update : employeePermissions.create)) && (
        <EmployeeForm
          initialData={editingEmployee ? editingEmployee : storedPrefillData || undefined}
          onSubmit={handleSaveEmployee}
          onCancel={() => {
            setModalOpen(false);
            setEditingEmployee(null);
            setStoredPrefillData(null);
          }}
        />
      )}

      {selectedEmployeeForStatus && (
        <EmployeeStatusModal
          open={statusModalOpen}
          onOpenChange={setStatusModalOpen}
          employee={selectedEmployeeForStatus}
          onSuccess={() => {
            setSelectedEmployeeForStatus(null);
          }}
        />
      )}
    </div>
  );
}