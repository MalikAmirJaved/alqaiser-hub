"use client";

// ============================================
// FILE: src/components/Forms/EmployeeForm.jsx
// ============================================

import { useEffect, useState } from "react";
import { X, Users, Building2, Briefcase, UserCog, Clock, RotateCw, FileText } from "lucide-react";
import { useServerSearch } from "@/hooks/useServerSearch";
import { LocationGroup } from "../reuseable/LocationSelectors";
import SearchableSelect from "../reuseable/SearchableSelect";
import { DatePicker } from "@/components/reuseable/DatePicker";
import DepartmentFormModal from "@/components/settings/departments/DepartmentFormModal";
import DesignationFormModal from "@/components/settings/designations/DesignationFormModal";
import { useAutoCode } from "@/hooks/useAutoCode";
import FileUpload, { uploadFiles, deleteUploadedFiles } from "../reuseable/FileUpload";
import { BASE_URL } from "@/lib/api";
import ProfilePicUploader from "./ProfilePicUploader";

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
    country: "",
    state: "",
    city: "",
    postal_code: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "",
    department_id: "",
    designation_id: "",               // <-- changed from designation
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
    profile_picture: "",
    education_documents: [],
    experience_documents: [],
  });
  const [loading, setLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [profilePictures, setProfilePictures] = useState([]);
  const { generateCode, validateCode } = useAutoCode("employee");
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [desigModalOpen, setDesigModalOpen] = useState(false);
  const [profilePicLoading, setProfilePicLoading] = useState(false);

  const fetchDepartments = useServerSearch("/api/organization/departments/", {
    transformOption: (dept) => ({
      value: dept.id,
      label: dept.name,
    }),
  });

  const fetchDesignations = useServerSearch("/api/company/designations/", {
    transformOption: (d) => ({
      value: d.id,
      label: d.name,
    }),
  });

  const fetchShiftTemplates = useServerSearch("/api/hr/shift-templates/", {
    transformOption: (tpl) => ({
      value: tpl.id,
      label: `${tpl.name} (${tpl.start_time || ""} - ${tpl.end_time || ""})`,
    }),
  });

  const fetchAssetCategories = useServerSearch("/api/hr/asset-categories/", {
    transformOption: (c) => ({
      value: c.id,
      label: c.name,
    }),
  });

  const fetchEmployees = useServerSearch("/api/hr/employees/", {
    extraParams: { employment_status: "ACTIVE" },
    transformOption: (e) => ({
      value: e.id,
      label: `${e.first_name} ${e.last_name || ""} - ${e.designation_name || "Employee"}`,
    }),
  });

  // Load initial data
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        department_id: initialData.department_id || "",
        designation_id: initialData.designation_id || "",
        old_default_shift_id: initialData.default_shift_id || "",
        asset_category_id: initialData.asset_category_id || "",
        salary: initialData.salary ? Number(initialData.salary) : (initialData.expected_salary ? Number(initialData.expected_salary) : null),
      });
      // Load existing profile pictures for editing
      if (initialData.profile_pictures && initialData.profile_pictures.length > 0) {
        setProfilePictures(
          initialData.profile_pictures.map((pic) => ({
            id: pic.id,
            file_url: pic.file_url,
            file_url_thumb: pic.file_url_thumb,
            file_url_detail: pic.file_url_detail,
            original_filename: pic.original_filename,
            file_size: 0,
            mime_type: "",
          }))
        );
      }
    } else {
      generateCode().then(code => setFormData(prev => ({ ...prev, employee_id: code }))).catch(() => {});
    }
  }, [initialData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      ...(field === "department_id" && { designation_id: "" })
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const requiredFields = ["first_name", "phone", "department_id", "joining_date"];
    for (const field of requiredFields) {
        if (!formData[field]) {
            alert(`Please fill ${field.replace(/_/g, " ")} field`);
            return;
        }
    }

    setLoading(true);
    const uploadedUrls = [];
    const educationDocs = [];
    const experienceDocs = [];

    try {
        // Step 1: Upload pending profile pictures to permanent storage
        const uploadedProfilePics = [];
        for (const pic of profilePictures) {
            if (pic.file) {
                // New upload — File object from ProfilePicUploader
                const formData = new FormData();
                formData.append("file", pic.file);
                formData.append("module", "employee");
                formData.append("submodule", "profile");
                formData.append("type", "image");

                const res = await fetch(`${BASE_URL}/api/common/upload/`, {
                    method: "POST",
                    credentials: "include",
                    body: formData,
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || "Failed to upload profile picture");
                }

                const data = await res.json();
                uploadedUrls.push(data.url);
                uploadedProfilePics.push({
                    file_url: data.url,
                    file_url_thumb: data.url_thumb || data.url,
                    file_url_detail: data.url_detail || data.url,
                    original_filename: pic.original_filename || pic.file.name,
                    file_size: pic.file_size || pic.file.size,
                    mime_type: pic.mime_type || pic.file.type,
                });
            } else {
                // Existing URL (from initialData editing) — use as-is
                uploadedProfilePics.push(pic);
            }
        }

        // Step 2: Upload all pending documents
        if (pendingFiles.length > 0) {
            const results = await uploadFiles(pendingFiles);
            for (const result of results) {
                uploadedUrls.push(result.url);
                const docData = {
                    title: result.fieldName.includes('education') ? 'Education Document' : 'Experience Document',
                    file_url: result.url,
                    file_url_thumb: result.url_thumb,
                    original_filename: result.url.split('/').pop(),
                    file_size: 0,
                    mime_type: '',
                    sort_order: 0,
                };
                // Categorize uploaded documents
                if (result.fieldName === "education_documents") {
                    educationDocs.push(docData);
                } else if (result.fieldName === "experience_documents") {
                    experienceDocs.push(docData);
                }
            }
        }

        // Step 3: Prepare clean payload
        // Set the primary profile picture from the first validated image
        let primaryPicUrl = formData.profile_picture || "";
        let primaryPicThumb = formData.profile_picture_thumb || "";
        if (uploadedProfilePics.length > 0) {
            primaryPicUrl = uploadedProfilePics[0].file_url;
            primaryPicThumb = uploadedProfilePics[0].file_url_thumb;
        }
        
        const payload = {
            id: formData.id,          
            employee_id: formData.employee_id,
            first_name: formData.first_name,
            last_name: formData.last_name,
            father_name: formData.father_name,
            cnic: formData.cnic,
            date_of_birth: formData.date_of_birth,
            gender: formData.gender,
            marital_status: formData.marital_status,
            phone: formData.phone,
            email: formData.email,
            personal_email: formData.personal_email,
            address_line: formData.address_line,
            country: formData.country,
            state: formData.state,
            city: formData.city,
            postal_code: formData.postal_code,
            emergency_contact_name: formData.emergency_contact_name,
            emergency_contact_phone: formData.emergency_contact_phone,
            emergency_contact_relation: formData.emergency_contact_relation,
            department_id: formData.department_id || null,
            designation_id: formData.designation_id || null,
            employment_type: formData.employment_type,
            employment_status: formData.employment_status,
            joining_date: formData.joining_date,
            confirmation_date: formData.confirmation_date || null,
            probation_days: formData.probation_days,
            work_location: formData.work_location,
            reporting_manager_id: formData.reporting_manager_id || null,
            bank_name: formData.bank_name,
            bank_account_number: formData.bank_account_number,
            bank_iban: formData.bank_iban,
            salary: Number(formData.salary),
            default_shift_id: formData.default_shift_id || null,
            profile_picture: primaryPicUrl,
            profile_picture_thumb: primaryPicThumb,
            profile_pictures: uploadedProfilePics.map((pic) => ({
                file_url: pic.file_url,
                file_url_thumb: pic.file_url_thumb,
                file_url_detail: pic.file_url_detail,
                original_filename: pic.original_filename,
                file_size: pic.file_size,
                mime_type: pic.mime_type,
            })),
            education_documents: [...(formData.education_documents || []), ...educationDocs],
            experience_documents: [...(formData.experience_documents || []), ...experienceDocs],
        };
        if (formData.isfrom_user_id) {
            payload.isfrom_user_id = formData.isfrom_user_id;
        }

        // Step 4: Create/Update employee
        await onSubmit(payload);
        
        // Step 5: Clear pending files on success
        setPendingFiles([]);
        setProfilePictures([]);
    } catch (error) {
        // Step 6: Rollback - delete uploaded files if employee creation fails
        if (uploadedUrls.length > 0) {
            await deleteUploadedFiles(uploadedUrls);
        }
        throw error;
    } finally {
        setLoading(false);
    }
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
          {/* Profile Pictures Section - Multi upload with face detection */}
          <div className="mb-6 p-4 rounded-xl border border-border bg-muted/20">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-3">
              <Users className="w-4 h-4" />
              Profile Photos
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              upload multiple profile photos. Each photo is validated server-side for face detection (must contain exactly one human face, high resolution 400×400px+), sharpness, and proper lighting.
              The first photo is the primary/display picture.
            </p>
            <ProfilePicUploader
              value={profilePictures}
              onChange={setProfilePictures}
              maxFiles={5}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Personal Information Section (unchanged) */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <Users className="w-4 h-4" />
                Personal Information
              </h3>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Employee ID</span>
                <div className="flex gap-2">
                  <input type="text" value={formData.employee_id} onChange={(e) => handleChange("employee_id", e.target.value)} onBlur={() => validateCode(formData.employee_id)} className="flex-1 bg-muted/40 border border-border rounded-md h-9 px-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring" />
                  <button type="button" onClick={() => generateCode().then(code => setFormData(prev => ({ ...prev, employee_id: code }))).catch(() => {})} className="h-9 w-9 flex items-center justify-center rounded-md border border-border hover:bg-muted transition flex-shrink-0" title="Generate new code">
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">First Name *</span>
                  <input type="text" value={formData.first_name} onChange={(e) => handleChange("first_name", e.target.value)} required className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Last Name</span>
                  <input type="text" value={formData.last_name} onChange={(e) => handleChange("last_name", e.target.value)} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" />
                </label>
              </div>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Father Name</span>
                <input type="text" value={formData.father_name} onChange={(e) => handleChange("father_name", e.target.value)} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">CNIC</span>
                  <input type="text" value={formData.cnic} onChange={(e) => handleChange("cnic", e.target.value.replace(/[^0-9-]/g, "").slice(0, 15))} maxLength={15} placeholder="42101-1234567-1" className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Date of Birth</span>
                  <DatePicker value={formData.date_of_birth} onChange={(value) => handleChange("date_of_birth", value || "")} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Gender</span>
                  <SearchableSelect value={formData.gender} onChange={(val) => handleChange("gender", val)} options={[{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }, { value: "OTHER", label: "Other" }]} placeholder="Select Gender" />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Marital Status</span>
                  <SearchableSelect value={formData.marital_status} onChange={(val) => handleChange("marital_status", val)} options={[{ value: "SINGLE", label: "Single" }, { value: "MARRIED", label: "Married" }, { value: "DIVORCED", label: "Divorced" }, { value: "WIDOWED", label: "Widowed" }]} placeholder="Select Marital Status" />
                </label>
              </div>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Phone *</span>
                <input type="tel" value={formData.phone} onChange={(e) => handleChange("phone", e.target.value.replace(/[^0-9+]/g, "").slice(0, 20))} maxLength={20} required className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Work Email</span>
                  <input type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Personal Email</span>
                  <input type="email" value={formData.personal_email} onChange={(e) => handleChange("personal_email", e.target.value)} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" />
                </label>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-primary/80">Address Information</h4>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Street Address</span>
                  <textarea value={formData.address_line || ""} onChange={(e) => handleChange("address_line", e.target.value)} rows={2} className="bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring" placeholder="House #, Street, Area" />
                </label>
                <LocationGroup country={formData.country} setCountry={(val) => handleChange("country", val)} state={formData.state} setState={(val) => handleChange("state", val)} city={formData.city} setCity={(val) => handleChange("city", val)} />
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Postal/ZIP Code</span>
                  <input type="text" value={formData.postal_code || ""} onChange={(e) => handleChange("postal_code", e.target.value)} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" />
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
                    <span className="text-muted-foreground text-xs">Department *</span>
                    <SearchableSelect value={formData.department_id} onChange={(val) => handleChange("department_id", val)} fetchOptions={fetchDepartments} required placeholder="Search departments..." onAddNew={() => setDeptModalOpen(true)} addNewLabel="+ New Department" displayLabel={initialData?.department_name || formData.department_name} />
                  </label>

                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Designation</span>
                  <SearchableSelect
                    value={formData.designation_id}
                    onChange={(val) => handleChange("designation_id", val)}
                    fetchOptions={fetchDesignations}
                    disabled={!formData.department_id}
                    placeholder="Search designations..."
                    onAddNew={() => setDesigModalOpen(true)}
                    addNewLabel="+ New Designation"
                    displayLabel={initialData?.designation_name || formData.designation_name}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Employment Type</span>
                  <SearchableSelect value={formData.employment_type} onChange={(val) => handleChange("employment_type", val)} options={[{ value: "FULL_TIME", label: "Full Time" }, { value: "PART_TIME", label: "Part Time" }, { value: "CONTRACT", label: "Contract" }, { value: "INTERN", label: "Intern" }]} placeholder="Select Employment Type" />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Status</span>
                  <SearchableSelect value={formData.employment_status} onChange={(val) => handleChange("employment_status", val)} options={[{ value: "ACTIVE", label: "Active" }, { value: "ON_LEAVE", label: "On Leave" }, { value: "SUSPENDED", label: "Suspended" }, { value: "TERMINATED", label: "Terminated" }, { value: "RESIGNED", label: "Resigned" }]} placeholder="Select Status" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Joining Date *</span>
                  <DatePicker value={formData.joining_date} onChange={(value) => handleChange("joining_date", value || "")} required className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Confirmation Date</span>
                  <DatePicker value={formData.confirmation_date} onChange={(value) => handleChange("confirmation_date", value || "")} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Probation Days</span>
                  <input type="number" value={formData.probation_days} onChange={(e) => handleChange("probation_days", parseInt(e.target.value) || 0)} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Work Location</span>
                  <SearchableSelect value={formData.work_location} onChange={(val) => handleChange("work_location", val)} options={[{ value: "OFFICE", label: "Office" }, { value: "REMOTE", label: "Remote" }, { value: "HYBRID", label: "Hybrid" }]} placeholder="Select Work Location" />
                </label>
              </div>

              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Reporting Manager</span>
                <SearchableSelect value={formData.reporting_manager_id || ""} onChange={(val) => handleChange("reporting_manager_id", val || null)} fetchOptions={fetchEmployees} placeholder="Search managers..." displayLabel={initialData?.reporting_manager_name || formData.reporting_manager_name} />
              </label>

              {/* Default Shift Selection */}
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Default Shift</span>
                <SearchableSelect value={formData.default_shift_id} onChange={(val) => handleChange("default_shift_id", val)} fetchOptions={fetchShiftTemplates} placeholder="Search shifts..." displayLabel={initialData?.default_shift_name || formData.default_shift_name} />
              </label>

              {/* Asset Kit Selection */}
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground text-xs flex items-center gap-1"><Briefcase className="w-3 h-3" /> Default Asset Kit</span>
                <SearchableSelect value={formData.asset_category_id} onChange={(val) => handleChange("asset_category_id", val)} fetchOptions={fetchAssetCategories} placeholder="Search asset kits..." displayLabel={initialData?.asset_category_name || formData.asset_category_name} />
              </label>
            </div>
          </div>

          {/* Emergency Contact Section */}
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2"><UserCog className="w-4 h-4" /> Emergency Contact</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground text-xs">Contact Name</span><input type="text" value={formData.emergency_contact_name} onChange={(e) => handleChange("emergency_contact_name", e.target.value)} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" /></label>
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground text-xs">Contact Phone</span><input type="tel" value={formData.emergency_contact_phone} onChange={(e) => handleChange("emergency_contact_phone", e.target.value.replace(/[^0-9+]/g, "").slice(0, 20))} maxLength={20} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" /></label>
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground text-xs">Relation</span><input type="text" value={formData.emergency_contact_relation} onChange={(e) => handleChange("emergency_contact_relation", e.target.value)} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" /></label>
            </div>
          </div>

          {/* Bank Information Section */}
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2"><Building2 className="w-4 h-4" /> Bank Information</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground text-xs">Bank Name</span><input type="text" value={formData.bank_name} onChange={(e) => handleChange("bank_name", e.target.value)} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" /></label>
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground text-xs">Account Number</span><input type="tel" value={formData.bank_account_number} onChange={(e) => handleChange("bank_account_number", e.target.value.replace(/[^0-9+]/g, "").slice(0, 20))} maxLength={20}className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" /></label>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground text-xs">IBAN</span><input type="text" value={formData.bank_iban} onChange={(e) => handleChange("bank_iban", e.target.value)} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" /></label>
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground text-xs">Basic Salary</span><input type="number" value={Number(formData.salary)} onChange={(e) => handleChange("salary", parseInt(e.target.value) || 0)} className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring" /></label>
            </div>
          </div>

          {/* Employee Documents Section */}
          <div className="mt-4 space-y-4">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Employee Documents
            </h3>
            
            {/* Education Documents */}
            <div className="p-4 rounded-xl border border-border bg-muted/20">
              <FileUpload
                value={formData.education_documents}
                onChange={(urls) => handleChange("education_documents", urls)}
                module="employee"
                submodule="education"
                type="all"
                multiple
                label="Education Documents"
                description="Upload degrees, certificates, transcripts (PDF, JPG, PNG)"
                maxFiles={10}
                pendingFiles={pendingFiles}
                onPendingFilesChange={setPendingFiles}
                fieldName="education_documents"
              />
            </div>

            {/* Experience Documents */}
            <div className="p-4 rounded-xl border border-border bg-muted/20">
              <FileUpload
                value={formData.experience_documents}
                onChange={(urls) => handleChange("experience_documents", urls)}
                module="employee"
                submodule="experience"
                type="all"
                multiple
                label="Experience Documents"
                description="Upload experience letters, offer letters (PDF, JPG, PNG)"
                maxFiles={10}
                pendingFiles={pendingFiles}
                onPendingFilesChange={setPendingFiles}
                fieldName="experience_documents"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <button type="button" onClick={onCancel} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50">{loading ? "Saving..." : initialData ? "Save Changes" : "Create Employee"}</button>
        </div>
      </form>

      <DepartmentFormModal
        open={deptModalOpen}
        onClose={() => setDeptModalOpen(false)}
        onSuccess={() => setDeptModalOpen(false)}
      />

      <DesignationFormModal
        open={desigModalOpen}
        onClose={() => setDesigModalOpen(false)}
        onSuccess={() => setDesigModalOpen(false)}
      />
    </div>
  );
}