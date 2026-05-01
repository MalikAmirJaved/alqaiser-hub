// ============================================
// FILE: src/components/CrudPage.jsx (UPDATED - with location selectors)
// ============================================

import { useEffect, useMemo, useState } from "react";
import { ls, uid } from "../services/localStorageService";
import { Plus, Pencil, Trash2, Search, Download, X, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import PageHeader from "./PageHeader";
import { permissionService } from "../services/permissionService";
import { CountrySelect, StateSelect, CitySelect } from "./LocationSelectors";

// Map storeKey to module and feature
const getModuleAndFeature = (storeKey) => {
  const mapping = {
    // HR
    employees: { module: "HR", feature: "Employee Management" },
    payroll: { module: "HR", feature: "Payroll" },
    attendance: { module: "HR", feature: "Time & Attendance" },
    leaves: { module: "HR", feature: "Leave Management" },
    shifts: { module: "HR", feature: "Shift Management" },
    empAssets: { module: "HR", feature: "Employee Assets" },
    performance: { module: "HR", feature: "Performance" },
    recruitment: { module: "HR", feature: "Recruitment" },
    exits: { module: "HR", feature: "Exit Management" },
    policies: { module: "HR", feature: "HR Policies" },
    compensation: { module: "HR", feature: "Compensation" },
    // Inventory
    products: { module: "INVENTORY", feature: "Products" },
    categories: { module: "INVENTORY", feature: "Products" },
    brands: { module: "INVENTORY", feature: "Products" },
    stockMoves: { module: "INVENTORY", feature: "Stock Management" },
    stockLevels: { module: "INVENTORY", feature: "Stock Management" },
    warehouses: { module: "INVENTORY", feature: "Warehouses" },
    purchaseOrders: { module: "INVENTORY", feature: "Purchase Orders" },
    suppliers: { module: "INVENTORY", feature: "Suppliers" },
    salesOrders: { module: "INVENTORY", feature: "Sales Orders" },
    assetsInv: { module: "INVENTORY", feature: "Assets Inventory" },
    transfers: { module: "INVENTORY", feature: "Inventory Transfers" },
    barcodes: { module: "INVENTORY", feature: "Barcode & QR" },
    posReceipts: { module: "INVENTORY", feature: "POS" },
    alerts: { module: "INVENTORY", feature: "Alerts" },
    auditLogs: { module: "INVENTORY", feature: "Audit Logs" },
    // Finance
    accounts: { module: "FINANCE", feature: "Chart of Accounts" },
    invoices: { module: "FINANCE", feature: "Invoices" },
    expenses: { module: "FINANCE", feature: "Expenses" },
    payables: { module: "FINANCE", feature: "Payables" },
    receivables: { module: "FINANCE", feature: "Receivables" },
    budgets: { module: "FINANCE", feature: "Budgets" },
    bankAccounts: { module: "FINANCE", feature: "Bank & Cash" },
    financeAssets: { module: "FINANCE", feature: "Fixed Assets" },
    taxes: { module: "FINANCE", feature: "Taxes" },
    forecasts: { module: "FINANCE", feature: "Forecasting" },
    // Settings
    users: { module: "SETTINGS", feature: "Users & Roles" },
    designations: { module: "SETTINGS", feature: "Designations" },
    departments: { module: "SETTINGS", feature: "Departments" },
  };
  return mapping[storeKey] || { module: "SETTINGS", feature: "General" };
};

/**
 * Generic CRUD page with permission-based action buttons
 * Supports location fields: type "country", "state", "city"
 */
export default function CrudPage({
  storeKey,
  title,
  subtitle,
  fields,
  columns,
  idPrefix = "row",
  statusField,
  hideAddbtn = false
}) {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  
  // State for dependent location fields (used when country/state changes)
  const [dependentCountry, setDependentCountry] = useState("");
  const [dependentState, setDependentState] = useState("");
  
  // Permission states
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canView: true,
    loading: true,
  });

  const cols = columns && columns.length ? columns : fields.map((f) => f.key);
  const { module, feature } = getModuleAndFeature(storeKey);

  // Check permissions on mount and when storeKey changes
  useEffect(() => {
    permissionService.init();
    const canCreate = permissionService.hasPermission(module, feature, "create");
    const canUpdate = permissionService.hasPermission(module, feature, "update");
    const canDelete = permissionService.hasPermission(module, feature, "delete");
    const canView = permissionService.hasPermission(module, feature, "view");
    
    setPermissions({
      canCreate,
      canUpdate,
      canDelete,
      canView,
      loading: false,
    });
    
    // If user doesn't have view permission, redirect
    if (!canView) {
      window.location.hash = "/dashboard";
    }
  }, [storeKey, module, feature]);

  useEffect(() => {
    if (permissions.canView) {
      setRows(ls.get(storeKey, []) || []);
    }
  }, [storeKey, permissions.canView]);

  const persist = (next) => {
    setRows(next);
    ls.set(storeKey, next);
  };

  const openAdd = () => {
    if (!permissions.canCreate) {
      alert("You don't have permission to create new records.");
      return;
    }
    const blank = {};
    fields.forEach((f) => {
      if (f.type === "number") {
        blank[f.key] = 0;
      } else if (f.type === "country") {
        blank[f.key] = "";
      } else if (f.type === "state") {
        blank[f.key] = "";
      } else if (f.type === "city") {
        blank[f.key] = "";
      } else {
        blank[f.key] = "";
      }
    });
    setForm(blank);
    setDependentCountry("");
    setDependentState("");
    setEditing(null);
    setModalOpen(true);
  };
  
  const openEdit = (row) => {
    if (!permissions.canUpdate) {
      alert("You don't have permission to edit records.");
      return;
    }
    setForm({ ...row });
    // Set dependent state for location fields if present
    if (row.country) setDependentCountry(row.country);
    if (row.state) setDependentState(row.state);
    setEditing(row.id);
    setModalOpen(true);
  };
  
  const handleDelete = (id) => {
    if (!permissions.canDelete) {
      alert("You don't have permission to delete records.");
      return;
    }
    if (!confirm("Delete this record?")) return;
    persist(rows.filter((r) => r.id !== id));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    for (const f of fields) {
      if (f.required && (form[f.key] === "" || form[f.key] == null)) {
        alert(`${f.label} is required`);
        return;
      }
    }
    if (editing) {
      if (!permissions.canUpdate) {
        alert("You don't have permission to update records.");
        return;
      }
      persist(rows.map((r) => (r.id === editing ? { ...r, ...form } : r)));
    } else {
      if (!permissions.canCreate) {
        alert("You don't have permission to create records.");
        return;
      }
      persist([{ id: uid(idPrefix), ...form }, ...rows]);
    }
    setModalOpen(false);
  };

  /**
   * Updates form value and handles dependent location field synchronization
   */
  const updateFormValue = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    
    // Reset dependent fields when country changes
    if (key === "country") {
      setDependentCountry(value);
      // Reset state and city if they exist in the form
      const hasStateField = fields.some(f => f.key === "state");
      const hasCityField = fields.some(f => f.key === "city");
      if (hasStateField) {
        setForm(prev => ({ ...prev, state: "" }));
      }
      if (hasCityField) {
        setForm(prev => ({ ...prev, city: "" }));
      }
      setDependentState("");
    }
    
    // Reset city when state changes
    if (key === "state") {
      setDependentState(value);
      const hasCityField = fields.some(f => f.key === "city");
      if (hasCityField) {
        setForm(prev => ({ ...prev, city: "" }));
      }
    }
  };

  const filtered = useMemo(() => {
    let out = rows;
    if (query) {
      const q = query.toLowerCase();
      out = out.filter((r) =>
        cols.some((c) => String(r[c] ?? "").toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      out = [...out].sort((a, b) => {
        const va = a[sortKey], vb = b[sortKey];
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
        return sortDir === "asc"
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va));
      });
    }
    return out;
  }, [rows, query, sortKey, sortDir, cols]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportCsv = () => {
    const header = cols.join(",");
    const lines = filtered.map((r) =>
      cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${storeKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortBy = (k) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const fieldLabel = (k) => fields.find((f) => f.key === k)?.label || k;
  const isStatus = (k) => statusField && k === statusField;
  const badgeFor = (val) => {
    const v = String(val).toLowerCase();
    if (["active", "paid", "approved", "completed", "received", "present", "excellent"].some((x) => v.includes(x)))
      return "bg-success/15 text-success border-success/30";
    if (["pending", "low", "in progress", "interview"].some((x) => v.includes(x)))
      return "bg-warning/15 text-warning border-warning/30";
    if (["absent", "rejected", "cancelled", "high", "overdue", "resigned"].some((x) => v.includes(x)))
      return "bg-destructive/15 text-destructive border-destructive/30";
    return "bg-muted text-muted-foreground border-border";
  };

  /**
   * Render form field based on type
   * Supports: text, number, date, textarea, select, country, state, city
   */
  const renderFormField = (field) => {
    const value = form[field.key] ?? "";
    const commonClassName = "bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring";
    const textareaClassName = "bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring";

    switch (field.type) {
      case "select":
        return (
          <select
            value={value}
            onChange={(e) => updateFormValue(field.key, e.target.value)}
            className={commonClassName}
          >
            <option value="">— Select —</option>
            {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      
      case "textarea":
        return (
          <textarea
            value={value}
            onChange={(e) => updateFormValue(field.key, e.target.value)}
            rows={3}
            className={textareaClassName}
          />
        );
      
      case "country":
        return (
          <CountrySelect
            value={value}
            onChange={(val) => updateFormValue(field.key, val)}
            required={field.required}
            className={commonClassName}
          />
        );
      
      case "state":
        // Need to find the country field to know which country's states to show
        const countryField = fields.find(f => f.key === "country");
        const countryValue = countryField ? form[countryField.key] : dependentCountry;
        return (
          <StateSelect
            countryCode={countryValue}
            value={value}
            onChange={(val) => updateFormValue(field.key, val)}
            required={field.required}
            className={commonClassName}
          />
        );
      
      case "city":
        const countryFieldForCity = fields.find(f => f.key === "country");
        const stateFieldForCity = fields.find(f => f.key === "state");
        const countryVal = countryFieldForCity ? form[countryFieldForCity.key] : dependentCountry;
        const stateVal = stateFieldForCity ? form[stateFieldForCity.key] : dependentState;
        return (
          <CitySelect
            countryCode={countryVal}
            stateCode={stateVal}
            value={value}
            onChange={(val) => updateFormValue(field.key, val)}
            required={field.required}
            className={commonClassName}
          />
        );
      
      default:
        return (
          <input
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
            value={value}
            onChange={(e) => updateFormValue(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)}
            className={commonClassName}
          />
        );
    }
  };

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

  if (!permissions.canView) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/15 flex items-center justify-center">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You don't have permission to view {title || feature || storeKey}. 
            Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-muted">
              <Download className="w-4 h-4" /> Export
            </button>
            {!hideAddbtn && permissions.canCreate && (
              <button onClick={openAdd} className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
                <Plus className="w-4 h-4" /> Add new
              </button>
            )}
          </>
        }
      />

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Total Records</div>
          <div className="text-xl font-semibold">{rows.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Filtered</div>
          <div className="text-xl font-semibold">{filtered.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Module</div>
          <div className="text-xl font-semibold capitalize">{storeKey}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm">
        <div className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 border-b border-border">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search..."
              className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Page {page} / {totalPages}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {cols.map((c) => (
                  <th
                    key={c}
                    className="text-left px-4 py-2.5 cursor-pointer select-none"
                    onClick={() => sortBy(c)}
                  >
                    {fieldLabel(c)}
                    {sortKey === c && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={cols.length + 1} className="text-center py-10 text-muted-foreground">
                    No records found.
                  </td>
                </tr>
              )}
              {pageRows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  {cols.map((c) => (
                    <td key={c} className="px-4 py-2.5">
                      {isStatus(c) ? (
                        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border ${badgeFor(r[c])}`}>
                          {String(r[c] ?? "—")}
                        </span>
                      ) : (
                        <span>{String(r[c] ?? "—")}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {permissions.canUpdate && (
                      <button onClick={() => openEdit(r)} className="p-1.5 rounded-md hover:bg-muted" aria-label="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {permissions.canDelete && (
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive" aria-label="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {!permissions.canUpdate && !permissions.canDelete && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 flex items-center justify-between border-t border-border">
          <div className="text-xs text-muted-foreground">{filtered.length} records</div>
          <div className="flex items-center gap-1">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4" >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-semibold">{editing ? "Edit record" : "Add new record"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1.5 rounded-md hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 grid sm:grid-cols-2 gap-3">
              {fields.map((f) => (
                <label key={f.key} className={`text-sm flex flex-col gap-1 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                  <span className="text-muted-foreground">
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </span>
                  {renderFormField(f)}
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
                Cancel
              </button>
              <button type="submit" className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
                {editing ? "Save changes" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}