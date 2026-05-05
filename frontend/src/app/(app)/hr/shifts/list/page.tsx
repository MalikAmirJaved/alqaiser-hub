"use client";
// FILE: app/hr/shifts/list/page.tsx (ENHANCED WITH DATE RANGE & HISTORY)

import { useState, useEffect, useMemo } from "react";
import { ls, uid } from "@/services/localStorageService";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  CalendarDays, ListFilter, Search, Settings, UserPlus, X, 
  ChevronLeft, ChevronRight, Clock, Users as UsersIcon, 
  Calendar, Plus, Eye, FileText, AlertCircle, CheckCircle2,
  Trash2, Edit, CalendarRange, Filter, RefreshCw, History,
  Clock as ClockIcon, AlertTriangle, Check, ChevronDown
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, parseISO, eachDayOfInterval as eachDay } from "date-fns";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { DateRangePickerRac } from "@/components/reuseable/DateRangePickerRac";

// Types
interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: string;
  description: string;
  is_active: boolean;
}

interface ShiftAssignment {
  id: string;
  templateId: string;
  employeeIds: string[];
  date: string;
  notes: string;
}

interface EmployeeDefaultShift {
  id: string;
  employee_id: string;
  template_id: string;
  effective_from: string;
  effective_to: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ShiftChangeHistory {
  id: string;
  employee_id: string;
  employee_name: string;
  change_type: "DEFAULT_CHANGE" | "TEMPORARY_OVERRIDE" | "DATE_RANGE_ASSIGNMENT";
  from_template_id: string;
  from_template_name: string;
  to_template_id: string;
  to_template_name: string;
  effective_from: string;
  effective_to: string | null;
  reason: string;
  changed_by: string;
  changed_by_name: string;
  changed_at: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string;
  employment_status: string;
  default_shift_id?: string;
}

function resolveShiftForDate(
  employeeId: string,
  dateStr: string,
  assignments: ShiftAssignment[],
  defaultShifts: EmployeeDefaultShift[],
  templates: ShiftTemplate[],
  employeeDefaultShiftId?: string
): { template: ShiftTemplate | null; isOverride: boolean } {
  
  const override = assignments.find(
    (a) => a.employeeIds.includes(employeeId) && a.date === dateStr
  );
  if (override) {
    return {
      template: templates.find((t) => t.id === override.templateId) || null,
      isOverride: true,
    };
  }

  const activeDefaults = defaultShifts.filter(
    (d) =>
      d.employee_id === employeeId &&
      d.effective_from <= dateStr &&
      (d.effective_to === null || d.effective_to >= dateStr)
  );
  
  if (activeDefaults.length > 0) {
    activeDefaults.sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    return {
      template: templates.find((t) => t.id === activeDefaults[0].template_id) || null,
      isOverride: false,
    };
  }

  if (employeeDefaultShiftId) {
    const template = templates.find(t => t.id === employeeDefaultShiftId);
    if (template) {
      return { template, isOverride: false };
    }
  }

  return { template: null, isOverride: false };
}

export default function ShiftsManagementPage() {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [defaultShifts, setDefaultShifts] = useState<EmployeeDefaultShift[]>([]);
  const [shiftHistory, setShiftHistory] = useState<ShiftChangeHistory[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filters, setFilters] = useState({ 
    search: "", 
    templateId: "", 
    department: "",
  });
  
  // Modal states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDefaultModal, setShowDefaultModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showShiftDetailModal, setShowShiftDetailModal] = useState<{ date: string; template: ShiftTemplate } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [scheduleFormData, setScheduleFormData] = useState({
    template_id: "",
    date_range: { start: "", end: "" },
    reason: "",
    change_type: "TEMPORARY_OVERRIDE" as "TEMPORARY_OVERRIDE" | "DATE_RANGE_ASSIGNMENT"
  });
  const [defaultFormData, setDefaultFormData] = useState({ 
    template_id: "", 
    effective_from: "", 
    effective_to: "" 
  });

  const [loading, setLoading] = useState(true);
  const currentUser = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem("clickmasters_session") || localStorage.getItem("clickmasters_bos__session") || "null") : null;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setTemplates(ls.get<ShiftTemplate[]>("shifts_templates", []) || []);
    setAssignments(ls.get<ShiftAssignment[]>("shifts_assignments", []) || []);
    setDefaultShifts(ls.get<EmployeeDefaultShift[]>("employee_default_shifts", []) || []);
    setShiftHistory(ls.get<ShiftChangeHistory[]>("shift_change_history", []) || []);
    const allEmployees = ls.get<any[]>("employees", []) || [];
    const activeEmployees = allEmployees.filter((e: any) => e.employment_status === "ACTIVE");
    setEmployees(activeEmployees);
    setLoading(false);
  };

  const addToHistory = (
    employeeId: string,
    employeeName: string,
    changeType: ShiftChangeHistory["change_type"],
    fromTemplateId: string,
    fromTemplateName: string,
    toTemplateId: string,
    toTemplateName: string,
    effectiveFrom: string,
    effectiveTo: string | null,
    reason: string
  ) => {
    const historyEntry: ShiftChangeHistory = {
      id: uid("sch"),
      employee_id: employeeId,
      employee_name: employeeName,
      change_type: changeType,
      from_template_id: fromTemplateId,
      from_template_name: fromTemplateName,
      to_template_id: toTemplateId,
      to_template_name: toTemplateName,
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
      reason: reason,
      changed_by: currentUser?.id || "system",
      changed_by_name: currentUser?.name || "System",
      changed_at: new Date().toISOString(),
    };
    
    const updatedHistory = [historyEntry, ...shiftHistory];
    setShiftHistory(updatedHistory);
    ls.set("shift_change_history", updatedHistory);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const fullName = `${e.first_name} ${e.last_name}`.toLowerCase();
      const matchesSearch = fullName.includes(filters.search.toLowerCase()) || 
                           e.department?.toLowerCase().includes(filters.search.toLowerCase());
      const matchesDepartment = !filters.department || e.department === filters.department;
      return matchesSearch && matchesDepartment;
    });
  }, [employees, filters.search, filters.department]);

  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return Array.from(depts);
  }, [employees]);

  const resolvedShifts = useMemo(() => {
    const result: Record<string, Record<string, { template: ShiftTemplate | null; isOverride: boolean }>> = {};
    
    days.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      result[dateStr] = {};
      
      filteredEmployees.forEach(emp => {
        result[dateStr][emp.id] = resolveShiftForDate(
          emp.id, 
          dateStr, 
          assignments, 
          defaultShifts, 
          templates,
          emp.default_shift_id
        );
      });
    });
    
    return result;
  }, [days, filteredEmployees, assignments, defaultShifts, templates]);

  const getEmployeesForShift = (dateStr: string, templateId: string) => {
    return filteredEmployees.filter(emp => {
      const resolved = resolvedShifts[dateStr]?.[emp.id]?.template;
      return resolved?.id === templateId;
    });
  };

  const getShiftsOnDate = (dateStr: string) => {
    const shiftsMap = new Map<string, ShiftTemplate>();
    
    filteredEmployees.forEach(emp => {
      const resolved = resolvedShifts[dateStr]?.[emp.id]?.template;
      if (resolved && !shiftsMap.has(resolved.id)) {
        shiftsMap.set(resolved.id, resolved);
      }
    });
    
    return Array.from(shiftsMap.values());
  };

  // Handle date range scheduling
  const handleDateRangeSchedule = () => {
    if (!scheduleFormData.template_id) {
      alert("Please select a shift template");
      return;
    }
    if (selectedEmployees.length === 0) {
      alert("Please select at least one employee");
      return;
    }
    if (!scheduleFormData.date_range.start) {
      alert("Please select a start date");
      return;
    }

    const startDate = scheduleFormData.date_range.start;
    const endDate = scheduleFormData.date_range.end || scheduleFormData.date_range.start;
    
    // Generate all dates in range
    const datesToAssign = eachDay({
      start: parseISO(startDate),
      end: parseISO(endDate)
    }).map(d => format(d, "yyyy-MM-dd"));

    const template = templates.find(t => t.id === scheduleFormData.template_id);
    if (!template) return;

    const newAssignments: ShiftAssignment[] = [];
    
    for (const date of datesToAssign) {
      // Remove existing assignments for these employees on this date
      let updatedAssignments = [...assignments];
      
      const existingForDate = assignments.filter(a => 
        a.date === date && 
        a.employeeIds.some(id => selectedEmployees.includes(id))
      );
      
      existingForDate.forEach(existing => {
        const updatedEmployeeIds = existing.employeeIds.filter(
          id => !selectedEmployees.includes(id)
        );
        
        if (updatedEmployeeIds.length > 0) {
          const idx = updatedAssignments.findIndex(a => a.id === existing.id);
          if (idx >= 0) {
            updatedAssignments[idx] = { ...existing, employeeIds: updatedEmployeeIds };
          }
        } else {
          updatedAssignments = updatedAssignments.filter(a => a.id !== existing.id);
        }
      });
      
      // Check if there's an existing assignment with the same template
      const existingSameTemplate = updatedAssignments.find(a => 
        a.date === date && a.templateId === scheduleFormData.template_id
      );
      
      if (existingSameTemplate) {
        const mergedIds = [...new Set([...existingSameTemplate.employeeIds, ...selectedEmployees])];
        existingSameTemplate.employeeIds = mergedIds;
      } else {
        newAssignments.push({
          id: uid("shift_asgn"),
          templateId: scheduleFormData.template_id,
          employeeIds: [...selectedEmployees],
          date: date,
          notes: scheduleFormData.reason || `Scheduled for ${datesToAssign.length} day(s)`
        });
      }
    }
    
    const allAssignments = [...assignments, ...newAssignments];
    setAssignments(allAssignments);
    ls.set("shifts_assignments", allAssignments);
    
    // Add to history for each employee
    for (const employeeId of selectedEmployees) {
      const employee = employees.find(e => e.id === employeeId);
      if (employee) {
        // Get current shift before change
        const currentShift = resolveShiftForDate(
          employeeId, 
          startDate, 
          assignments, 
          defaultShifts, 
          templates,
          employee.default_shift_id
        );
        
        addToHistory(
          employeeId,
          `${employee.first_name} ${employee.last_name}`,
          scheduleFormData.change_type,
          currentShift.template?.id || "",
          currentShift.template?.name || "None",
          template.id,
          template.name,
          startDate,
          endDate !== startDate ? endDate : null,
          scheduleFormData.reason || `Scheduled for ${datesToAssign.length} day(s)`
        );
      }
    }
    
    setShowScheduleModal(false);
    setScheduleFormData({ template_id: "", date_range: { start: "", end: "" }, reason: "", change_type: "TEMPORARY_OVERRIDE" });
    setSelectedEmployees([]);
    alert(`Successfully scheduled ${selectedEmployees.length} employee(s) for ${datesToAssign.length} day(s)`);
  };

  // Handle save default shift (with history tracking)
  const handleSaveDefaultShift = () => {
    if (!selectedEmployee || !defaultFormData.template_id || !defaultFormData.effective_from) {
      alert("Template & Start Date are required");
      return;
    }
    
    const template = templates.find(t => t.id === defaultFormData.template_id);
    if (!template) return;
    
    // Get current default shift
    const currentDefault = defaultShifts.find(d => 
      d.employee_id === selectedEmployee.id && 
      d.effective_to === null
    );
    const currentTemplate = currentDefault 
      ? templates.find(t => t.id === currentDefault.template_id)
      : null;
    
    // Close previous open-ended default for this employee
    const updatedDefaults = defaultShifts.map(d => 
      d.employee_id === selectedEmployee.id && d.effective_to === null 
        ? { ...d, effective_to: new Date(new Date(defaultFormData.effective_from).getTime() - 86400000).toISOString().split("T")[0] } 
        : d
    );
    
    // Check if we're updating an existing default
    const existingIndex = updatedDefaults.findIndex(d => 
      d.employee_id === selectedEmployee.id && d.effective_from === defaultFormData.effective_from
    );
    
    if (existingIndex >= 0) {
      updatedDefaults[existingIndex] = {
        ...updatedDefaults[existingIndex],
        template_id: defaultFormData.template_id,
        effective_to: defaultFormData.effective_to || null
      };
    } else {
      updatedDefaults.push({
        id: uid("eds"),
        employee_id: selectedEmployee.id,
        template_id: defaultFormData.template_id,
        effective_from: defaultFormData.effective_from,
        effective_to: defaultFormData.effective_to || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    
    setDefaultShifts(updatedDefaults);
    ls.set("employee_default_shifts", updatedDefaults);
    
    // Add to history
    addToHistory(
      selectedEmployee.id,
      `${selectedEmployee.first_name} ${selectedEmployee.last_name}`,
      "DEFAULT_CHANGE",
      currentTemplate?.id || "",
      currentTemplate?.name || "None",
      template.id,
      template.name,
      defaultFormData.effective_from,
      defaultFormData.effective_to || null,
      "Default shift change"
    );
    
    setShowDefaultModal(false);
    alert("Default shift saved successfully");
  };

  const handleDeleteAssignment = (assignmentId: string) => {
    if (confirm("Remove this shift assignment?")) {
      const updated = assignments.filter(a => a.id !== assignmentId);
      setAssignments(updated);
      ls.set("shifts_assignments", updated);
    }
  };

  const handleClearDateAssignments = (dateStr: string, employeeId?: string) => {
    let updated = [...assignments];
    
    if (employeeId) {
      updated = assignments.map(a => {
        if (a.date === dateStr && a.employeeIds.includes(employeeId)) {
          return { ...a, employeeIds: a.employeeIds.filter(id => id !== employeeId) };
        }
        return a;
      }).filter(a => a.employeeIds.length > 0);
    } else {
      updated = assignments.filter(a => a.date !== dateStr);
    }
    
    setAssignments(updated);
    ls.set("shifts_assignments", updated);
  };

  const getActiveDefault = (employeeId: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    return defaultShifts.find(d => 
      d.employee_id === employeeId && 
      d.effective_from <= today && 
      (d.effective_to === null || d.effective_to >= today)
    );
  };

  const getEmployeeHistory = (employeeId: string) => {
    return shiftHistory.filter(h => h.employee_id === employeeId).sort((a, b) => 
      new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading shift data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Shift Management" 
        subtitle="Manage employee schedules, defaults, date ranges, and track change history"
        actions={
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setShowHistoryModal(true)}
            >
              <History className="w-4 h-4 mr-2" /> Change History
            </Button>
            <Button onClick={() => {
              setSelectedEmployees([]);
              setScheduleFormData({ template_id: "", date_range: { start: "", end: "" }, reason: "", change_type: "TEMPORARY_OVERRIDE" });
              setShowScheduleModal(true);
            }}>
              <CalendarRange className="w-4 h-4 mr-2" /> Schedule Shift
            </Button>
          </div>
        }
      />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/40 mb-4">
          <TabsTrigger value="calendar"><CalendarDays className="w-4 h-4 mr-2"/> Calendar View</TabsTrigger>
          <TabsTrigger value="list"><ListFilter className="w-4 h-4 mr-2"/> Employee List</TabsTrigger>
        </TabsList>

        {/* CALENDAR VIEW */}
        <TabsContent value="calendar" className="m-0 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  value={filters.search} 
                  onChange={(e) => setFilters({...filters, search: e.target.value})} 
                  placeholder="Search employees by name or department..." 
                  className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" 
                />
              </div>
              
              <SearchableSelect 
                value={filters.department} 
                onChange={(v) => setFilters({...filters, department: v})} 
                options={departments.map(d => ({value: d, label: d}))} 
                placeholder="All Departments"
                className="min-w-[150px]"
              />
              
              <SearchableSelect 
                value={filters.templateId} 
                onChange={(v) => setFilters({...filters, templateId: v})} 
                options={templates.filter(t=>t.is_active).map(t => ({value: t.id, label: t.name}))} 
                placeholder="Filter by Shift"
                className="min-w-[150px]"
              />
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-lg capitalize">{format(currentMonth, "MMMM yyyy")}</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="w-4 h-4"/>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                    Today
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="w-4 h-4"/>
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {filteredEmployees.length} employees • {templates.length} shift templates
              </div>
            </div>

            <div className="grid grid-cols-7 bg-muted/20 rounded-t-xl">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} className="py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 divide-x divide-border border-x border-b rounded-b-xl">
              {days.map((day, i) => {
                const dayStr = format(day, "yyyy-MM-dd");
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isTod = isToday(day);
                const shiftsOnDay = getShiftsOnDate(dayStr);
                const filteredShifts = filters.templateId 
                  ? shiftsOnDay.filter(s => s.id === filters.templateId)
                  : shiftsOnDay;
                
                return (
                  <div 
                    key={i} 
                    className={`min-h-[140px] p-2 hover:bg-muted/10 transition-colors cursor-pointer ${!isCurrentMonth ? "bg-muted/5" : ""} ${isTod ? "bg-primary/5 border-2 border-primary/20" : ""}`}
                    onClick={() => {
                      setSelectedEmployees([]);
                      setScheduleFormData({ 
                        ...scheduleFormData, 
                        date_range: { start: dayStr, end: dayStr },
                        change_type: "TEMPORARY_OVERRIDE"
                      });
                      setShowScheduleModal(true);
                    }}
                  >
                    <div className={`text-xs font-medium mb-2 flex items-center justify-between`}>
                      <span className={isTod ? "bg-primary text-primary-foreground w-6 h-6 rounded-full grid place-items-center" : "text-muted-foreground"}>
                        {format(day, "d")}
                      </span>
                      {shiftsOnDay.length > 0 && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                          {shiftsOnDay.length} shift{shiftsOnDay.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-1.5">
                      {filteredShifts.map(tpl => {
                        const employeesOnShift = getEmployeesForShift(dayStr, tpl.id);
                        if (employeesOnShift.length === 0) return null;
                        
                        return (
                          <div 
                            key={tpl.id} 
                            className="text-[11px] px-2 py-1 rounded cursor-pointer transition-transform hover:scale-[1.02] shadow-sm"
                            style={{ backgroundColor: `${tpl.color}20`, borderLeft: `3px solid ${tpl.color}` }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowShiftDetailModal({ date: dayStr, template: tpl });
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium truncate" style={{ color: tpl.color }}>
                                {tpl.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {employeesOnShift.length}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* EMPLOYEE LIST VIEW */}
        <TabsContent value="list" className="m-0 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                value={filters.search} 
                onChange={(e) => setFilters({...filters, search: e.target.value})} 
                placeholder="Search employees..." 
                className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" 
              />
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Employee</th>
                    <th className="text-left px-4 py-3">Department</th>
                    <th className="text-left px-4 py-3">Current Shift</th>
                    <th className="text-left px-4 py-3">Effective From</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => {
                    const today = format(new Date(), "yyyy-MM-dd");
                    const resolved = resolvedShifts[today]?.[emp.id];
                    const activeDefault = getActiveDefault(emp.id);
                    const hasOverride = assignments.some(a => 
                      a.date === today && a.employeeIds.includes(emp.id)
                    );
                    const historyCount = getEmployeeHistory(emp.id).length;
                    
                    return (
                      <tr key={emp.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">
                          {emp.first_name} {emp.last_name}
                          {hasOverride && (
                            <span className="ml-2 text-[10px] bg-warning/20 text-warning px-1.5 py-0.5 rounded-full">Override Today</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{emp.department || "—"}</td>
                        <td className="px-4 py-3">
                          {resolved?.template ? (
                            <div className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs" style={{ backgroundColor: `${resolved.template.color}20`, color: resolved.template.color }}>
                              <Clock className="w-3 h-3" /> 
                              {resolved.template.name}
                              {resolved.isOverride && (
                                <span className="bg-warning/20 text-warning px-1.5 rounded ml-1 text-[10px]">Override</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">No shift assigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {activeDefault?.effective_from 
                            ? format(parseISO(activeDefault.effective_from), "MMM d, yyyy")
                            : emp.default_shift_id ? "From hire date" : "—"}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {!activeDefault?.effective_from && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => { 
                              setSelectedEmployee(emp); 
                              setDefaultFormData({ 
                                template_id: activeDefault?.template_id || emp.default_shift_id || "", 
                                effective_from: activeDefault?.effective_from || format(new Date(), "yyyy-MM-dd"), 
                                effective_to: "" 
                              }); 
                              setShowDefaultModal(true); 
                            }}
                          >
                            <Settings className="w-3.5 h-3.5 mr-1.5"/> Set Default
                          </Button>
                          )}
                          
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedEmployees([emp.id]);
                              setScheduleFormData({
                                template_id: "",
                                date_range: { start: format(new Date(), "yyyy-MM-dd"), end: "" },
                                reason: "",
                                change_type: "TEMPORARY_OVERRIDE"
                              });
                              setShowScheduleModal(true);
                            }}
                          >
                            <Calendar className="w-3.5 h-3.5 mr-1.5"/> Schedule
                          </Button>

                          {historyCount > 0 && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setSelectedEmployee(emp);
                                setShowHistoryModal(true);
                              }}
                            >
                              <History className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {filteredEmployees.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No employees found matching your filters</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* SCHEDULE MODAL WITH DATE RANGE */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-border flex justify-between items-center sticky top-0 bg-card">
              <h2 className="font-semibold flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-primary" /> Schedule Shift
              </h2>
              <button onClick={() => setShowScheduleModal(false)} className="p-1.5 hover:bg-muted rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Select Employees *</label>
                <div className="bg-muted/40 border border-border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
                  {filteredEmployees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 p-1.5 hover:bg-muted/30 rounded cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedEmployees.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployees([...selectedEmployees, emp.id]);
                          } else {
                            setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                          }
                        }}
                        className="rounded border-border"
                      />
                      <span className="text-sm">{emp.first_name} {emp.last_name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{emp.department}</span>
                    </label>
                  ))}
                </div>
                {selectedEmployees.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedEmployees.length} employee(s) selected</p>
                )}
              </div>

              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Shift Template *</span>
                <SearchableSelect 
                  value={scheduleFormData.template_id} 
                  onChange={(v) => setScheduleFormData({...scheduleFormData, template_id: v})} 
                  options={templates.filter(t => t.is_active).map(t => ({value: t.id, label: `${t.name} (${t.startTime} - ${t.endTime})`}))} 
                  placeholder="Select shift template"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Start Date *</span>
                  <input 
                    type="date" 
                    value={scheduleFormData.date_range.start} 
                    onChange={(e) => setScheduleFormData({
                      ...scheduleFormData, 
                      date_range: { ...scheduleFormData.date_range, start: e.target.value }
                    })} 
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" 
                  />
                </label>
                
                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">End Date (Optional)</span>
                  <input 
                    type="date" 
                    value={scheduleFormData.date_range.end} 
                    onChange={(e) => setScheduleFormData({
                      ...scheduleFormData, 
                      date_range: { ...scheduleFormData.date_range, end: e.target.value }
                    })} 
                    className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" 
                  />
                </label>
              </div>

              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Schedule Type</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      checked={scheduleFormData.change_type === "TEMPORARY_OVERRIDE"}
                      onChange={() => setScheduleFormData({...scheduleFormData, change_type: "TEMPORARY_OVERRIDE"})}
                      className="rounded border-border"
                    />
                    <span className="text-sm">Temporary Override</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      checked={scheduleFormData.change_type === "DATE_RANGE_ASSIGNMENT"}
                      onChange={() => setScheduleFormData({...scheduleFormData, change_type: "DATE_RANGE_ASSIGNMENT"})}
                      className="rounded border-border"
                    />
                    <span className="text-sm">Date Range Assignment</span>
                  </label>
                </div>
              </label>

              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Reason / Notes</span>
                <textarea 
                  value={scheduleFormData.reason} 
                  onChange={(e) => setScheduleFormData({...scheduleFormData, reason: e.target.value})} 
                  rows={2} 
                  className="bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring resize-none" 
                  placeholder="Why is this schedule being assigned?"
                />
              </label>
            </div>
            
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
              <Button onClick={handleDateRangeSchedule}>
                {scheduleFormData.date_range.end ? "Schedule Range" : "Schedule"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SHIFT DETAIL MODAL */}
      {showShiftDetailModal && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-md">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: showShiftDetailModal.template.color }} />
                <h2 className="font-semibold">{showShiftDetailModal.template.name}</h2>
              </div>
              <button onClick={() => setShowShiftDetailModal(null)} className="p-1.5 hover:bg-muted rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="bg-muted/40 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Date</div>
                <div className="font-medium">
                  {format(parseISO(showShiftDetailModal.date), "EEEE, MMMM d, yyyy")}
                </div>
              </div>
              
              <div className="bg-muted/40 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Shift Timing</div>
                <div className="font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {showShiftDetailModal.template.startTime} - {showShiftDetailModal.template.endTime}
                  {showShiftDetailModal.template.breakMinutes > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({showShiftDetailModal.template.breakMinutes} min break)
                    </span>
                  )}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
                  <span>Employees on this shift</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Remove all employees from this shift on ${showShiftDetailModal.date}?`)) {
                        handleClearDateAssignments(showShiftDetailModal.date);
                        setShowShiftDetailModal(null);
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Clear All
                  </Button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {getEmployeesForShift(showShiftDetailModal.date, showShiftDetailModal.template.id).map(emp => {
                    const isOverride = resolvedShifts[showShiftDetailModal.date]?.[emp.id]?.isOverride;
                    return (
                      <div key={emp.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                        <div>
                          <div className="font-medium text-sm">
                            {emp.first_name} {emp.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">{emp.department}</div>
                        </div>
                        <div className="flex gap-1">
                          {isOverride && (
                            <span className="text-[10px] bg-warning/20 text-warning px-1.5 py-0.5 rounded-full">Override</span>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Remove ${emp.first_name} ${emp.last_name} from this shift?`)) {
                                handleClearDateAssignments(showShiftDetailModal.date, emp.id);
                                setShowShiftDetailModal(null);
                              }
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {getEmployeesForShift(showShiftDetailModal.date, showShiftDetailModal.template.id).length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No employees assigned to this shift on this date
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowShiftDetailModal(null)}>Close</Button>
              <Button 
                onClick={() => {
                  setShowShiftDetailModal(null);
                  setSelectedEmployees([]);
                  setScheduleFormData({
                    template_id: showShiftDetailModal.template.id,
                    date_range: { start: showShiftDetailModal.date, end: "" },
                    reason: "",
                    change_type: "TEMPORARY_OVERRIDE"
                  });
                  setShowScheduleModal(true);
                }}
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Employees
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DEFAULT SHIFT MODAL */}
      {showDefaultModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-md">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="font-semibold flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary"/> Change Default Shift
              </h2>
              <button onClick={() => setShowDefaultModal(false)} className="p-1.5 hover:bg-muted rounded">
                <X className="w-4 h-4"/>
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              <div className="bg-muted/40 rounded-lg p-3 text-sm">
                <div className="text-xs text-muted-foreground">Employee</div>
                <div className="font-medium">{selectedEmployee.first_name} {selectedEmployee.last_name}</div>
                <div className="text-xs text-muted-foreground mt-1">{selectedEmployee.department}</div>
              </div>
              
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">New Shift Template *</span>
                <SearchableSelect 
                  value={defaultFormData.template_id} 
                  onChange={(v) => setDefaultFormData({...defaultFormData, template_id: v})} 
                  options={templates.filter(t=>t.is_active).map(t => ({value: t.id, label: `${t.name} (${t.startTime}-${t.endTime})`}))} 
                  placeholder="Select shift template"
                />
              </label>
              
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Effective From *</span>
                <input 
                  type="date" 
                  value={defaultFormData.effective_from} 
                  onChange={(e) => setDefaultFormData({...defaultFormData, effective_from: e.target.value})} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" 
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  This shift will start from this date
                </p>
              </label>
              
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Effective To (Optional)</span>
                <input 
                  type="date" 
                  value={defaultFormData.effective_to} 
                  onChange={(e) => setDefaultFormData({...defaultFormData, effective_to: e.target.value || ""})} 
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" 
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Leave empty for ongoing assignment
                </p>
              </label>
            </div>
            
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDefaultModal(false)}>Cancel</Button>
              <Button onClick={handleSaveDefaultShift}>Save Default Shift</Button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-border flex justify-between items-center sticky top-0 bg-card">
              <h2 className="font-semibold flex items-center gap-2">
                <History className="w-4 h-4 text-primary"/> Shift Change History
                {selectedEmployee && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </span>
                )}
              </h2>
              <button onClick={() => setShowHistoryModal(false)} className="p-1.5 hover:bg-muted rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4">
              {shiftHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No shift change history found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(selectedEmployee 
                    ? getEmployeeHistory(selectedEmployee.id)
                    : shiftHistory
                  ).map(history => (
                    <div key={history.id} className="bg-muted/20 rounded-lg p-3 border-l-4" style={{ borderLeftColor: history.change_type === "DEFAULT_CHANGE" ? "#3b82f6" : history.change_type === "TEMPORARY_OVERRIDE" ? "#f59e0b" : "#10b981" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            history.change_type === "DEFAULT_CHANGE" 
                              ? "bg-blue-500/20 text-blue-400"
                              : history.change_type === "TEMPORARY_OVERRIDE"
                              ? "bg-orange-500/20 text-orange-400"
                              : "bg-green-500/20 text-green-400"
                          }`}>
                            {history.change_type.replace("_", " ")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(history.changed_at), "MMM d, yyyy h:mm a")}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          By: {history.changed_by_name}
                        </span>
                      </div>
                      
                      <div className="text-sm">
                        Changed from <span className="font-medium">{history.from_template_name || "None"}</span> 
                        {" → "}
                        <span className="font-medium text-primary">{history.to_template_name}</span>
                      </div>
                      
                      <div className="text-xs text-muted-foreground mt-1">
                        Effective: {format(parseISO(history.effective_from), "MMM d, yyyy")}
                        {history.effective_to && ` → ${format(parseISO(history.effective_to), "MMM d, yyyy")}`}
                      </div>
                      
                      {history.reason && (
                        <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/30 rounded">
                          📝 {history.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-border flex justify-end">
              <Button onClick={() => setShowHistoryModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}