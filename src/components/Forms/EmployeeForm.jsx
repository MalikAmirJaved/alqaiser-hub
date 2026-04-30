// ============================================
// FILE: src/components/EmployeeForm.jsx (NEW - enhanced employee form)
// ============================================

import { useEffect, useState } from "react";
import { X, Users, Building2, Briefcase, UserCog } from "lucide-react";
import { ls, uid } from "../../services/localStorageService";
import { companyContext } from "../../services/companyContextService";

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
    address: "",
    city: "",
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
    reporting_manager_id: "",
    bank_name: "",
    bank_account_number: "",
    bank_iban: "",
    salary: 0,
  });

  const [designations, setDesignations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
const filteredDesignations = designations.filter(
  (d) => d.department === formData.department
);
  // Load designations and employees
  useEffect(() => {
    loadDesignations();
    loadEmployees();
    
    // If editing, populate form
    if (initialData) {
      setFormData(initialData);
    } else {
      // Auto-generate employee ID for new employee
      generateEmployeeId();
    }
  }, [initialData]);

  const loadDesignations = () => {
    const allDesignations = ls.get("designations", []);
    // Filter active designations
    const activeDesignations = allDesignations.filter(d => d.is_active === "true");
    setDesignations(activeDesignations);
  };

  const loadEmployees = () => {
    const allEmployees = ls.get("employees", []);
    // Filter by company context
    const filtered = companyContext.filterByContext(allEmployees);
    setEmployees(filtered);
  };

  const generateEmployeeId = () => {
    const allEmployees = ls.get("employees", []);
    const filtered = companyContext.filterByContext(allEmployees);
    const nextNumber = filtered.length + 1;
    const paddedNumber = nextNumber.toString().padStart(3, "0");
    setFormData(prev => ({
      ...prev,
      employee_id: `EMP-${paddedNumber}`,
    }));
  };

  // Get employees with manager-level designations for reporting manager dropdown
  const getManagerEmployees = () => {
    return employees.filter(emp => {
      const designation = designations.find(d => d.title === emp.designation);
      return designation && (designation.level === "Manager" || designation.level === "Lead" || designation.level === "Director");
    });
  };

const handleChange = (field, value) => {
  setFormData(prev => ({
    ...prev,
    [field]: value,
    ...(field === "department" && { designation: "" }) // reset designation
  }));
};

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    const requiredFields = ["first_name", "father_name", "cnic", "date_of_birth", "phone", "department", "joining_date"];
    for (const field of requiredFields) {
      if (!formData[field]) {
        alert(`Please fill ${field.replace(/_/g, " ")} field`);
        return;
      }
    }

    // Add company context and submit
    const finalData = { ...formData };
    onSubmit(finalData);
  };

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
          {/* Employee ID - Hidden field, auto-generated */}
          <input type="hidden" value={formData.employee_id} />

          {/* Two Column Layout */}
          <div className="grid md:grid-cols-2 gap-4">
            
            {/* Personal Information Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <Users className="w-4 h-4" />
                Personal Information
              </h3>
              
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
                <span className="text-muted-foreground text-xs">Father Name *</span>
                <input
                  type="text"
                  value={formData.father_name}
                  onChange={(e) => handleChange("father_name", e.target.value)}
                  required
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">CNIC *</span>
                  <input
                    type="text"
                    value={formData.cnic}
                    onChange={(e) => handleChange("cnic", e.target.value)}
                    placeholder="42101-1234567-1"
                    required
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Date of Birth *</span>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleChange("date_of_birth", e.target.value)}
                    required
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Gender *</span>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleChange("gender", e.target.value)}
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Marital Status</span>
                  <select
                    value={formData.marital_status}
                    onChange={(e) => handleChange("marital_status", e.target.value)}
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="SINGLE">Single</option>
                    <option value="MARRIED">Married</option>
                    <option value="DIVORCED">Divorced</option>
                    <option value="WIDOWED">Widowed</option>
                  </select>
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

              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Address</span>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  rows={2}
                  className="bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">City</span>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
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
                  <select
                    value={formData.role}
                    onChange={(e) => handleChange("role", e.target.value)}
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="STAFF">Staff</option>
                    <option value="BRANCH_ADMIN">Branch Admin</option>
                    <option value="COMPANY_ADMIN">Company Admin</option>
                  </select>
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Department *</span>
                  <select
                    value={formData.department}
                    onChange={(e) => handleChange("department", e.target.value)}
                    required
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select Department</option>
                    <option value="HR">HR</option>
                    <option value="INVENTORY">Inventory</option>
                    <option value="FINANCE">Finance</option>
                  </select>
                </label>
              </div>

              <label className="text-sm flex flex-col gap-1">
  <span className="text-muted-foreground text-xs">Designation</span>
  <select
    value={formData.designation}
    disabled={!formData.department}
    onChange={(e) => handleChange("designation", e.target.value)}
    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
  >
    <option value="">Select Designation</option>

    {filteredDesignations.length === 0 ? (
      <option disabled>No designations for this department</option>
    ) : (
      filteredDesignations.map(d => (
        <option key={d.id} value={d.title}>
          {d.title} ({d.level || "N/A"})
        </option>
      ))
    )}
  </select>
</label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Employment Type</span>
                  <select
                    value={formData.employment_type}
                    onChange={(e) => handleChange("employment_type", e.target.value)}
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Status (Default: Active)</span>
                  <select
                    value={formData.employment_status}
                    onChange={(e) => handleChange("employment_status", e.target.value)}
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="ON_LEAVE">On Leave</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="TERMINATED">Terminated</option>
                    <option value="RESIGNED">Resigned</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Joining Date *</span>
                  <input
                    type="date"
                    value={formData.joining_date}
                    onChange={(e) => handleChange("joining_date", e.target.value)}
                    required
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Confirmation Date</span>
                  <input
                    type="date"
                    value={formData.confirmation_date}
                    onChange={(e) => handleChange("confirmation_date", e.target.value)}
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
                  <select
                    value={formData.work_location}
                    onChange={(e) => handleChange("work_location", e.target.value)}
                    className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="OFFICE">Office</option>
                    <option value="REMOTE">Remote</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </label>
              </div>

              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Reporting Manager</span>
                <select
                  value={formData.reporting_manager_id}
                  onChange={(e) => handleChange("reporting_manager_id", e.target.value)}
                  className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select Manager</option>
                  {getManagerEmployees().map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} - {emp.designation || "Manager"}
                    </option>
                  ))}
                  {/* Also show all employees as fallback */}
                  {employees.filter(e => !getManagerEmployees().find(m => m.id === e.id)).map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.designation || "Staff"})
                    </option>
                  ))}
                </select>
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
            className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
          >
            {initialData ? "Save Changes" : "Create Employee"}
          </button>
        </div>
      </form>
    </div>
  );
}