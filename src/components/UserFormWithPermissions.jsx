// ============================================
// FILE: src/components/UserFormWithPermissions.jsx (FIXED imports)
// ============================================

import { useEffect, useState } from "react";
import { X, ChevronDown, ChevronRight, Shield } from "lucide-react";
import { ls, uid } from "../services/localStorageService";

// Module to feature mapping
const MODULE_FEATURES = {
  HR: [
    "Employee Management", "Payroll", "Time & Attendance", "Leave Management",
    "Shift Management", "Employee Assets", "Performance", "Recruitment",
    "Exit Management", "HR Policies", "Compensation"
  ],
  INVENTORY: [
    "Products", "Stock Management", "Warehouses", "Purchase Orders",
    "Suppliers", "Sales Orders", "Assets Inventory", "Inventory Transfers",
    "Barcode & QR", "Reports", "Alerts", "POS"
  ],
  FINANCE: [
    "Chart of Accounts", "Invoices", "Expenses", "Payables", "Receivables",
    "Budgets", "Bank & Cash", "Fixed Assets", "Taxes", "Reports", "Forecasting"
  ],
  SETTINGS: [
    "Company Profile", "Users & Roles", "Departments", "Designations", "Preferences"
  ]
};

export default function UserFormWithPermissions({
  initialData = null,
  onSubmit,
  onCancel,
  departments = ["HR", "INVENTORY", "FINANCE", "SETTINGS"],
}) {
  const [userData, setUserData] = useState({
    username: "",
    full_name: "",
    email: "",
    password: "",
    role: "STAFF",
    department: "",
    designation: "",
    status: "Active",
    ...initialData,
  });

  const [permissions, setPermissions] = useState({});
  const [expandedModules, setExpandedModules] = useState({});
  const [loadingFeatures, setLoadingFeatures] = useState(false);

  // Load existing permissions when editing
  useEffect(() => {
    if (initialData?.id) {
      const existingPerms = ls.get("permissions", []).filter(p => p.user_id === initialData.id);
      const permMap = {};
      existingPerms.forEach(p => {
        const key = `${p.module_name}|${p.feature_name}`;
        permMap[key] = {
          create: p.is_create_access === "true",
          update: p.is_update_access === "true",
          delete: p.is_delete_access === "true",
          view: p.is_view_access === "true",
        };
      });
      setPermissions(permMap);
    } else {
      // Initialize default permissions based on role and department
      initializeDefaultPermissions();
    }
  }, [initialData]);

  const initializeDefaultPermissions = () => {
    const newPerms = {};
    const role = userData.role;
    const department = userData.department;

    Object.entries(MODULE_FEATURES).forEach(([module, features]) => {
      if (role === "COMPANY_ADMIN") {
        // Full access to everything
        features.forEach(feature => {
          const key = `${module}|${feature}`;
          newPerms[key] = { create: true, update: true, delete: true, view: true };
        });
      } else if (role === "BRANCH_ADMIN") {
        // Full access to their department only
        if (module === department) {
          features.forEach(feature => {
            const key = `${module}|${feature}`;
            newPerms[key] = { create: true, update: true, delete: true, view: true };
          });
        } else {
          // No access to other modules
          features.forEach(feature => {
            const key = `${module}|${feature}`;
            newPerms[key] = { create: false, update: false, delete: false, view: false };
          });
        }
      } else if (role === "STAFF") {
        if (module === department) {
          features.forEach(feature => {
            const key = `${module}|${feature}`;
            // Staff gets view by default, limited create/update
            const canCreate = feature === "Expenses" || feature === "Leave Management" || feature === "Attendance";
            const canUpdate = feature === "Expenses" || feature === "Leave Management" || feature === "Time & Attendance";
            newPerms[key] = { create: canCreate, update: canUpdate, delete: false, view: true };
          });
        } else {
          features.forEach(feature => {
            const key = `${module}|${feature}`;
            newPerms[key] = { create: false, update: false, delete: false, view: false };
          });
        }
      }
    });
    setPermissions(newPerms);
  };

  // Auto-select modules based on department change
  const handleDepartmentChange = (dept) => {
    setUserData(prev => ({ ...prev, department: dept }));
    
    // Auto-expand the selected department's module
    setExpandedModules(prev => ({
      ...prev,
      [dept]: true,
    }));

    // Update permissions based on new department
    const newPerms = { ...permissions };
    const role = userData.role;

    Object.entries(MODULE_FEATURES).forEach(([module, features]) => {
      features.forEach(feature => {
        const key = `${module}|${feature}`;
        if (role === "STAFF") {
          if (module === dept) {
            const canCreate = feature === "Expenses" || feature === "Leave Management" || feature === "Attendance";
            const canUpdate = feature === "Expenses" || feature === "Leave Management" || feature === "Time & Attendance";
            newPerms[key] = { create: canCreate, update: canUpdate, delete: false, view: true };
          } else if (!newPerms[key]) {
            newPerms[key] = { create: false, update: false, delete: false, view: false };
          }
        } else if (role === "BRANCH_ADMIN") {
          if (module === dept) {
            newPerms[key] = { create: true, update: true, delete: true, view: true };
          } else if (!newPerms[key]) {
            newPerms[key] = { create: false, update: false, delete: false, view: false };
          }
        }
      });
    });
    setPermissions(newPerms);
  };

  const handleRoleChange = (role) => {
    setUserData(prev => ({ ...prev, role }));
    
    // Reset permissions when role changes
    const newPerms = {};
    const department = userData.department;

    Object.entries(MODULE_FEATURES).forEach(([module, features]) => {
      if (role === "COMPANY_ADMIN") {
        features.forEach(feature => {
          const key = `${module}|${feature}`;
          newPerms[key] = { create: true, update: true, delete: true, view: true };
        });
      } else if (role === "BRANCH_ADMIN") {
        features.forEach(feature => {
          const key = `${module}|${feature}`;
          if (module === department) {
            newPerms[key] = { create: true, update: true, delete: true, view: true };
          } else {
            newPerms[key] = { create: false, update: false, delete: false, view: false };
          }
        });
      } else if (role === "STAFF") {
        features.forEach(feature => {
          const key = `${module}|${feature}`;
          if (module === department) {
            const canCreate = feature === "Expenses" || feature === "Leave Management" || feature === "Attendance";
            const canUpdate = feature === "Expenses" || feature === "Leave Management" || feature === "Time & Attendance";
            newPerms[key] = { create: canCreate, update: canUpdate, delete: false, view: true };
          } else {
            newPerms[key] = { create: false, update: false, delete: false, view: false };
          }
        });
      }
    });
    setPermissions(newPerms);
  };

  const toggleModule = (module) => {
    setExpandedModules(prev => ({
      ...prev,
      [module]: !prev[module],
    }));
  };

  const updatePermission = (module, feature, permissionType, value) => {
    const key = `${module}|${feature}`;
    setPermissions(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [permissionType]: value,
      },
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Convert permissions to array format
    const permissionsArray = Object.entries(permissions).map(([key, perms]) => {
      const [module_name, feature_name] = key.split("|");
      return {
        user_id: initialData?.id || `new_${Date.now()}`,
        module_name,
        feature_name,
        is_create_access: perms.create ? "true" : "false",
        is_update_access: perms.update ? "true" : "false",
        is_delete_access: perms.delete ? "true" : "false",
        is_view_access: perms.view ? "true" : "false",
      };
    });

    onSubmit(userData, permissionsArray);
  };

  const PermissionCheckbox = ({ module, feature, type, checked, onChange }) => (
    <label className="inline-flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(module, feature, type, e.target.checked)}
        className="w-3.5 h-3.5 rounded border-border bg-muted/40"
      />
      <span className="text-xs capitalize">{type}</span>
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {initialData ? "Edit User & Permissions" : "Create User & Permissions"}
          </h2>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 p-5">
          {/* LEFT - User Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary">User Information</h3>
            
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Username *</span>
                <input
                  type="text"
                  value={userData.username}
                  onChange={(e) => setUserData({ ...userData, username: e.target.value })}
                  required
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Full Name *</span>
                <input
                  type="text"
                  value={userData.full_name}
                  onChange={(e) => setUserData({ ...userData, full_name: e.target.value })}
                  required
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Email *</span>
                <input
                  type="email"
                  value={userData.email}
                  onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                  required
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Password {!initialData && "*"}</span>
                <input
                  type="password"
                  value={userData.password}
                  onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                  required={!initialData}
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Role *</span>
                <select
                  value={userData.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="COMPANY_ADMIN">Company Admin</option>
                  <option value="BRANCH_ADMIN">Branch Admin</option>
                  <option value="STAFF">Staff</option>
                </select>
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Department *</span>
                <select
                  value={userData.department}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  required
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Designation</span>
              <input
                type="text"
                value={userData.designation}
                onChange={(e) => setUserData({ ...userData, designation: e.target.value })}
                className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Status</span>
              <select
                value={userData.status}
                onChange={(e) => setUserData({ ...userData, status: e.target.value })}
                className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
          </div>

          {/* RIGHT - Permissions Matrix */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Permissions Matrix
              <span className="text-[10px] text-muted-foreground font-normal">
                (Auto-selected based on Role & Department)
              </span>
            </h3>
            
            <div className="border border-border rounded-lg overflow-hidden">
              {Object.entries(MODULE_FEATURES).map(([module, features]) => (
                <div key={module} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleModule(module)}
                    className="w-full flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/40 transition"
                  >
                    <div className="flex items-center gap-2">
                      {expandedModules[module] ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span className="font-medium text-sm">{module}</span>
                      {userData.department === module && (
                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                          Dept Match
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>C</span>
                      <span>U</span>
                      <span>D</span>
                      <span>V</span>
                    </div>
                  </button>
                  
                  {expandedModules[module] && (
                    <div className="p-2 bg-card border-t border-border">
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground border-b border-border">
                          <tr>
                            <th className="text-left py-1.5 px-2">Feature</th>
                            <th className="w-12 text-center">Create</th>
                            <th className="w-12 text-center">Update</th>
                            <th className="w-12 text-center">Delete</th>
                            <th className="w-12 text-center">View</th>
                          </tr>
                        </thead>
                        <tbody>
                          {features.map(feature => {
                            const key = `${module}|${feature}`;
                            const perms = permissions[key] || { create: false, update: false, delete: false, view: false };
                            return (
                              <tr key={feature} className="border-b border-border/50">
                                <td className="py-1.5 px-2 font-medium">{feature}</td>
                                <td className="text-center">
                                  <PermissionCheckbox
                                    module={module}
                                    feature={feature}
                                    type="create"
                                    checked={perms.create}
                                    onChange={updatePermission}
                                  />
                                </td>
                                <td className="text-center">
                                  <PermissionCheckbox
                                    module={module}
                                    feature={feature}
                                    type="update"
                                    checked={perms.update}
                                    onChange={updatePermission}
                                  />
                                </td>
                                <td className="text-center">
                                  <PermissionCheckbox
                                    module={module}
                                    feature={feature}
                                    type="delete"
                                    checked={perms.delete}
                                    onChange={updatePermission}
                                  />
                                </td>
                                <td className="text-center">
                                  <PermissionCheckbox
                                    module={module}
                                    feature={feature}
                                    type="view"
                                    checked={perms.view}
                                    onChange={updatePermission}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-[10px] text-muted-foreground bg-muted/20 p-2 rounded-md">
              <p>💡 <strong>Auto-selection:</strong> When you select a department, related modules are auto-expanded and permissions are pre-filled based on role.</p>
              <p className="mt-1">🔧 <strong>Manual override:</strong> You can manually check/uncheck any permission checkbox.</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
          >
            {initialData ? "Save Changes" : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}