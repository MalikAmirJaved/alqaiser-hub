// components/payroll/LoanForm.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { DatePicker } from "@/components/reuseable/DatePicker";
import { AlertCircle, Calculator,  Calendar, Target, FileText } from "lucide-react";

import { useCompanySettings } from "@/hooks/useCompanySettings";
interface LoanFormProps {
  formData: any;
  setFormData: (data: any) => void;
  employeeOptions: Array<{ value: string; label: string }>;
  selectedEmployeeSalary: number;
  formatCurrency: (amount: number) => string;
  errors: string[];
  onValidationChange?: (hasErrors: boolean) => void;
}

export default function LoanForm({ 
  formData, 
  setFormData, 
  employeeOptions, 
  selectedEmployeeSalary, 
  formatCurrency,
  errors,
  onValidationChange 
}: LoanFormProps) {
  const [calculationMode, setCalculationMode] = useState<'deduction' | 'months'>('deduction');
  const [localErrors, setLocalErrors] = useState<string[]>([]);
  const { CurrencyCode } = useCompanySettings();

  // Calculate loan fields
  const calculateLoanFields = useCallback((data: any, mode: 'deduction' | 'months') => {
    const principal = parseFloat(data.principal_amount) || 0;
    const interest = parseFloat(data.interest_rate) || 0;
    const totalPayable = interest > 0 ? principal + (principal * interest / 100) : principal;
    
    let monthlyDeduction: number | null = null;
let totalMonths: number | null = null;
    
    if (mode === 'deduction' && data.monthly_deduction && data.monthly_deduction > 0) {
      monthlyDeduction = parseFloat(data.monthly_deduction);
      totalMonths = Math.ceil(totalPayable / monthlyDeduction);
    } else if (mode === 'months' && data.total_months && data.total_months > 0) {
      totalMonths = parseInt(data.total_months);
      monthlyDeduction = totalPayable / totalMonths;
    }
    
    return {
      totalPayable,
      monthly_deduction: monthlyDeduction,
      total_months: totalMonths,
    };
  }, []);

  // Validate loan data
  const validateLoan = useCallback((data: any, salary: number) => {
    const newErrors: string[] = [];
    const principal = parseFloat(data.principal_amount) || 0;
    const interest = parseFloat(data.interest_rate) || 0;
    const totalPayable = interest > 0 ? principal + (principal * interest / 100) : principal;
    
    let monthlyDeduction = parseFloat(data.monthly_deduction) || 0;
    let totalMonths = parseInt(data.total_months) || 0;
    
    // Auto-calculate if only one field is filled
    if (monthlyDeduction > 0 && totalMonths === 0) {
      totalMonths = Math.ceil(totalPayable / monthlyDeduction);
    } else if (totalMonths > 0 && monthlyDeduction === 0) {
      monthlyDeduction = totalPayable / totalMonths;
    }
    
    // Check monthly deduction vs salary
    if (monthlyDeduction > 0 && monthlyDeduction > salary) {
      newErrors.push(`Monthly deduction (${formatCurrency(monthlyDeduction)}) exceeds employee salary (${formatCurrency(salary)})`);
    }
    
    // Check calculation consistency
    if (monthlyDeduction > 0 && totalMonths > 0) {
      const calculated = monthlyDeduction * totalMonths;
      if (Math.abs(calculated - totalPayable) > 0.01) {
        newErrors.push(`Monthly deduction × months (${formatCurrency(calculated)}) doesn't match total payable (${formatCurrency(totalPayable)})`);
      }
    }
    
    // Check if principal is zero
    if (principal === 0) {
      newErrors.push("Principal amount is required");
    }
    
    setLocalErrors(newErrors);
    if (onValidationChange) {
      onValidationChange(newErrors.length > 0);
    }
    return newErrors;
  }, [formatCurrency, onValidationChange]);

  // Handle field changes with auto-calculation
  const handleFieldChange = (field: string, value: any) => {
    const updated = { ...formData, [field]: value };
    
    // Auto-calculate based on which field changed
    if (field === 'monthly_deduction' && value > 0) {
      setCalculationMode('deduction');
      const { monthly_deduction, total_months } = calculateLoanFields(updated, 'deduction');
      updated.monthly_deduction = monthly_deduction;
      updated.total_months = total_months;
    } else if (field === 'total_months' && value > 0) {
      setCalculationMode('months');
      const { monthly_deduction, total_months } = calculateLoanFields(updated, 'months');
      updated.monthly_deduction = monthly_deduction;
      updated.total_months = total_months;
    } else if (field === 'principal_amount' || field === 'interest_rate') {
      // Recalculate based on current mode
      if (calculationMode === 'deduction' && updated.monthly_deduction > 0) {
        const { monthly_deduction, total_months } = calculateLoanFields(updated, 'deduction');
        updated.monthly_deduction = monthly_deduction;
        updated.total_months = total_months;
      } else if (calculationMode === 'months' && updated.total_months > 0) {
        const { monthly_deduction, total_months } = calculateLoanFields(updated, 'months');
        updated.monthly_deduction = monthly_deduction;
        updated.total_months = total_months;
      }
    }
    
    setFormData(updated);
  };

  // Handle employee change
  const handleEmployeeChange = (employeeId: string) => {
    setFormData({ ...formData, employee_id: employeeId });
  };

  // Validate on changes
  useEffect(() => {
    if (formData.employee_id && selectedEmployeeSalary > 0) {
      validateLoan(formData, selectedEmployeeSalary);
    }
  }, [formData, selectedEmployeeSalary, validateLoan]);

  const calculatedData = calculateLoanFields(formData, calculationMode);
  const allErrors = [...errors, ...localErrors];
  const isMonthlyDeductionExceeds = parseFloat(formData.monthly_deduction) > selectedEmployeeSalary;

  return (
    <div className="space-y-6">
      {/* Employee Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <span className="text-red-500">*</span> Employee
        </label>
        <SearchableSelect
          value={formData.employee_id || ""}
          onChange={handleEmployeeChange}
          options={employeeOptions}
          placeholder="Select Employee"
          required
        />
        {selectedEmployeeSalary > 0 && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-primary/5 rounded-lg text-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {CurrencyCode()}
            </span>
            <span className="text-muted-foreground">Monthly Salary:</span>
            <span className="font-semibold text-primary">{formatCurrency(selectedEmployeeSalary)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Loan Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <span className="text-red-500">*</span> Loan Type
          </label>
          <select 
            value={formData.loan_type || "PERSONAL_LOAN"} 
            onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })}
            className="w-full bg-muted/40 border border-border rounded-lg h-10 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="PERSONAL_LOAN">💳 Personal Loan</option>
            <option value="SALARY_ADVANCE">💰 Salary Advance</option>
            <option value="CAR_LOAN">🚗 Car Loan</option>
            <option value="HOUSE_LOAN">🏠 House Loan</option>
            <option value="EDUCATION_LOAN">📚 Education Loan</option>
            <option value="MEDICAL_LOAN">🏥 Medical Loan</option>
            <option value="EMERGENCY_LOAN">🚨 Emergency Loan</option>
          </select>
        </div>

        {/* Principal Amount */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <span className="text-red-500">*</span> Principal Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {CurrencyCode()}
            </span>
            <input 
              type="number" 
              value={formData.principal_amount || ""} 
              onChange={(e) => handleFieldChange("principal_amount", Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-muted/40 border border-border rounded-lg h-10 pl-12 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Interest Rate */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Interest Rate (%)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            <input 
              type="number" 
              value={formData.interest_rate || ""} 
              onChange={(e) => handleFieldChange("interest_rate", Number(e.target.value))}
              placeholder="0"
              step="0.1"
              className="w-full bg-muted/40 border border-border rounded-lg h-10 pl-8 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Monthly Deduction with auto-calculation */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            Monthly Deduction
            <span className="text-xs text-muted-foreground">(auto-calculates months)</span>
          </label>
          <div className={`relative ${isMonthlyDeductionExceeds ? 'ring-2 ring-red-500 rounded-lg' : ''}`}>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {CurrencyCode()}
            </span>
            <input 
              type="number" 
              value={formData.monthly_deduction || ""} 
              onChange={(e) => handleFieldChange("monthly_deduction", Number(e.target.value))}
              placeholder="Auto from months"
              className={`w-full rounded-lg h-10 pl-12 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                isMonthlyDeductionExceeds 
                  ? "bg-red-50 dark:bg-red-950/20 border-2 border-red-500" 
                  : "bg-muted/40 border border-border"
              }`}
            />
          </div>
          {isMonthlyDeductionExceeds && (
            <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />
              Exceeds monthly salary
            </p>
          )}
        </div>

        {/* Total Months with auto-calculation */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            Total Months
            <span className="text-xs text-muted-foreground">(auto-calculates deduction)</span>
          </label>
          <div className="relative">
            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="number" 
              value={formData.total_months || ""} 
              onChange={(e) => handleFieldChange("total_months", Number(e.target.value))}
              placeholder="Auto from deduction"
              className="w-full bg-muted/40 border border-border rounded-lg h-10 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Start Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Start Date
          </label>
          <DatePicker 
            value={formData.start_date} 
            onChange={(val) => setFormData({ ...formData, start_date: val || "" })} 
          />
        </div>
      </div>

      {/* Purpose */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Purpose
        </label>
        <textarea 
          rows={3} 
          value={formData.purpose || ""} 
          onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
          placeholder="Explain the purpose of this loan..."
          className="w-full bg-muted/40 border border-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
        />
      </div>

      {/* Loan Summary Card */}
      {formData.principal_amount > 0 && (
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">Loan Summary</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Payable</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(calculatedData.totalPayable)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monthly Deduction</p>
              <p className="text-lg font-semibold">{calculatedData.monthly_deduction ? formatCurrency(calculatedData.monthly_deduction) : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Months</p>
              <p className="text-lg font-semibold">{calculatedData.total_months || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Interest Rate</p>
              <p className="text-lg font-semibold">{formData.interest_rate || 0}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {allErrors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Please fix the following issues:</p>
              <ul className="text-xs text-red-600 dark:text-red-300 space-y-1">
                {allErrors.map((error, index) => (
                  <li key={index} className="flex items-center gap-1">
                    <span>•</span> {error}
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