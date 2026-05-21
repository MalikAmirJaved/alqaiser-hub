// components/payroll/types.ts
export interface Compensation {
  id: string;
  employee_id: string;
  employee_name?: string;
  grade?: string;
  basic_salary?: string;
  house_rent_allowance?: number;
  medical_allowance?: number;
  transport_allowance?: number;
  fuel_allowance?: number;
  phone_allowance?: number;
  other_allowances?: number;
  total_allowances?: string;
  total_monthly?: string;
  effective_date?: string;
  overtime_rate?: number;
  notes?: string;
  status?: string;
}

export interface Loan {
  id: string;
  employee_id: string;
  employee_name?: string;
  loan_type: string;
  loan_type_display?: string;
  principal_amount: string;
  interest_rate: number;
  total_payable?: number;
  monthly_deduction: number;
  total_months: number;
  remaining_amount: string;
  start_date?: string;
  purpose?: string;
  status: 'PENDING' | 'ACTIVE' | 'PAID' | 'CANCELLED';
  monthly_salary?: string;
}

export interface LoanFormData {
  employee_id: string;
  loan_type: string;
  principal_amount: number;
  interest_rate: number;
  monthly_deduction: number | null;
  total_months: number | null;
  start_date: string;
  purpose: string;
}

export type LoanCalculationMode = 'deduction' | 'months' | 'none';