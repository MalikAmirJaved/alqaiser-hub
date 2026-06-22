// src/hooks/useEmployees.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface EmployeeDocument {
  id: string;
  title?: string;
  file_url: string;
  file_url_thumb?: string;
  original_filename: string;
  file_size?: number;
  mime_type?: string;
}

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
  department_id?: string;
  department_name?: string;
  designation_id?: string;
  designation_name?: string;
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
  bank_name?: string;
  bank_account_number?: string;
  bank_iban?: string;
  salary: string;
  profile_picture?: string;
  profile_picture_thumb?: string;
  education_documents?: EmployeeDocument[];
  experience_documents?: EmployeeDocument[];
  isfrom_user_id?: string;
  isfrom_user_email?: string;
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
  department_id?: string;
  department_name?: string;
  designation_id?: string;
  designation_name?: string;
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
  bank_name?: string;
  bank_account_number?: string;
  bank_iban?: string;
  salary: string;
  isfrom_user_id?: string;
  isfrom_user_email?: string;
  createdAt?: string;
  updatedAt?: string;
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

  const paramMap: Record<string, string> = {
    department_id: "department",
    designation_id: "designation",
    employment_status: "status",
    employment_type: "employmentType",
  };

  const apiParams = params
    ? Object.fromEntries(
        Object.entries(params).map(([key, value]) => [
          paramMap[key] || key,
          value,
        ])
      )
    : undefined;

  const queryString = apiParams
    ? "?" + new URLSearchParams(apiParams).toString()
    : "";

  return useQuery<Employee[]>({
    queryKey: ["employees", apiParams],
    queryFn: () => api(`/api/hr/employees/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    placeholderData: (previousData) => previousData,
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