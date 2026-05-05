export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: string;
  description: string;
  is_active: boolean;
}

export interface ShiftAssignment {
  id: string;
  templateId: string;
  employeeIds: string[];
  date: string; // YYYY-MM-DD
  notes: string;
}

export interface EmployeeDefaultShift {
  id: string;
  employee_id: string;
  template_id: string;
  effective_from: string; // YYYY-MM-DD
  effective_to: string | null; // YYYY-MM-DD
}

/**
 * Resolves which shift an employee works on a specific date.
 * Priority: 1. Exact Date Assignment -> 2. Active Default Shift -> 3. Null
 */
export function resolveShiftForDate(
  employeeId: string,
  dateStr: string,
  assignments: ShiftAssignment[],
  defaultShifts: EmployeeDefaultShift[],
  templates: ShiftTemplate[]
): { template: ShiftTemplate | null; isOverride: boolean } {
  // 1. Check exact override/assignment
  const override = assignments.find(
    (a) => a.employeeIds.includes(employeeId) && a.date === dateStr
  );
  if (override) {
    return {
      template: templates.find((t) => t.id === override.templateId) || null,
      isOverride: true,
    };
  }

  // 2. Check active default shift
  const activeDefaults = defaultShifts.filter(
    (d) =>
      d.employee_id === employeeId &&
      d.effective_from <= dateStr &&
      (d.effective_to === null || d.effective_to >= dateStr)
  );

  // Sort descending to get the most recent applicable rule
  activeDefaults.sort((a, b) => b.effective_from.localeCompare(a.effective_from));

  if (activeDefaults.length > 0) {
    return {
      template: templates.find((t) => t.id === activeDefaults[0].template_id) || null,
      isOverride: false,
    };
  }

  return { template: null, isOverride: false };
}