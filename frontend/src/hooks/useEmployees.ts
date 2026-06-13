// src/hooks/useEmployees.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name?: string;
  father_name?: string;
  cnic?: string;
  date_of_birth?: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  marital_status: 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
  phone: string;
  email?: string;
  personal_email?: string;
  address_line?: string;
  country: string;
  state?: string;
  city?: string;
  postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  role: 'STAFF' | 'BRANCH_ADMIN' | 'COMPANY_ADMIN';
  department: string;
  designation?: string;
  employment_type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
  employment_status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'RESIGNED';
  joining_date: string;
  confirmation_date?: string;
  probation_days: number;
  work_location: 'OFFICE' | 'REMOTE' | 'HYBRID';
  reporting_manager_id?: string;
  reporting_manager_name?: string;
  default_shift_id?: string;
  default_shift_name?: string;
  asset_category_id?: string;
  bank_name?: string;
  // Link to a User if this employee was used to create a user account
  isfrom_user_id?: string;
  bank_account_number?: string;
  bank_iban?: string;
  salary: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeStats {
  totalEmployees: number;
  activeEmployees: number;
  onLeave: number;
  departments: number;
  withDefaultShift: number;
  byDepartment: { department: string; count: number }[];
  byStatus: { employment_status: string; count: number }[];
}

export interface ActiveEmployee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name?: string;
  full_name: string;
  department_id?: string;
  department_name?: string;
  designation_id?: string;
  designation_name?: string;
  email?: string;
  phone: string;
}

// Fetch only active employees (for dropdowns)
export function useActiveEmployees() {
  const api = useApi();
  return useQuery<ActiveEmployee[]>({
    queryKey: ["employees", "active"],
    queryFn: () => api("/api/hr/employees/active/"),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// Fetch all employees
export function useEmployees(params?: Record<string, string>) {
  const api = useApi();
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  
  return useQuery<Employee[]>({
    queryKey: ["employees", params],
    queryFn: () => api(`/api/hr/employees/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// Fetch employee stats
export function useEmployeeStats() {
  const api = useApi();
  return useQuery<EmployeeStats>({
    queryKey: ["employeeStats"],
    queryFn: () => api("/api/hr/employees/stats/"),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// Create employee
export function useCreateEmployee() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (employee: Omit<Employee, "id" | "_id" | "createdAt" | "updatedAt" | "reporting_manager_name" | "default_shift_name">) =>
      api("/api/hr/employees/", {
        method: "POST",
        body: JSON.stringify(employee),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employeeStats"] });
      // Refresh users so UI reflects new isfrom_employee links when employees are created from users
      queryClient.invalidateQueries({ queryKey: ["users"] });
      // Refresh recruitment in case this employee was created from a candidate
      queryClient.invalidateQueries({ queryKey: ["recruitment"] });
      queryClient.invalidateQueries({ queryKey: ["recruitmentStats"] });
    },
  });
}

// Update employee
export function useUpdateEmployee() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (employee: Partial<Employee> & { id: string }) =>
      api("/api/hr/employees/", {
        method: "PATCH",
        body: JSON.stringify(employee),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employeeStats"] });
    },
  });
}

// Delete employee
export function useDeleteEmployee() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api("/api/hr/employees/", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employeeStats"] });
    },
  });
}