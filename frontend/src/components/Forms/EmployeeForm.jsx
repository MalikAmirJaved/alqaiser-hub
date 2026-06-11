"use client";

// ============================================
// FILE: src/components/Forms/EmployeeForm.jsx 
// ============================================

import { useEffect, useState } from "react";
import { X, Users, Building2, Briefcase, UserCog, Clock } from "lucide-react";
import { useShiftTemplates } from "@/hooks/useShiftTemplates";
import { useAssetCategories } from "@/hooks/useAssetCategories";
import { useDesignations } from "@/hooks/useDesignations";
import { useEmployees } from "@/hooks/useEmployees";
import { LocationGroup } from "../reuseable/LocationSelectors";
import SearchableSelect from "../reuseable/SearchableSelect";
import { DatePicker } from "@/components/reuseable/DatePicker";
import { useDepartments } from "@/hooks/useDepartments";

export default function EmployeeForm({ initialData = null, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    employee_id: "",
    first_name: "",
    last_name: "",
    father_name: "",
    cnic: "",
    date_of_birth: "",
    gender: "MALE",
    marital_status: "SINGLE",
    phone: "",
    email: "",
    personal_email: "",
    address_line: "",
    country: "PK",
    state: "",
    city: "",
    postal_code: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "",
    role: "STAFF",
    department: "",
    designation: "",
    employment_type: "FULL_TIME",
    employment_status: "ACTIVE",
    joining_date: new Date().toISOString().slice(0, 10),
    confirmation_date: "",
    probation_days: 180,
    work_location: "OFFICE",
    reporting_manager_id: null,
    bank_name: "",
    bank_account_number: "",
    bank_iban: "",
    salary: 0,
    default_shift_id: "",
    asset_category_id: "",
    old_default_shift_id: "",
  });

  const [loading, setLoading] = useState(false);

  // Fetch departments (assumed to return array directly from API)
  const { data: departments = [] } = useDepartments();

  // Transform departments to options for SearchableSelect
  const departmentOptions = departments
    .filter(dept => dept.is_active)
    .map(dept => ({ value: dept.name, label: dept.name }));

  // Fetch designations (array after pagination fix)
  const { data: designations = [] } = useDesignations();
  const { data: shiftTemplates = [] } = useShiftTemplates();
  const { data: assetCategories = [] } = useAssetCategories();
  const { data: employees = [] } = useEmployees();

  // Filter designations based on selected department
  const filteredDesignations = designations.filter(
    (d) => d.department === formData.department
  );

  // Load initial data
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        old_default_shift_id: initialData.default_shift_id || "",
        asset_category_id: initialData.asset_category_id || "",
      });
    } else {
      generateEmployeeId();
    }
  }, [initialData]);

  const generateEmployeeId = () => {
    const nextNumber = employees.length + 1;
    const paddedNumber = nextNumber.toString().padStart(3, "0");
    setFormData(prev => ({
      ...prev,
      employee_id: `EMP-${paddedNumber}`,
    }));
  };

  const getManagerEmployees = () => {
    return employees.filter(emp =>
      emp.role !== 'STAFF' || emp.designation?.toLowerCase().includes('manager') ||
      emp.designation?.toLowerCase().includes('lead') ||
      emp.designation?.toLowerCase().includes('director')
    );
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      ...(field === "department" && { designation: "" })
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const requiredFields = ["first_name", "phone", "department", "joining_date"];
    for (const field of requiredFields) {
      if (!formData[field]) {
        alert(`Please fill ${field.replace(/_/g, " ")} field`);
        return;
      }
    }

    onSubmit(formData);
  };

  // Get active shift templates
  const activeShiftTemplates = shiftTemplates.filter(t => t.is_active);

  // Get active asset categories
  const activeAssetCategories = assetCategories.filter(c => c.isActive);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {initialData ? "Edit Employee" : "Add New Employee"}
          </h2>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="grid md:grid-cols-2 gap-4">

            {/* Personal Information Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <Users className="w-4 h-4" />
                Personal Information
              </h3>

              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Employee ID</span>
                <input
                  type="text"
                  disabled
                  value={formData.employee_id}
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 font-mono text-xs cursor-not-allowed"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">First Name *</span>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                    required
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Last Name</span>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>

              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Father Name</span>
                <input
                  type="text"
                  value={formData.father_name}
                  onChange={(e) => handleChange("father_name", e.target.value)}
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">CNIC</span>
                  <input
                    type="text"
                    value={formData.cnic}
                    onChange={(e) => handleChange("cnic", e.target.value)}
                    placeholder="42101-1234567-1"
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Date of Birth</span>
                  <DatePicker
                    value={formData.date_of_birth}
                    onChange={(value) => handleChange("date_of_birth", value || "")}
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Gender</span>
                  <SearchableSelect
                    value={formData.gender}
                    onChange={(val) => handleChange("gender", val)}
                    options={[
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                      { value: "OTHER", label: "Other" }
                    ]}
                    placeholder="Select Gender"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Marital Status</span>
                  <SearchableSelect
                    value={formData.marital_status}
                    onChange={(val) => handleChange("marital_status", val)}
                    options={[
                      { value: "SINGLE", label: "Single" },
                      { value: "MARRIED", label: "Married" },
                      { value: "DIVORCED", label: "Divorced" },
                      { value: "WIDOWED", label: "Widowed" }
                    ]}
                    placeholder="Select Marital Status"
                  />
                </label>
              </div>

              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Phone *</span>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  required
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Work Email</span>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Personal Email</span>
                  <input
                    type="email"
                    value={formData.personal_email}
                    onChange={(e) => handleChange("personal_email", e.target.value)}
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-primary/80">Address Information</h4>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Street Address</span>
                  <textarea
                    value={formData.address_line || ""}
                    onChange={(e) => handleChange("address_line", e.target.value)}
                    rows={2}
                    className="bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring"
                    placeholder="House #, Street, Area"
                  />
                </label>

                <LocationGroup
                  country={formData.country}
                  setCountry={(val) => handleChange("country", val)}
                  state={formData.state}
                  setState={(val) => handleChange("state", val)}
                  city={formData.city}
                  setCity={(val) => handleChange("city", val)}
                />

                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Postal/ZIP Code</span>
                  <input
                    type="text"
                    value={formData.postal_code || ""}
                    onChange={(e) => handleChange("postal_code", e.target.value)}
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>
            </div>

            {/* Employment Information Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Employment Information
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Role</span>
                  <SearchableSelect
                    value={formData.role}
                    onChange={(val) => handleChange("role", val)}
                    options={[
                      { value: "STAFF", label: "Staff" },
                      { value: "BRANCH_ADMIN", label: "Branch Admin" },
                      { value: "COMPANY_ADMIN", label: "Company Admin" }
                    ]}
                    placeholder="Select Role"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Department *</span>
                  <SearchableSelect
                    value={formData.department}
                    onChange={(val) => handleChange("department", val)}
                    options={departmentOptions}
                    required={true}
                    placeholder="Select Department"
                  />
                </label>
              </div>

              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Designation</span>
                <SearchableSelect
                  value={formData.designation}
                  onChange={(val) => handleChange("designation", val)}
                  options={filteredDesignations.map(d => ({
                    value: d.name,
                    label: `${d.name} (${d.department || "N/A"})`
                  }))}
                  disabled={!formData.department}
                  placeholder="Select Designation"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Employment Type</span>
                  <SearchableSelect
                    value={formData.employment_type}
                    onChange={(val) => handleChange("employment_type", val)}
                    options={[
                      { value: "FULL_TIME", label: "Full Time" },
                      { value: "PART_TIME", label: "Part Time" },
                      { value: "CONTRACT", label: "Contract" },
                      { value: "INTERN", label: "Intern" }
                    ]}
                    placeholder="Select Employment Type"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Status</span>
                  <SearchableSelect
                    value={formData.employment_status}
                    onChange={(val) => handleChange("employment_status", val)}
                    options={[
                      { value: "ACTIVE", label: "Active" },
                      { value: "ON_LEAVE", label: "On Leave" },
                      { value: "SUSPENDED", label: "Suspended" },
                      { value: "TERMINATED", label: "Terminated" },
                      { value: "RESIGNED", label: "Resigned" }
                    ]}
                    placeholder="Select Status"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Joining Date *</span>
                  <DatePicker
                    value={formData.joining_date}
                    onChange={(value) => handleChange("joining_date", value || "")}
                    required
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Confirmation Date</span>
                  <DatePicker
                    value={formData.confirmation_date}
                    onChange={(value) => handleChange("confirmation_date", value || "")}
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Probation Days</span>
                  <input
                    type="number"
                    value={formData.probation_days}
                    onChange={(e) => handleChange("probation_days", parseInt(e.target.value) || 0)}
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Work Location</span>
                  <SearchableSelect
                    value={formData.work_location}
                    onChange={(val) => handleChange("work_location", val)}
                    options={[
                      { value: "OFFICE", label: "Office" },
                      { value: "REMOTE", label: "Remote" },
                      { value: "HYBRID", label: "Hybrid" }
                    ]}
                    placeholder="Select Work Location"
                  />
                </label>
              </div>

              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Reporting Manager</span>
                <SearchableSelect
                  value={formData.reporting_manager_id || ""}
                  onChange={(val) => handleChange("reporting_manager_id", val || null)}
                  options={getManagerEmployees().map(emp => ({
                    value: emp.id,
                    label: `${emp.first_name} ${emp.last_name || ""} - ${emp.designation || "Employee"}`
                  }))}
                  placeholder="Select Manager"
                />
              </label>

              {/* Default Shift Selection */}
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Default Shift
                </span>
                <SearchableSelect
                  value={formData.default_shift_id}
                  onChange={(val) => handleChange("default_shift_id", val)}
                  options={activeShiftTemplates.map(tpl => ({
                    value: tpl.id,
                    label: `${tpl.name} (${tpl.startTime} - ${tpl.endTime})`
                  }))}
                  placeholder="Select default shift (optional)"
                />
              </label>

              {/* Asset Kit Selection */}
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> Default Asset Kit
                </span>
                <SearchableSelect
                  value={formData.asset_category_id}
                  onChange={(val) => handleChange("asset_category_id", val)}
                  options={activeAssetCategories.map(c => ({
                    value: c.id,
                    label: `${c.name} (${c.assetCount} items)`
                  }))}
                  placeholder="Select hardware kit to assign on creation"
                />
              </label>
            </div>
          </div>

          {/* Emergency Contact Section */}
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              Emergency Contact
            </h3>
            <div className="grid md:grid-cols-3 gap-3">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Contact Name</span>
                <input
                  type="text"
                  value={formData.emergency_contact_name}
                  onChange={(e) => handleChange("emergency_contact_name", e.target.value)}
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Contact Phone</span>
                <input
                  type="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => handleChange("emergency_contact_phone", e.target.value)}
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Relation</span>
                <input
                  type="text"
                  value={formData.emergency_contact_relation}
                  onChange={(e) => handleChange("emergency_contact_relation", e.target.value)}
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
          </div>

          {/* Bank Information Section */}
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Bank Information
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Bank Name</span>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => handleChange("bank_name", e.target.value)}
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Account Number</span>
                <input
                  type="text"
                  value={formData.bank_account_number}
                  onChange={(e) => handleChange("bank_account_number", e.target.value)}
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">IBAN</span>
                <input
                  type="text"
                  value={formData.bank_iban}
                  onChange={(e) => handleChange("bank_iban", e.target.value)}
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Basic Salary</span>
                <input
                  type="number"
                  value={formData.salary}
                  onChange={(e) => handleChange("salary", parseInt(e.target.value) || 0)}
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
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
            disabled={loading}
            className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Saving..." : initialData ? "Save Changes" : "Create Employee"}
          </button>
        </div>
      </form>
    </div>
  );
}