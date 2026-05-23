// components/payroll/CompensationForm.tsx
"use client";

import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { DatePicker } from "@/components/reuseable/DatePicker";
import { Calendar, FileText, TrendingUp, Briefcase, Car, Phone, Home, Plus } from "lucide-react";
import { useCompanySettings } from "@/hooks/useCompanySettings";
interface CompensationFormProps {
  formData: any;
  setFormData: (data: any) => void;
  employeeOptions: Array<{ value: string; label: string }>;
  formatCurrency: (amount: number) => number;
}

export default function CompensationForm({ formData, setFormData, employeeOptions, formatCurrency }: CompensationFormProps) {
  const allowanceFields = [
    { key: 'house_rent_allowance', label: 'House Rent Allowance', icon: Home, placeholder: 'Monthly HRA' },
    { key: 'medical_allowance', label: 'Medical Allowance', icon: Plus, placeholder: 'Monthly medical' },
    { key: 'transport_allowance', label: 'Transport Allowance', icon: Car, placeholder: 'Monthly transport' },
    { key: 'fuel_allowance', label: 'Fuel Allowance', icon: Car, placeholder: 'Monthly fuel' },
    { key: 'phone_allowance', label: 'Phone Allowance', icon: Phone, placeholder: 'Monthly phone' },
    { key: 'other_allowances', label: 'Other Allowances', icon: Plus, placeholder: 'Other allowances' },
  ];

  const calculateTotalAllowances = () => {
    return allowanceFields.reduce((total, field) => {
      return total + (parseFloat(formData[field.key]) || 0);
    }, 0);
  };

  const totalAllowances = calculateTotalAllowances();
  const { CurrencyCode } = useCompanySettings();
  return (
    <div className="space-y-6">
      {/* Employee Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <span className="text-red-500">*</span> Employee
        </label>
        <SearchableSelect
          value={formData.employee_id || ""}
          onChange={(val) => setFormData({ ...formData, employee_id: val })}
          options={employeeOptions}
          placeholder="Select Employee"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Grade/Band */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Grade/Band
          </label>
          <input
            type="text"
            value={formData.grade || ""}
            onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
            placeholder="e.g., A1, B2, Senior"
            className="w-full bg-muted/40 border border-border rounded-lg h-10 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Overtime Rate */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Overtime Rate (per hour)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {CurrencyCode()}
            </span>
            <input
              type="number"
              value={formData.overtime_rate || ""}
              onChange={(e) => setFormData({ ...formData, overtime_rate: Number(e.target.value) })}
              placeholder="0.00"
              className="w-full bg-muted/40 border border-border rounded-lg h-10 pl-12 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Effective Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="text-red-500">*</span> Effective Date
          </label>
          <DatePicker
            value={formData.effective_date}
            onChange={(val) => setFormData({ ...formData, effective_date: val || "" })}
          />
        </div>
      </div>

      {/* Allowances Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {CurrencyCode()}
            </span>
            Allowances
          </h3>
          {totalAllowances > 0 && (
            <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
              Total: {formatCurrency(totalAllowances)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allowanceFields.map(({ key, label, icon: Icon, placeholder }) => (
            <div key={key} className="space-y-2">
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <Icon className="w-3 h-3" />
                {label}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {CurrencyCode()}
            </span>
                <input
                  type="number"
                  value={formData[key] || ""}
                  onChange={(e) => setFormData({ ...formData, [key]: Number(e.target.value) })}
                  placeholder={placeholder}
                  className="w-full bg-muted/40 border border-border rounded-lg h-10 pl-12 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Notes
        </label>
        <textarea
          rows={3}
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes about this compensation structure..."
          className="w-full bg-muted/40 border border-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
        />
      </div>
    </div>
  );
}