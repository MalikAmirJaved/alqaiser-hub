// components/payroll/CompensationForm.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { FileText, TrendingUp, Car, Phone, Home, Plus, Clock, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { FREQUENCY_TYPES, MONTHS, generateYearOptions, getMonthLabel } from "./types";

interface CompensationFormProps {
  formData: any;
  setFormData: (data: any) => void;
  employeeOptions: Array<{ value: string; label: string }>;
  formatCurrency: (amount: number) => string;
  employeeJoiningDate?: string | null;
}

export default function CompensationForm({ formData, setFormData, employeeOptions, formatCurrency, employeeJoiningDate }: CompensationFormProps) {
  const allowanceFields = [
    { key: 'house_rent_allowance', label: 'House Rent Allowance', icon: Home, placeholder: 'Monthly HRA' },
    { key: 'medical_allowance', label: 'Medical Allowance', icon: Plus, placeholder: 'Monthly medical' },
    { key: 'transport_allowance', label: 'Transport Allowance', icon: Car, placeholder: 'Monthly transport' },
    { key: 'phone_allowance', label: 'Phone Allowance', icon: Phone, placeholder: 'Monthly phone' },
    { key: 'utilities_allowance', label: 'Utilities Allowance', icon: Plus, placeholder: 'Monthly utilities' },
    { key: 'education_allowance', label: 'Education Allowance', icon: Plus, placeholder: 'Monthly education' },
    { key: 'other_allowances', label: 'Other Allowances', icon: Plus, placeholder: 'Other allowances' },
  ];

  const calculateTotalAllowances = () => {
    return allowanceFields.reduce((total, field) => {
      return total + (parseFloat(formData[field.key]) || 0);
    }, 0);
  };

  const totalAllowances = calculateTotalAllowances();
  const { CurrencyCode } = useCompanySettings();
  const yearOptions = generateYearOptions();
  const frequencyType = formData.frequency_type || 'MONTH_RANGE';
  const [freqExpanded, setFreqExpanded] = useState(true);

  // Get joining date components
  const joiningDate = useMemo(() => {
    if (!employeeJoiningDate) return null;
    const d = new Date(employeeJoiningDate);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  }, [employeeJoiningDate]);

  // Filter months based on joining date
  const availableMonths = useMemo(() => {
    if (!joiningDate) return MONTHS;
    return MONTHS.filter(m => m.value >= joiningDate.month);
  }, [joiningDate]);

  // Filter year options based on joining date
  const availableYears = useMemo(() => {
    if (!joiningDate) return yearOptions;
    return yearOptions.filter(y => y.value >= joiningDate.year);
  }, [joiningDate, yearOptions]);

  // Selected months for multi-select
  const selectedMonths = formData.selected_months || [];

  const toggleMonth = (month: number, year: number) => {
    const existing = selectedMonths.find((sm: any) => sm.month === month && sm.year === year);
    if (existing) {
      setFormData({
        ...formData,
        selected_months: selectedMonths.filter((sm: any) => !(sm.month === month && sm.year === year))
      });
    } else {
      setFormData({
        ...formData,
        selected_months: frequencyType === 'ONE_TIME' ? [{ month, year }] : [...selectedMonths, { month, year }]
      });
    }
  };

  const mr = formData.month_range || {};

  // Filter end month options based on start selection (exclude start month)
  const availableEndMonths = useMemo(() => {
    if (!mr.start_month || !mr.start_year) return MONTHS;
    const effectiveEndYear = mr.end_year || mr.start_year;
    if (effectiveEndYear > mr.start_year) return MONTHS;
    if (effectiveEndYear === mr.start_year) {
      return MONTHS.filter(m => m.value > mr.start_month);
    }
    return MONTHS;
  }, [mr.start_month, mr.start_year, mr.end_year]);

  const availableEndYears = useMemo(() => {
    if (!mr.start_year) return yearOptions;
    return yearOptions.filter(y => y.value >= mr.start_year);
  }, [mr.start_year, yearOptions]);

  // Auto-set end year and reset end month when start changes
  useEffect(() => {
    if (frequencyType !== 'MONTH_RANGE') return;
    const currentRange = formData.month_range || {};
    let updated = { ...currentRange };

    // If start year is set and end year is missing or earlier, set end year = start year
    if (currentRange.start_year && (!currentRange.end_year || currentRange.end_year < currentRange.start_year)) {
      updated.end_year = currentRange.start_year;
    }

    // If end year equals start year and end month is <= start month, reset end month
    if (
      currentRange.start_year && currentRange.end_year === currentRange.start_year &&
      currentRange.start_month && currentRange.end_month &&
      currentRange.end_month <= currentRange.start_month
    ) {
      updated.end_month = null;
    }

    if (updated.end_year !== currentRange.end_year || updated.end_month !== currentRange.end_month) {
      setFormData({ ...formData, month_range: updated });
    }
  }, [formData.month_range?.start_year, formData.month_range?.start_month, frequencyType]);

  // Validation for month range
  const monthRangeError = useMemo(() => {
    const sm = mr.start_month;
    const sy = mr.start_year;
    const em = mr.end_month;
    const ey = mr.end_year;
    if (!sm || !sy || !em || !ey) return null;
    if (ey < sy || (ey === sy && em <= sm)) return "End month/year must be after start month/year";
    if (joiningDate) {
      if (sy < joiningDate.year || (sy === joiningDate.year && sm < joiningDate.month)) {
        return `Start month must not be before employee joining date (${getMonthLabel(joiningDate.month)} ${joiningDate.year})`;
      }
    }
    return null;
  }, [mr.start_month, mr.start_year, mr.end_month, mr.end_year, joiningDate]);

  return (
    <div className="space-y-5">
      {/* Employee Selection */}
      <div className="space-y-2">
        <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
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

      {/* Overtime Rate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2 text-foreground">
            <TrendingUp className="w-4 h-4 text-primary" />
            Overtime Rate (per hour)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              {CurrencyCode()}
            </span>
            <input
              type="number"
              value={formData.overtime_rate || ""}
              onChange={(e) => setFormData({ ...formData, overtime_rate: Number(e.target.value) })}
              placeholder="0.00"
              className="w-full bg-background border border-border rounded-lg h-10 pl-12 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring"
            />
          </div>
        </div>
      </div>

      {/* Collapsible Frequency Type */}
      <div className="bg-muted/30 rounded-xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setFreqExpanded(!freqExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Frequency Type</span>
            <span className="text-xs text-muted-foreground ml-2">
              ({FREQUENCY_TYPES.find(ft => ft.value === frequencyType)?.label || frequencyType})
            </span>
          </div>
          {freqExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>

        {freqExpanded && (
          <div className="px-4 pb-4 space-y-4">
            <select
              value={frequencyType}
              onChange={(e) => setFormData({ ...formData, frequency_type: e.target.value, selected_months: [], month_range: null })}
              className="w-full bg-background border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring"
            >
              {FREQUENCY_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>

            {/* ONE_TIME / SELECTED_MONTH - Multi-select months */}
            {(frequencyType === 'ONE_TIME' || frequencyType === 'SELECTED_MONTH') && (
              <div className="bg-background rounded-lg p-4 border border-border">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {frequencyType === 'ONE_TIME' ? 'One Time - Select Months' : 'Selected Months'}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  {frequencyType === 'ONE_TIME' ? 'Select one month for this one-time compensation' : 'Select one or more months when this compensation applies'}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {yearOptions.filter(y => !joiningDate || y.value >= joiningDate.year).map((y) => (
                    MONTHS.filter(m => !joiningDate || (y.value === joiningDate.year ? m.value >= joiningDate.month : true)).map((m) => {
                      const isSelected = selectedMonths.some((sm: any) => sm.month === m.value && sm.year === y.value);
                      return (
                        <button
                          key={`${m.value}-${y.value}`}
                          type="button"
                          onClick={() => toggleMonth(m.value, y.value)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                            isSelected
                              ? 'bg-primary/15 border-primary text-primary'
                              : 'bg-background border-border hover:bg-muted'
                          }`}
                        >
                          {isSelected ? <Check className="w-3 h-3" /> : <div className="w-3 h-3" />}
                          <span>{m.label.slice(0, 3)} {y.value}</span>
                        </button>
                      );
                    })
                  ))}
                </div>
                {selectedMonths.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{selectedMonths.length} month(s) selected</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, selected_months: [] })}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Clear all
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* MONTH_RANGE */}
            {frequencyType === 'MONTH_RANGE' && (
              <div className="bg-background rounded-lg p-4 border border-border">
                <h4 className="text-sm font-semibold mb-4 flex items-center gap-2 text-foreground">
                  <Clock className="w-4 h-4 text-primary" />
                  Month Range
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Start Month</label>
                    <select
                      value={mr.start_month || ""}
                      onChange={(e) => {
                        const newMonth = Number(e.target.value);
                        const updated = { ...mr, start_month: newMonth };
                        if (mr.end_year === mr.start_year && mr.end_month <= newMonth) {
                          updated.end_month = 0;
                        }
                        setFormData({ ...formData, month_range: updated });
                      }}
                      className="w-full bg-background border border-border rounded-lg h-9 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring"
                    >
                      <option value="">Month</option>
                      {availableMonths.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Start Year</label>
                    <select
                      value={mr.start_year || ""}
                      onChange={(e) => {
                        const newYear = Number(e.target.value);
                        const updated = { ...mr, start_year: newYear };
                        if (mr.end_year < newYear) {
                          updated.end_month = 0;
                          updated.end_year = 0;
                        } else if (mr.end_year === newYear && mr.end_month <= mr.start_month) {
                          updated.end_month = 0;
                        }
                        setFormData({ ...formData, month_range: updated });
                      }}
                      className="w-full bg-background border border-border rounded-lg h-9 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring"
                    >
                      <option value="">Year</option>
                      {availableYears.map((y) => (
                        <option key={y.value} value={y.value}>{y.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">End Month</label>
                    <select
                      value={mr.end_month || ""}
                      disabled={!mr.start_month || !mr.start_year}
                      onChange={(e) => setFormData({
                        ...formData,
                        month_range: { ...mr, end_month: Number(e.target.value) }
                      })}
                      className="w-full bg-background border border-border rounded-lg h-9 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Month</option>
                      {availableEndMonths.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">End Year</label>
                    <select
                      value={mr.end_year || ""}
                      disabled={!mr.start_month || !mr.start_year}
                      onChange={(e) => setFormData({
                        ...formData,
                        month_range: { ...mr, end_year: Number(e.target.value) }
                      })}
                      className="w-full bg-background border border-border rounded-lg h-9 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Year</option>
                      {availableEndYears.map((y) => (
                        <option key={y.value} value={y.value}>{y.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {monthRangeError && (
                  <p className="text-xs text-red-500 font-medium">{monthRangeError}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Allowances Section */}
      <div className="space-y-3 bg-muted/30 rounded-lg p-4 border border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            💰 Allowances
          </h3>
          {totalAllowances > 0 && (
            <div className="text-xs bg-primary/15 text-primary px-3 py-1.5 rounded-full font-medium">
              Total: {formatCurrency(totalAllowances)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allowanceFields.map(({ key, label, icon: Icon, placeholder }) => (
            <div key={key} className="space-y-2">
              <label className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-primary" />
                {label}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              {CurrencyCode()}
            </span>
                <input
                  type="number"
                  value={formData[key] || ""}
                  onChange={(e) => setFormData({ ...formData, [key]: Number(e.target.value) })}
                  placeholder={placeholder}
                  className="w-full bg-background border border-border rounded-lg h-10 pl-12 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2 text-foreground">
          <FileText className="w-4 h-4 text-primary" />
          Notes
        </label>
        <textarea
          rows={3}
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes about this compensation structure..."
          className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-ring"
        />
      </div>
    </div>
  );
}