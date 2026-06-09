// src/hooks/usePayroll.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface PayrollRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_code: string;
  department: string;
  designation?: string;
  month: number;
  year: number;
  base_salary: string;
  bonus: string;
  deductions: string;
  deduction_breakdown?: any;
  net_salary: string;
  transaction_type: string;
  transaction_number?: string;
  payment_method: string;
  status: string;
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

export interface EmployeeLoan {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_code: string;
  department: string;
  loan_type: string;
  loan_type_display: string;
  principal_amount: string;
  monthly_deduction: string;
  remaining_amount: string;
  total_months: number;
  paid_months: number;
  remaining_months: number;
  interest_rate: string;
  total_payable: string;
  start_date: string;
  end_date?: string;
  status: string;
  purpose?: string;
  transaction_number?: string;
  approved_at?: string;
  notes?: string;
  created_at?: string;
}

export interface Compensation {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_code: string;
  department: string;
  designation?: string;
  grade?: string;
  basic_salary: string;
  house_rent_allowance: string;
  medical_allowance: string;
  transport_allowance: string;
  fuel_allowance: string;
  phone_allowance: string;
  utilities_allowance: string;
  education_allowance: string;
  other_allowances: string;
  employer_pf: string;
  employer_eobi: string;
  overtime_rate: string;
  bonus_percentage: string;
  total_allowances: string;
  total_ctc: string;
  total_monthly: string;
  is_active: boolean;
  status: string;
  effective_date: string;
  review_date?: string;
  notes?: string;
  created_at?: string;
}

// ===== Payroll Hooks =====
export function usePayroll(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery<PayrollRecord[]>({
    queryKey: ["payroll", params],
    queryFn: () => api(`/api/hr/payroll/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function usePayrollStats(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery<PayrollStats>({
    queryKey: ["payrollStats", params],
    queryFn: () => api(`/api/hr/payroll/stats/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useProcessPayroll() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api("/api/hr/payroll/", { method: "POST", body: JSON.stringify(data) }),
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
  return useQuery<EmployeeLoan[]>({
    queryKey: ["employeeLoans", params],
    queryFn: () => api(`/api/hr/loans/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
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
    mutationFn: (data: any) => api("/api/hr/loans/", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeLoans"] });
    },
  });
}

export function useDeleteEmployeeLoan() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api("/api/hr/loans/", { method: "DELETE", body: JSON.stringify({ id }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeLoans"] });
    },
  });
}

// ===== Compensation Hooks =====
export function useCompensations(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery<Compensation[]>({
    queryKey: ["compensations", params],
    queryFn: () => api(`/api/hr/compensations/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
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
    mutationFn: (data: any) => api("/api/hr/compensations/", { method: "PATCH", body: JSON.stringify(data) }),
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
    mutationFn: (id: number) => api("/api/hr/compensations/", { method: "DELETE", body: JSON.stringify({ id }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compensations"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}