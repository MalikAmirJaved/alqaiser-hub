// src/hooks/usePayroll.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface CompensationBreakdown {
  id: string;
  compensation_id: string;
  amount: string;
}

export interface LoanBreakdown {
  id: string;
  loan_id: string;
  principal_amount: string;
  interest_amount: string;
  total_amount: string;
}

export interface LeaveBreakdown {
  id: string;
  leave_request_id: string | null;
  working_days: string;
  amount: string;
}

export interface PayrollRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department: string;
  designation?: string;
  month: number;
  year: number;
  base_salary: string;
  bonus: string;
  deductions: string;
  total_compensation: string;
  total_loan_deduction: string;
  total_leave_deduction: string;
  compensation_breakdown: CompensationBreakdown[];
  loan_breakdown: LoanBreakdown[];
  leave_breakdown: LeaveBreakdown[];
  deduction_breakdown?: any;
  net_salary: string;
  transaction_type: string;
  transaction_number?: string;
  payment_method: string;
  status: string;
  payment_status?: string;
  paid_amount?: string;
  outstanding?: string;
  custom_note?: string;
  processed_at?: string;
  created_at?: string;
}

export interface PayrollStats {
  totalPayroll: string;
  paidCount: number;
  pendingCount: number;
  totalEmployees: number;
  avgSalary: string;
  month: number;
  year: number;
}

export interface SelectedMonth {
  id?: string;
  month: number;
  year: number;
  deduction?: number;
}

export interface MonthRange {
  id?: string;
  start_month: number;
  start_year: number;
  end_month: number;
  end_year: number;
  deduction?: number;
}

export interface EmployeeLoan {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department: string;
  monthly_salary: string;
  loan_type: string;
  loan_type_display: string;
  principal_amount: string;
  remaining_amount: string;
  paid_amount: string;
  paid_months: number;
  interest_rate: string;
  total_payable: string;
  frequency_type: 'ONE_TIME' | 'SELECTED_MONTH' | 'MONTH_RANGE';
  selected_months: SelectedMonth[];
  month_range: MonthRange | null;
  status: string;
  approval: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_iban?: string;
  employee_joining_date?: string | null;
  paid_months_set?: Array<[number, number]>;
  purpose?: string;
  transaction_number?: string;
  approved_at?: string;
  confirmed_at?: string;
  paid_at?: string;
  notes?: string;
  start_date?: string;
  monthly_deduction?: string;
  advance_for_month?: number;
  advance_for_year?: number;
  created_at?: string;
  total_months?: number;
}

export function computeTotalMonths(loan: EmployeeLoan): number {
  if (loan.total_months != null) return loan.total_months;
  switch (loan.frequency_type) {
    case 'ONE_TIME':
      return 1;
    case 'SELECTED_MONTH':
      return loan.selected_months?.length ?? 0;
    case 'MONTH_RANGE': {
      const r = loan.month_range;
      if (!r) return 0;
      return (r.end_year - r.start_year) * 12 + (r.end_month - r.start_month + 1);
    }
    default:
      return 0;
  }
}

export interface Compensation {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department: string;
  designation?: string;
  basic_salary: string;
  house_rent_allowance: string;
  medical_allowance: string;
  transport_allowance: string;
  phone_allowance: string;
  utilities_allowance: string;
  education_allowance: string;
  other_allowances: string;
  overtime_rate: string;
  total_allowances: string;
  total_ctc: string;
  total_monthly: string;
  frequency_type: 'ONE_TIME' | 'SELECTED_MONTH' | 'MONTH_RANGE';
  selected_months: SelectedMonth[];
  month_range: MonthRange | null;
  status: 'PENDING' | 'CONFIRM' | 'REJECT' | 'FULLYPAID';
  paid_months_set?: Array<[number, number]>;
  review_date?: string;
  notes?: string;
  created_at?: string;
}

export interface PayrollPreview {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  joining_date: string | null;
  original_base_salary?: number;
  base_salary: number;
  prorated_days?: number;
  days_in_month?: number;
  proration_factor?: string;
  daily_rate?: number;
  compensation: number;
  overtime_hours: number;
  overtime_amount: number;
  bonus: number;
  leave_deduction: number;
  leave_days: number;
  loan_deductions: number;
  loan_details: Array<{
    loan_id: string;
    loan_type: string;
    principal: number;
    interest: number;
    total: number;
  }>;
  custom_deductions: number;
  total_deductions: number;
  net_salary: number;
  // Carryover fields when deductions exceed salary
  carryover_amount?: number;
  carryover_required?: boolean;
  suggested_carryover_month?: number;
  suggested_carryover_year?: number;
}



type PayrollApiBase = "hr" | "finance";

function payrollBase(module: PayrollApiBase = "hr") {
  return module === "finance" ? "/api/finance/payroll" : "/api/hr/payroll";
}

