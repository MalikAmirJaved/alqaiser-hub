"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

interface UserFormProps {
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
  departments?: string[];
}

export default function UserForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  departments = ["HR", "INVENTORY", "FINANCE", "MONITORING", "SETTINGS"],
}: UserFormProps) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    role: "STAFF",
    department: "",
    designation: "",
    phone_number: "",
    is_active: true,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        username: initialData.username || "",
        email: initialData.email || "",
        first_name: initialData.first_name || "",
        last_name: initialData.last_name || "",
        role: initialData.role || "STAFF",
        department: initialData.department || "",
        designation: initialData.designation || "",
        phone_number: initialData.phone_number || "",
        is_active: initialData.is_active ?? true,
      });
    }
  }, [initialData]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold">{initialData ? "Edit User" : "Create User"}</h2>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Username *</span>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleChange("username", e.target.value)}
                required
                className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Email *</span>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                required
                className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">First Name</span>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => handleChange("first_name", e.target.value)}
                className="bg-muted/40 border border-border rounded-md h-9 px-3"
              />
            </label>
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Last Name</span>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => handleChange("last_name", e.target.value)}
                className="bg-muted/40 border border-border rounded-md h-9 px-3"
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Role</span>
              <SearchableSelect
                value={formData.role}
                onChange={(val) => handleChange("role", val)}
                options={[
                  { value: "COMPANY_ADMIN", label: "Company Admin" },
                  { value: "BRANCH_ADMIN", label: "Branch Admin" },
                  { value: "STAFF", label: "Staff" },
                ]}
              />
            </label>
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Department</span>
              <SearchableSelect
                value={formData.department}
                onChange={(val) => handleChange("department", val)}
                options={departments.map(d => ({ value: d, label: d }))}
                placeholder="Select department"
              />
            </label>
          </div>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Designation</span>
            <input
              type="text"
              value={formData.designation}
              onChange={(e) => handleChange("designation", e.target.value)}
              className="bg-muted/40 border border-border rounded-md h-9 px-3"
              placeholder="e.g., Software Engineer"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Phone Number</span>
            <input
              type="tel"
              value={formData.phone_number}
              onChange={(e) => handleChange("phone_number", e.target.value)}
              className="bg-muted/40 border border-border rounded-md h-9 px-3"
            />
          </label>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => handleChange("is_active", e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="is_active" className="text-sm">Active</label>
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
            disabled={isLoading}
            className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "Saving..." : initialData ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}