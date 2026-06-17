// components/payroll/LoanForm.tsx
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { AlertCircle, Calculator, Target, FileText, Clock, Check, X, ChevronDown, ChevronRight, Banknote, Building2 } from "lucide-react";

import { useCompanySettings } from "@/hooks/useCompanySettings";
import { FREQUENCY_TYPES, MONTHS, generateYearOptions, getMonthLabel } from "./types";

interface LoanFormProps {
  formData: any;
  setFormData: (data: any) => void;
  employeeOptions: Array<{ value: string; label: string }>;
  employees?: Array<{ id: string; bank_name?: string; bank_account_number?: string; bank_iban?: string }>;
  selectedEmployeeSalary: number;
  formatCurrency: (amount: number) => string;
  errors: string[];
  onValidationChange?: (hasErrors: boolean) => void;
  employeeJoiningDate?: string | null;
}

function generateMonthList(startMonth: number, startYear: number, endMonth: number, endYear: number) {
  const months: Array<{ month: number; year: number }> = [];
  let current = { month: startMonth, year: startYear };
  while (current.year < endYear || (current.year === endYear && current.month <= endMonth)) {
    months.push({ ...current });
    current.month += 1;
    if (current.month > 12) {
      current.month = 1;
      current.year += 1;
    }
  }
  return months;
}

