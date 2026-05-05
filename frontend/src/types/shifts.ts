// src/types/shifts.ts
export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  breakMinutes: number;
  color: string;     // Hex code for UI
  description: string;
  is_active: boolean;
}

export interface ShiftAssignment {
  id: string;
  templateId: string;
  employeeIds: string[]; // Array of employee IDs
  date: string; // YYYY-MM-DD
  notes: string;
}

export interface SchedulerRule {
  minEmployeesPerShift: number;
  maxHoursPerWeek: number;
  allowOvertime: boolean;
}

export interface EmployeeDefaultShift {
  id: string;
  employee_id: string;
  template_id: string;
  effective_from: string; // YYYY-MM-DD
  effective_to: string | null; // YYYY-MM-DD or null for open-ended
}