// ===== Payroll Hooks =====
interface PaginatedResponse<T> {
  count: number;
  total_pages: number;
  current_page: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function usePayroll(params?: Record<string, string>, module: PayrollApiBase = "hr") {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  const base = payrollBase(module);
  const query = useQuery<PaginatedResponse<PayrollRecord>>({
    queryKey: ["payroll", module, params],
    queryFn: () => api(`${base}/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
  return {
    ...query,
    data: query.data?.results ?? [],
    totalCount: query.data?.count ?? 0,
    totalPages: query.data?.total_pages ?? 0,
    currentPage: query.data?.current_page ?? 1,
  };
}

export function usePayrollStats(params?: Record<string, string>, module: PayrollApiBase = "hr") {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  const base = payrollBase(module);
  return useQuery<PayrollStats>({
    queryKey: ["payrollStats", module, params],
    queryFn: () => api(`${base}/stats/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useProcessPayroll(module: PayrollApiBase = "hr") {
  const api = useApi();
  const queryClient = useQueryClient();
  const base = payrollBase(module);
  return useMutation({
    mutationFn: (data: any) => api(`${base}/`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({ queryKey: ["payrollStats"] });
      queryClient.invalidateQueries({ queryKey: ["employeeLoans"] });
    },
  });
}

export function useProcessPayrollAdvance(module: PayrollApiBase = "hr") {
  const api = useApi();
  const queryClient = useQueryClient();
  const base = payrollBase(module);
  return useMutation({
    mutationFn: (data: any) => api(`${base}/advance/`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({ queryKey: ["payrollStats"] });
      queryClient.invalidateQueries({ queryKey: ["employeeLoans"] });
    },
  });
}

// ===== Loan Hooks =====
export function useEmployeeLoans(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  const query = useQuery<PaginatedResponse<EmployeeLoan>>({
    queryKey: ["employeeLoans", params],
    queryFn: () => api(`/api/hr/loans/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
  return {
    ...query,
    data: query.data?.results ?? [],
    totalCount: query.data?.count ?? 0,
    totalPages: query.data?.total_pages ?? 0,
    currentPage: query.data?.current_page ?? 1,
  };
}

export function useEmployeeLoan(id: string | null) {
  const api = useApi();
  return useQuery<EmployeeLoan>({
    queryKey: ["employeeLoan", id],
    queryFn: () => api(`/api/hr/loans/${id}/`),
    enabled: !!id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useCreateEmployeeLoan() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api("/api/hr/loans/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeLoans"] });
    },
  });
}

export function useUpdateEmployeeLoan() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => {
      const { id, ...rest } = data;
      return api(`/api/hr/loans/${id}/`, { method: "PATCH", body: JSON.stringify(rest) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeLoans"] });
    },
  });
}

export function useDeleteEmployeeLoan() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/hr/loans/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeLoans"] });
    },
  });
}

// ===== Compensation Hooks =====
export function useCompensations(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  const query = useQuery<PaginatedResponse<Compensation>>({
    queryKey: ["compensations", params],
    queryFn: () => api(`/api/hr/compensations/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
  return {
    ...query,
    data: query.data?.results ?? [],
    totalCount: query.data?.count ?? 0,
    totalPages: query.data?.total_pages ?? 0,
    currentPage: query.data?.current_page ?? 1,
  };
}

export function useCompensation(id: string | null) {
  const api = useApi();
  return useQuery<Compensation>({
    queryKey: ["compensation", id],
    queryFn: () => api(`/api/hr/compensations/${id}/`),
    enabled: !!id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useCreateCompensation() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api("/api/hr/compensations/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compensations"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

export function useUpdateCompensation() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => {
      const { id, ...rest } = data;
      return api(`/api/hr/compensations/${id}/`, { method: "PATCH", body: JSON.stringify(rest) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compensations"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

export function useDeleteCompensation() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/hr/compensations/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compensations"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

export function useUpdateCompensationStatus() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; status: string }) =>
      api("/api/hr/compensations/status/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compensations"] });
    },
  });
}

export function useUpdateLoanStatus() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; status?: string; approval?: string }) => 
      api("/api/hr/loans/status/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeLoans"] });
    },
  });
}

export function useApproveLoan() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; approval: string }) => 
      api("/api/hr/loans/approve/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeLoans"] });
    },
  });
}

export function usePayLoan() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => {
      const { id, ...rest } = data;
      return api(`/api/hr/loans/pay/`, { method: "POST", body: JSON.stringify({ id, ...rest }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeLoans"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({ queryKey: ["finance_payments"] });
      queryClient.invalidateQueries({ queryKey: ["finance_dashboard_summary"] });
      queryClient.invalidateQueries({ queryKey: ["finance_dashboard_recent_payments"] });
    },
  });
}


export function usePayrollPreview(module: PayrollApiBase = "hr") {
  const api = useApi();
  const base = payrollBase(module);
  return useMutation<PayrollPreview, Error, any>({
    mutationFn: (data: any) => api(`${base}/preview/`, { method: "POST", body: JSON.stringify(data) }),
  });
}