export default function LoanForm({
  formData,
  setFormData,
  employeeOptions,
  employees = [],
  selectedEmployeeSalary,
  formatCurrency,
  errors,
  onValidationChange,
  employeeJoiningDate
}: LoanFormProps) {
  const [localErrors, setLocalErrors] = useState<string[]>([]);
  const [freqExpanded, setFreqExpanded] = useState(true);
  const { CurrencyCode } = useCompanySettings();
  const yearOptions = generateYearOptions();
  const frequencyType = formData.frequency_type || 'MONTH_RANGE';

  // Get joining date components
  const joiningDate = useMemo(() => {
    if (!employeeJoiningDate) return null;
    const d = new Date(employeeJoiningDate);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  }, [employeeJoiningDate]);

  const principal = parseFloat(formData.principal_amount) || 0;

  // Calculate total payable
  const totalPayable = useMemo(() => {
    const interest = parseFloat(formData.interest_rate) || 0;
    return interest > 0 ? principal + (principal * interest / 100) : principal;
  }, [principal, formData.interest_rate]);

  // Selected months
  const selectedMonths = formData.selected_months || [];

  const mr = formData.month_range || {};

  // Filter available months for start month based on joining date and selected start year
  const availableStartMonths = useMemo(() => {
    if (!joiningDate) return MONTHS;
    const year = mr.start_year;
    if (year && year > joiningDate.year) return MONTHS;
    return MONTHS.filter(m => m.value >= joiningDate.month);
  }, [joiningDate, mr.start_year]);

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

  // Generate individual months from month range selection
  useEffect(() => {
    if (frequencyType !== 'MONTH_RANGE') return;
    const sm = mr.start_month;
    const sy = mr.start_year;
    const em = mr.end_month;
    const ey = mr.end_year;
    if (!sm || !sy || !em || !ey) return;

    const generated = generateMonthList(sm, sy, em, ey);
    const autoDeduction = generated.length > 0 ? totalPayable / generated.length : 0;

    // Preserve existing deductions where possible
    const merged = generated.map(g => ({ ...g, deduction: autoDeduction }));

    // Check if anything changed to avoid infinite loops
    const currentJson = JSON.stringify(selectedMonths.map((s: any) => ({ month: s.month, year: s.year, deduction: s.deduction })));
    const newJson = JSON.stringify(merged);
    if (currentJson !== newJson) {
      setFormData({ ...formData, selected_months: merged });
    }
  }, [frequencyType, mr.start_month, mr.start_year, mr.end_month, mr.end_year, totalPayable]);

  // Auto-set end year and reset end month when start changes
  useEffect(() => {
    if (frequencyType !== 'MONTH_RANGE') return;
    const currentRange = formData.month_range || {};
    let updated = { ...currentRange };

    if (currentRange.start_year && (!currentRange.end_year || currentRange.end_year < currentRange.start_year)) {
      updated.end_year = currentRange.start_year;
    }

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

  // Auto-populate bank info when employee selection changes
  const prevEmployeeId = useRef(formData.employee_id);
  useEffect(() => {
    const currentId = formData.employee_id;
    if (!currentId) return;

    const hasBankInfo = formData.bank_name || formData.bank_account_number || formData.bank_iban;
    if (currentId === prevEmployeeId.current && hasBankInfo) return;

    prevEmployeeId.current = currentId;
    const employee = employees.find((e: any) => String(e.id) === String(currentId));
    if (employee) {
      setFormData({
        ...formData,
        bank_name: employee.bank_name || formData.bank_name || "",
        bank_account_number: employee.bank_account_number || formData.bank_account_number || "",
        bank_iban: employee.bank_iban || formData.bank_iban || "",
      });
    }
  }, [formData.employee_id, employees]);

  // Auto-calculate deduction per month for selected months (totalPayable / num months)
  const selectedMonthDeduction = useMemo(() => {
    if (selectedMonths.length === 0 || principal <= 0) return 0;
    return totalPayable / selectedMonths.length;
  }, [selectedMonths.length, totalPayable, principal]);

  // Sum of all deductions
  const totalDeductions = useMemo(() => {
    return selectedMonths.reduce((sum: number, sm: any) => sum + (parseFloat(sm.deduction) || 0), 0);
  }, [selectedMonths]);

  // Deduction sum mismatch error (compare against totalPayable)
  const deductionSumError = useMemo(() => {
    if (selectedMonths.length === 0 || principal <= 0) return null;
    const diff = Math.abs(totalDeductions - totalPayable);
    if (diff > 0.01) {
      return `Sum of deductions (${formatCurrency(totalDeductions)}) must equal Total Payable (${formatCurrency(totalPayable)})`;
    }
    return null;
  }, [selectedMonths, totalDeductions, totalPayable, principal, formatCurrency]);

  // Toggle month selection - recalculate all deductions based on totalPayable / count
  const toggleMonth = (month: number, year: number) => {
    const existing = selectedMonths.find((sm: any) => sm.month === month && sm.year === year);
    if (existing) {
      const remaining = selectedMonths.filter((sm: any) => !(sm.month === month && sm.year === year));
      const deduction = remaining.length > 0 ? totalPayable / remaining.length : 0;
      setFormData({
        ...formData,
        selected_months: remaining.map((sm: any) => ({ ...sm, deduction }))
      });
    } else {
      const newCount = selectedMonths.length + 1;
      const deduction = totalPayable / newCount;
      setFormData({
        ...formData,
        selected_months: frequencyType === 'ONE_TIME'
          ? [{ month, year, deduction }]
          : [...selectedMonths.map((sm: any) => ({ ...sm, deduction })), { month, year, deduction }]
      });
    }
  };

  // Update deduction for a specific selected month
  const updateMonthDeduction = (month: number, year: number, deduction: number) => {
    setFormData({
      ...formData,
      selected_months: selectedMonths.map((sm: any) =>
        sm.month === month && sm.year === year ? { ...sm, deduction } : sm
      )
    });
  };

  // Validation for month range
  const monthRangeError = useMemo(() => {
    const mr = formData.month_range;
    if (!mr?.start_month || !mr?.start_year || !mr?.end_month || !mr?.end_year) return null;
    if (mr.end_year < mr.start_year || (mr.end_year === mr.start_year && mr.end_month <= mr.start_month)) {
      return "End month/year must be after start month/year";
    }
    if (joiningDate) {
      if (mr.start_year < joiningDate.year || (mr.start_year === joiningDate.year && mr.start_month < joiningDate.month)) {
        return `Start month must not be before employee joining date (${getMonthLabel(joiningDate.month)} ${joiningDate.year})`;
      }
    }
    return null;
  }, [formData.month_range, joiningDate]);

  // Validate
  useEffect(() => {
    const newErrors: string[] = [];
    if (principal === 0) newErrors.push("Principal amount is required");

    if (frequencyType === 'MONTH_RANGE') {
      if (monthRangeError) newErrors.push(monthRangeError);
    }
    if ((frequencyType === 'SELECTED_MONTH' || frequencyType === 'ONE_TIME') && selectedMonths.length === 0) {
      newErrors.push("At least one month must be selected");
    }
    if (frequencyType === 'MONTH_RANGE' && (!mr.start_month || !mr.start_year || !mr.end_month || !mr.end_year)) {
      newErrors.push("Please complete the month range selection");
    }
    if (deductionSumError) newErrors.push(deductionSumError);

    setLocalErrors(newErrors);
    if (onValidationChange) onValidationChange(newErrors.length > 0);
  }, [formData, frequencyType, selectedMonths, monthRangeError, deductionSumError, principal, mr, onValidationChange]);

  const allErrors = [...errors, ...localErrors];

  // Available months for selected month grid
  const availableMonthsForGrid = useMemo(() => {
    if (!joiningDate) return MONTHS;
    return MONTHS.filter(m => m.value >= joiningDate.month);
  }, [joiningDate]);

  return (
    <div className="space-y-5">
      {/* Employee Selection */}
      <div className="space-y-2">
        <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <span className="text-red-500">*</span> Employee
        </label>
        <SearchableSelect
          value={formData.employee_id || ""}
          onChange={(employeeId) => setFormData({ ...formData, employee_id: employeeId })}
          options={employeeOptions}
          placeholder="Select Employee"
          required
        />
        {selectedEmployeeSalary > 0 && (
          <div className="flex items-center gap-2 mt-2 p-3 bg-primary/10 rounded-lg text-sm border border-primary/20">
            <span className="text-muted-foreground">Monthly Salary:</span>
            <span className="font-semibold text-primary">{formatCurrency(selectedEmployeeSalary)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Loan Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2 text-foreground">
            <span className="text-red-500">*</span> Loan Type
          </label>
          <select
            value={formData.loan_type || "PERSONAL_LOAN"}
            onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })}
            className="w-full bg-background border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="PERSONAL_LOAN">Personal Loan</option>
            <option value="SALARY_ADVANCE">Salary Advance</option>
            <option value="CAR_LOAN">Car Loan</option>
            <option value="HOUSE_LOAN">House Loan</option>
            <option value="EDUCATION_LOAN">Education Loan</option>
            <option value="MEDICAL_LOAN">Medical Loan</option>
            <option value="EMERGENCY_LOAN">Emergency Loan</option>
          </select>
        </div>

        {/* Principal Amount */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2 text-foreground">
            <span className="text-red-500">*</span> Principal Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              {CurrencyCode()}
            </span>
            <input
              type="number"
              value={formData.principal_amount || ""}
              onChange={(e) => setFormData({ ...formData, principal_amount: Number(e.target.value) })}
              placeholder="0.00"
              className="w-full bg-background border border-border rounded-lg h-10 pl-12 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring"
            />
          </div>
        </div>

        {/* Interest Rate */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Interest Rate (%)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
            <input
              type="number"
              value={formData.interest_rate || ""}
              onChange={(e) => setFormData({ ...formData, interest_rate: Number(e.target.value) })}
              placeholder="0"
              step="0.1"
              className="w-full bg-background border border-border rounded-lg h-10 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring"
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
              onChange={(e) => setFormData({ ...formData, frequency_type: e.target.value, selected_months: [], month_range: {} })}
              className="w-full bg-background border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {FREQUENCY_TYPES.map(ft => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>

            {/* ONE_TIME / SELECTED_MONTH - Multi-select months with deduction */}
            {(frequencyType === 'ONE_TIME' || frequencyType === 'SELECTED_MONTH') && (
              <div className="bg-background rounded-lg p-4 border border-border">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {frequencyType === 'ONE_TIME' ? 'One Time - Select Months' : 'Selected Months'}
                </h4>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  {frequencyType === 'ONE_TIME' ? 'Select one month for this one-time deduction' : 'Select months and set deduction amount for each (auto-calculated, editable)'}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
                  {yearOptions.filter(y => !joiningDate || y.value >= joiningDate.year).map((y) => (
                    MONTHS.filter(m => !joiningDate || (y.value === joiningDate.year ? m.value >= joiningDate.month : true)).map((m) => {
                      const isSelected = selectedMonths.some((sm: any) => sm.month === m.value && sm.year === y.value);
                      return (
                        <button
                          key={`${m.value}-${y.value}`}
                          type="button"
                          onClick={() => toggleMonth(m.value, y.value)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                            isSelected
                              ? 'bg-primary/15 border-primary text-primary shadow-sm'
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

                {/* Per-month deduction fields */}
                {selectedMonths.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">
                        {selectedMonths.length} month(s) selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, selected_months: [] })}
                        className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3 h-3" /> Clear all
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                      {selectedMonths.map((sm: any) => (
                        <div key={`${sm.month}-${sm.year}`} className="flex items-center gap-3 p-2.5 bg-background rounded-lg border border-border hover:border-primary/30 transition-colors">
                          <span className="text-sm font-medium min-w-[90px] text-foreground">
                            {getMonthLabel(sm.month)} {sm.year}
                          </span>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                              {CurrencyCode()}
                            </span>
                            <input
                              type="number"
                              value={sm.deduction || ""}
                              onChange={(e) => updateMonthDeduction(sm.month, sm.year, Number(e.target.value))}
                              placeholder={formatCurrency(selectedMonthDeduction)}
                              className="w-full bg-background border border-border rounded-lg h-8 pl-10 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {deductionSumError && selectedMonths.length > 0 && (
                      <p className="text-xs text-red-500 font-medium mt-2">{deductionSumError}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* MONTH_RANGE */}
            {frequencyType === 'MONTH_RANGE' && (
              <div className="bg-background rounded-lg p-4 border border-border">
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Month Range
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Start Month</label>
                    <select
                      value={mr.start_month ? String(mr.start_month) : ""}
                      onChange={(e) => {
                        const newMonth = Number(e.target.value);
                        const updated = { ...mr, start_month: newMonth };
                        if (mr.end_year === mr.start_year && mr.end_month <= newMonth) {
                          updated.end_month = 0;
                        }
                        setFormData({ ...formData, month_range: updated });
                      }}
                      className="w-full bg-background border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Month</option>
                      {availableStartMonths.map(m => (
                        <option key={m.value} value={String(m.value)}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Start Year</label>
                    <select
                      value={mr.start_year ? String(mr.start_year) : ""}
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
                      className="w-full bg-background border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Year</option>
                      {yearOptions.filter(y => !joiningDate || y.value >= joiningDate.year).map(y => (
                        <option key={y.value} value={String(y.value)}>{y.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">End Month</label>
                    <select
                      value={mr.end_month ? String(mr.end_month) : ""}
                      onChange={(e) => setFormData({
                        ...formData,
                        month_range: { ...mr, end_month: Number(e.target.value) }
                      })}
                      disabled={!mr.start_month || !mr.start_year}
                      className="w-full bg-background border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Month</option>
                      {availableEndMonths.map(m => (
                        <option key={m.value} value={String(m.value)}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">End Year</label>
                    <select
                      value={mr.end_year ? String(mr.end_year) : ""}
                      onChange={(e) => setFormData({
                        ...formData,
                        month_range: { ...mr, end_year: Number(e.target.value) }
                      })}
                      disabled={!mr.start_month || !mr.start_year}
                      className="w-full bg-background border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Year</option>
                      {availableEndYears.map(y => (
                        <option key={y.value} value={String(y.value)}>{y.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {monthRangeError && (
                  <p className="text-xs text-red-500 font-medium mb-2">{monthRangeError}</p>
                )}

                {/* Per-month deduction fields for generated range */}
                {selectedMonths.length > 0 && (
                  <div className="space-y-2 mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">
                        {selectedMonths.length} month(s) in range
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Auto: <span className="text-primary font-semibold">{formatCurrency(selectedMonthDeduction)}</span>/month
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                      {selectedMonths.map((sm: any) => (
                        <div key={`${sm.month}-${sm.year}`} className="flex items-center gap-3 p-2.5 bg-background rounded-lg border border-border hover:border-primary/30 transition-colors">
                          <span className="text-sm font-medium min-w-[90px] text-foreground">
                            {getMonthLabel(sm.month)} {sm.year}
                          </span>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                              {CurrencyCode()}
                            </span>
                            <input
                              type="number"
                              value={sm.deduction || ""}
                              onChange={(e) => updateMonthDeduction(sm.month, sm.year, Number(e.target.value))}
                              placeholder={formatCurrency(selectedMonthDeduction)}
                              className="w-full bg-background border border-border rounded-lg h-8 pl-10 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {deductionSumError && (
                      <p className="text-xs text-red-500 font-medium mt-2">{deductionSumError}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bank Information */}
      <div className="bg-muted/30 rounded-xl border border-border overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Banknote className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Bank Information</span>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Bank Name</label>
            <input
              type="text"
              value={formData.bank_name || ""}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              placeholder="e.g., National Bank"
              className="w-full bg-background border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Account Number</label>
            <input
              type="text"
              value={formData.bank_account_number || ""}
              onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
              placeholder="e.g., 1234567890"
              className="w-full bg-background border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">IBAN</label>
            <input
              type="text"
              value={formData.bank_iban || ""}
              onChange={(e) => setFormData({ ...formData, bank_iban: e.target.value })}
              placeholder="e.g., PK36NAFA000123456789"
              className="w-full bg-background border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-ring"
            />
          </div>
        </div>
      </div>

      {/* Purpose */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2 text-foreground">
          <FileText className="w-4 h-4 text-primary" />
          Purpose
        </label>
        <textarea
          rows={3}
          value={formData.purpose || ""}
          onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
          placeholder="Explain the purpose of this loan..."
          className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-ring"
        />
      </div>

      {/* Loan Summary Card */}
      {formData.principal_amount > 0 && (
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-lg p-4 border border-primary/20 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Loan Summary</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-background/50 rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground font-medium mb-1">Principal Amount</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(parseFloat(formData.principal_amount))}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground font-medium mb-1">Total Payable</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(totalPayable)}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground font-medium mb-1">Interest Rate</p>
              <p className="text-lg font-semibold text-foreground">{formData.interest_rate || 0}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {allErrors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Please fix the following issues:</p>
              <ul className="text-xs text-red-600 dark:text-red-300 space-y-1">
                {allErrors.map((error, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="text-red-400">•</span> {error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}