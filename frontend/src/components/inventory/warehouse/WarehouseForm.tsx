// frontend/src/components/inventory/warehouse/WarehouseForm.tsx

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CountrySelect, StateSelect, CitySelect } from "@/components/reuseable/LocationSelectors";
import { Checkbox } from "@/components/reuseable/Checkbox";
import { useActiveEmployees } from "@/hooks/useEmployees";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

interface WarehouseFormData {
  id?: string;
  warehouse_name: string;
  code: string;
  employee_id?: string | null;
  landline_number?: string | null;
  country: string;
  state: string;
  city: string;
  address_line: string;
  postal_code: string;
  email: string;
  is_active: boolean;
  description: string;
}

interface WarehouseFormProps {
  initialData?: Partial<WarehouseFormData>;
  onSubmit: (data: WarehouseFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function WarehouseForm({ initialData, onSubmit, onCancel, isLoading }: WarehouseFormProps) {
  const { data: employees = [] } = useActiveEmployees();

  const [formData, setFormData] = useState<WarehouseFormData>({
    warehouse_name: "",
    code: "",
    employee_id: null,
    landline_number: "",
    country: "",
    state: "",
    city: "",
    address_line: "",
    postal_code: "",
    email: "",
    is_active: true,
    description: "",
    ...initialData,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const employeeOptions = employees.map((emp) => ({
    value: emp.id,
    label: `${emp.first_name} ${emp.last_name || ""} (${emp.department_name || "N/A"})`,
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.warehouse_name) newErrors.warehouse_name = "Warehouse name is required";
    if (!formData.code) newErrors.code = "Code is required";
    if (!formData.country) newErrors.country = "Country is required";
    if (!formData.city) newErrors.city = "City is required";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit(formData);
  };

  const inputClassName = "bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring w-full";
  const textareaClassName = "bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring w-full";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Warehouse Name *</span>
            <input
              type="text"
              value={formData.warehouse_name}
              onChange={(e) => setFormData({ ...formData, warehouse_name: e.target.value })}
              className={cn(inputClassName, errors.warehouse_name && "border-destructive")}
            />
            {errors.warehouse_name && <span className="text-xs text-destructive">{errors.warehouse_name}</span>}
          </label>
        </div>
        <div>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Code *</span>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className={cn(inputClassName, errors.code && "border-destructive")}
            />
            {errors.code && <span className="text-xs text-destructive">{errors.code}</span>}
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Responsible Employee</span>
            <SearchableSelect
              value={formData.employee_id || ""}
              onChange={(val) => setFormData({ ...formData, employee_id: val || null })}
              options={employeeOptions}
              placeholder="Select employee"
            />
          </label>
        </div>
        <div>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Landline Number</span>
            <input
              type="tel"
              value={formData.landline_number || ""}
              onChange={(e) => setFormData({ ...formData, landline_number: e.target.value })}
              className={inputClassName}
              placeholder="e.g., +1 234 567 8900"
            />
          </label>
        </div>
      </div>

      <div>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Address Line</span>
          <textarea
            value={formData.address_line}
            onChange={(e) => setFormData({ ...formData, address_line: e.target.value })}
            rows={2}
            className={textareaClassName}
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Country *</span>
            <CountrySelect
              value={formData.country}
              onChange={(val) => setFormData({ ...formData, country: val, state: "", city: "" })}
            />
            {errors.country && <span className="text-xs text-destructive">{errors.country}</span>}
          </label>
        </div>
        <div>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">State/Region</span>
            <StateSelect
              countryCode={formData.country}
              value={formData.state}
              onChange={(val) => setFormData({ ...formData, state: val, city: "" })}
            />
          </label>
        </div>
        <div>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">City *</span>
            <CitySelect
              countryCode={formData.country}
              stateCode={formData.state}
              value={formData.city}
              onChange={(val) => setFormData({ ...formData, city: val })}
            />
            {errors.city && <span className="text-xs text-destructive">{errors.city}</span>}
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Postal/ZIP Code</span>
            <input
              type="text"
              value={formData.postal_code}
              onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
              className={inputClassName}
            />
          </label>
        </div>
        <div>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Email</span>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={inputClassName}
            />
          </label>
        </div>
      </div>

      <div>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Description</span>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className={textareaClassName}
          />
        </label>
      </div>

      <div>
        <Checkbox
          checked={formData.is_active}
          onChange={(v) => setFormData({ ...formData, is_active: v })}
          label="Active"
          description="Inactive warehouses won't appear in most lists"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-md border border-border bg-transparent text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
          {initialData?.id ? "Update" : "Create"} Warehouse
        </button>
      </div>
    </form>
  );
}