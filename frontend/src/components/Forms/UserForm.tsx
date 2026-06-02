"use client";
import { useState, useEffect } from "react";
import { X, Eye, EyeOff } from "lucide-react";
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
    department: "",
    designation: "",
    phone_number: "",
    password: "",
    confirm_password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        username: initialData.username || "",
        email: initialData.email || "",
        first_name: initialData.first_name || "",
        last_name: initialData.last_name || "",
        department: initialData.department || "",
        designation: initialData.designation || "",
        phone_number: initialData.phone_number || "",
        password: "",
        confirm_password: "",
      });
    }
  }, [initialData]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password for new user creation
    if (!initialData && !formData.password) {
      alert("Password is required for new user");
      return;
    }
    
    // Validate password match
    if (formData.password !== formData.confirm_password) {
      alert("Passwords do not match");
      return;
    }
    
    // Validate password length
    if (formData.password && formData.password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    
    // Remove confirm_password before submitting
    const { confirm_password, ...submitData } = formData;
    onSubmit(submitData);
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
              <span className="text-muted-foreground">Department</span>
              <SearchableSelect
                value={formData.department}
                onChange={(val) => handleChange("department", val)}
                options={departments.map(d => ({ value: d, label: d }))}
                placeholder="Select department"
              />
            </label>
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
          </div>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Phone Number</span>
            <input
              type="tel"
              value={formData.phone_number}
              onChange={(e) => handleChange("phone_number", e.target.value)}
              className="bg-muted/40 border border-border rounded-md h-9 px-3"
            />
          </label>

          {/* Password Fields */}
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">
                {initialData ? "New Password" : "Password *"}
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  required={!initialData}
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 pr-8 outline-none focus:ring-2 focus:ring-ring w-full"
                  placeholder={initialData ? "Leave blank to keep current" : "Enter password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">
                {initialData ? "Confirm New Password" : "Confirm Password *"}
              </span>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirm_password}
                  onChange={(e) => handleChange("confirm_password", e.target.value)}
                  required={!initialData}
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 pr-8 outline-none focus:ring-2 focus:ring-ring w-full"
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>
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