// src/hooks/useShiftManagement.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface ResolvedShift {
  employee_id: string;
  employee_name: string;
  employee_department: string;
  template_id: string | null;
  template_name: string | null;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  is_override: boolean;
  source_type: string;
}

export interface ShiftOverride {
  id: string;
  employee_id: string;
  template_id: string;
  date: string;
  reason: string;
}

export interface ShiftDateRangeAssignment {
  id: string;
  employee_id: string;
  template_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  is_active: boolean;
}

export interface ShiftHistoryResponse {
  data: Array<{
    id: string;
    employee_id: string;
    employee_name: string;
    change_type: string;
    from_template_name: string;
    to_template_name: string;
    effective_from: string;
    effective_to: string | null;
    reason: string;
    changed_by_name: string;
    changed_at: string;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface ShiftStatistics {
  total_employees: number;
  employees_with_shift: number;
  employees_without_shift: number;
  overrides_today: number;
  shift_distribution: Record<string, number>;
  template_statistics: Array<{
    template_id: string;
    template_name: string;
    is_active: boolean;
    overrides_count: number;
    date_range_count: number;
    default_count: number;
    total_usage: number;
  }>;
}

// Response type for resolved shifts
export interface ResolvedShiftsResponse {
  [employeeId: string]: {
    employee_name: string;
    employee_department: string;
    shifts: {
      [date: string]: {
        template_id: string | null;
        template_name: string | null;
        start_time: string | null;
        end_time: string | null;
        break_minutes: number;
        is_override: boolean;
        source_type: string;
      };
    };
  };
}

// Get resolved shifts for employees
export function useResolvedShifts(
  employeeIds: string[], 
  date?: string, 
  startDate?: string, 
  endDate?: string
) {
  const api = useApi();
  
  const params = new URLSearchParams();
  employeeIds.forEach(id => params.append('employee_ids', id.toString()));
  if (date) params.append('date', date);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  const queryKey = ['resolvedShifts', { employeeIds, date, startDate, endDate }];
  
  return useQuery<ResolvedShiftsResponse>({
    queryKey,
    queryFn: () => api(`/api/hr/shifts/resolve/?${params.toString()}`),
    enabled: employeeIds.length > 0 && !!(date || (startDate && endDate)),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get shift overrides
export function useShiftOverrides(employeeId?: string, startDate?: string, endDate?: string) {
  const api = useApi();
  
  const params = new URLSearchParams();
  if (employeeId) params.append('employee_id', employeeId.toString());
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  return useQuery<ShiftOverride[]>({
    queryKey: ['shiftOverrides', { employeeId, startDate, endDate }],
    queryFn: () => api(`/api/hr/shifts/overrides/?${params.toString()}`),
  });
}

// Get shift date range assignments
export function useShiftDateRangeAssignments(employeeId?: string, activeOnly: boolean = true) {
  const api = useApi();
  
  const params = new URLSearchParams();
  if (employeeId) params.append('employee_id', employeeId.toString());
  params.append('active_only', activeOnly.toString());
  
  return useQuery<ShiftDateRangeAssignment[]>({
    queryKey: ['shiftDateRange', { employeeId, activeOnly }],
    queryFn: () => api(`/api/hr/shifts/date-range/?${params.toString()}`),
  });
}

// Create shift override
export function useCreateShiftOverride() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { employee_id: string; template_id: string; date: string; reason?: string }) =>
      api('/api/hr/shifts/overrides/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shiftOverrides'] });
      queryClient.invalidateQueries({ queryKey: ['resolvedShifts'] });
      queryClient.invalidateQueries({ queryKey: ['shiftStatistics'] });
    },
  });
}

// Update shift override
export function useUpdateShiftOverride() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { id: string; reason?: string }) =>
      api('/api/hr/shifts/overrides/', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shiftOverrides'] });
      queryClient.invalidateQueries({ queryKey: ['resolvedShifts'] });
    },
  });
}

// Delete shift override
export function useDeleteShiftOverride() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      api('/api/hr/shifts/overrides/', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shiftOverrides'] });
      queryClient.invalidateQueries({ queryKey: ['resolvedShifts'] });
      queryClient.invalidateQueries({ queryKey: ['shiftStatistics'] });
      queryClient.invalidateQueries({ queryKey: ['shiftHistory'] });
    },
  });
}

// Create date range assignment
export function useCreateDateRangeAssignment() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { employee_id: string; template_id: string; start_date: string; end_date?: string; reason?: string }) =>
      api('/api/hr/shifts/date-range/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shiftDateRange'] });
      queryClient.invalidateQueries({ queryKey: ['resolvedShifts'] });
      queryClient.invalidateQueries({ queryKey: ['shiftStatistics'] });
    },
  });
}

// Update date range assignment
export function useUpdateDateRangeAssignment() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { id: string; is_active?: boolean; reason?: string }) =>
      api('/api/hr/shifts/date-range/', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shiftDateRange'] });
      queryClient.invalidateQueries({ queryKey: ['resolvedShifts'] });
    },
  });
}

// Delete date range assignment
export function useDeleteDateRangeAssignment() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      api('/api/hr/shifts/date-range/', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shiftDateRange'] });
      queryClient.invalidateQueries({ queryKey: ['resolvedShifts'] });
      queryClient.invalidateQueries({ queryKey: ['shiftStatistics'] });
    },
  });
}

// Bulk shift assignment
export function useBulkShiftAssignment() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      employee_ids: string[];
      template_id: string;
      start_date: string;
      end_date?: string;
      assignment_type: 'OVERRIDE' | 'DATE_RANGE';
      reason?: string;
    }) =>
      api('/api/hr/shifts/bulk/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shiftOverrides'] });
      queryClient.invalidateQueries({ queryKey: ['shiftDateRange'] });
      queryClient.invalidateQueries({ queryKey: ['resolvedShifts'] });
      queryClient.invalidateQueries({ queryKey: ['shiftStatistics'] });
      queryClient.invalidateQueries({ queryKey: ['shiftHistory'] });
    },
  });
}

// Get shift change history
export function useShiftHistory(employeeId?: string, limit: number = 50, offset: number = 0) {
  const api = useApi();
  
  const params = new URLSearchParams();
  if (employeeId) params.append('employee_id', employeeId.toString());
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());
  
  return useQuery<ShiftHistoryResponse>({
    queryKey: ['shiftHistory', { employeeId, limit, offset }],
    queryFn: () => api(`/api/hr/shifts/history/?${params.toString()}`),
  });
}

// Get shift statistics
export function useShiftStatistics(date?: string) {
  const api = useApi();
  
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  
  return useQuery<ShiftStatistics>({
    queryKey: ['shiftStatistics', { date }],
    queryFn: () => api(`/api/hr/shifts/stats/?${params.toString()}`),
  });
}

// Generate shift schedule (for performance optimization)
export function useGenerateShiftSchedule() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { start_date: string; end_date: string }) =>
      api('/api/hr/shifts/generate-schedule/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resolvedShifts'] });
    },
  });
}