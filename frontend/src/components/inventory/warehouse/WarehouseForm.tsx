// frontend/src/components/inventory/warehouse/WarehouseForm.tsx

import { useState, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CountrySelect, StateSelect, CitySelect } from "@/components/reuseable/LocationSelectors";
import { Checkbox } from "@/components/reuseable/Checkbox";
import { useActiveEmployees } from "@/hooks/useEmployees";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { useAutoCode } from "@/hooks/useAutoCode";

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

function FieldWrapper({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}>{children}</div>;
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
  const { generateCode, validateCode } = useAutoCode("warehouse");

  useEffect(() => {
    if (!initialData?.id && !formData.code) {
      generateCode().then(code => setFormData(prev => ({ ...prev, code }))).catch(() => {});
    }
  }, []);

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldWrapper>
          <Label htmlFor="warehouse_name" className="text-sm font-medium">
            Warehouse Name <span className="text-destructive ml-1">*</span>
          </Label>
          <Input
            id="warehouse_name"
            value={formData.warehouse_name}
            onChange={(e) => setFormData({ ...formData, warehouse_name: e.target.value })}
            className={cn(errors.warehouse_name && "border-destructive")}
          />
          {errors.warehouse_name && <p className="text-xs text-destructive">{errors.warehouse_name}</p>}
        </FieldWrapper>

        <FieldWrapper>
          <Label htmlFor="code" className="text-sm font-medium">
            Code <span className="text-destructive ml-1">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              onBlur={() => validateCode(formData.code)}
              className={cn("font-mono flex-1", errors.code && "border-destructive")}
            />
            <button
              type="button"
              onClick={() => generateCode().then(code => setFormData(prev => ({ ...prev, code }))).catch(() => {})}
              className="h-9 w-9 flex items-center justify-center rounded-md border border-border hover:bg-muted transition flex-shrink-0"
              title="Generate new code"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
          {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
        </FieldWrapper>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldWrapper>
          <Label className="text-sm font-medium">Responsible Employee</Label>
          <SearchableSelect
            value={formData.employee_id || ""}
            onChange={(val) => setFormData({ ...formData, employee_id: val || null })}
            options={employeeOptions}
            placeholder="Select employee"
          />
        </FieldWrapper>

        <FieldWrapper>
          <Label htmlFor="landline_number" className="text-sm font-medium">Landline Number</Label>
          <Input
            id="landline_number"
            type="tel"
            value={formData.landline_number || ""}
            onChange={(e) => setFormData({ ...formData, landline_number: e.target.value })}
            placeholder="e.g., +1 234 567 8900"
          />
        </FieldWrapper>
      </div>

      <FieldWrapper>
        <Label htmlFor="address_line" className="text-sm font-medium">Address Line</Label>
        <Textarea
          id="address_line"
          value={formData.address_line}
          onChange={(e) => setFormData({ ...formData, address_line: e.target.value })}
          rows={2}
        />
      </FieldWrapper>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FieldWrapper>
          <Label className="text-sm font-medium">
            Country <span className="text-destructive ml-1">*</span>
          </Label>
          <CountrySelect
            value={formData.country}
            onChange={(val) => setFormData({ ...formData, country: val, state: "", city: "" })}
          />
          {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
        </FieldWrapper>

        <FieldWrapper>
          <Label className="text-sm font-medium">State/Region</Label>
          <StateSelect
            countryCode={formData.country}
            value={formData.state}
            onChange={(val) => setFormData({ ...formData, state: val, city: "" })}
          />
        </FieldWrapper>

        <FieldWrapper>
          <Label className="text-sm font-medium">
            City <span className="text-destructive ml-1">*</span>
          </Label>
          <CitySelect
            countryCode={formData.country}
            stateCode={formData.state}
            value={formData.city}
            onChange={(val) => setFormData({ ...formData, city: val })}
          />
          {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
        </FieldWrapper>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldWrapper>
          <Label htmlFor="postal_code" className="text-sm font-medium">Postal/ZIP Code</Label>
          <Input
            id="postal_code"
            value={formData.postal_code}
            onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
          />
        </FieldWrapper>

        <FieldWrapper>
          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </FieldWrapper>
      </div>

      <FieldWrapper>
        <Label htmlFor="description" className="text-sm font-medium">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />
      </FieldWrapper>

      <div>
        <Checkbox
          checked={formData.is_active}
          onChange={(v) => setFormData({ ...formData, is_active: v })}
          label="Active"
          description="Inactive warehouses won't appear in most lists"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />}
          {initialData?.id ? "Update" : "Create"} Warehouse
        </Button>
      </div>
    </form>
  );
}
