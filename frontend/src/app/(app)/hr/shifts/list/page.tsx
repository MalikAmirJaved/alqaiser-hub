"use client";
// FILE: app/hr/shifts/list/page.tsx (FIXED TYPESCRIPT VERSION)

import { useState, useMemo, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  CalendarDays, ListFilter, Search, Settings, UserPlus, X, 
  ChevronLeft, ChevronRight, Clock, Users as UsersIcon, 
  Calendar, Trash2, CalendarRange, RefreshCw, History,
  Loader2
} from "lucide-react";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { useServerSearch } from "@/hooks/useServerSearch";
import { toast } from "sonner";

// Import hooks
import { useEmployees, useUpdateEmployee, type Employee } from "@/hooks/useEmployees";
import { useShiftTemplates, type ShiftTemplate } from "@/hooks/useShiftTemplates";
import { 
  useResolvedShifts, 
  useShiftOverrides,
  useCreateShiftOverride,
  useDeleteShiftOverride,
  useBulkShiftAssignment,
  useShiftHistory,
  useShiftStatistics,
  useGenerateShiftSchedule,
  type ResolvedShiftsResponse
} from "@/hooks/useShiftManagement";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

interface ShiftChangeHistory {
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
}

export default function ShiftsManagementPage() {
  const permissions = useFeaturePermissions("HR", "shift_override");
  const queryClient = useQueryClient();
  
  // State
  const [activeTab, setActiveTab] = useState("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filters, setFilters] = useState({ 
    search: "", 
    templateId: "", 
    department: "",
    designation: "",
  });
  
  // Modal states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showShiftDetailModal, setShowShiftDetailModal] = useState<{ date: string; template: ShiftTemplate } | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [scheduleFormData, setScheduleFormData] = useState({
    template_id: "",
    date_range: { start: "", end: "" },
    reason: "",
    assignment_type: "OVERRIDE" as "OVERRIDE" | "DATE_RANGE"
  });
  const [historyPage, setHistoryPage] = useState(0);
  const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<Employee | null>(null);
  const [setDefaultModal, setSetDefaultModal] = useState<{ employee: Employee; templateId: string } | null>(null);
  const [listPage, setListPage] = useState(1);
  const listPageSize = 20;

  const { data: templates = [], isLoading: templatesLoading } = useShiftTemplates();

  // Server-side search for dropdowns (shared across tabs)
  const fetchEmployees = useServerSearch("/api/hr/employees/", {
    extraParams: { employment_status: "ACTIVE" },
    transformOption: (e: any) => ({
      value: e.id,
      label: `${e.first_name} ${e.last_name || ""} (${e.department_name || ""})`,
    }),
  });

  const fetchShiftTemplates = useServerSearch("/api/hr/shift-templates/", {
    transformOption: (t: any) => ({
      value: t.id,
      label: `${t.name} (${t.start_time || ""} - ${t.end_time || ""})`,
    }),
  });

  const fetchDesignations = useServerSearch("/api/company/designations/", {
    transformOption: (d: any) => ({
      value: d._id || d.id,
      label: d.name,
    }),
  });

  const fetchDepartments = useServerSearch("/api/organization/departments/", {
    transformOption: (d: any) => ({ value: d._id || d.id, label: d.name }),
  });

  // ─── CALENDAR TAB DATA ────────────────────────────────────────
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // For calendar: fetch resolved shifts WITHOUT employee IDs → backend returns ALL employees
  const { 
    data: resolvedShiftsData, 
    isLoading: shiftsLoading,
    refetch: refetchShifts 
  } = useResolvedShifts(
    [],
    undefined,
    activeTab === "calendar" ? format(monthStart, "yyyy-MM-dd") : undefined,
    activeTab === "calendar" ? format(monthEnd, "yyyy-MM-dd") : undefined
  );

  // Extract employee list from resolvedShiftsData (has names + departments)
  const calendarEmployees = useMemo(() => {
    if (!resolvedShiftsData) return [];
    return Object.entries(resolvedShiftsData).map(([id, data]) => ({
      id,
      first_name: data.employee_name?.split(' ')[0] || '',
      last_name: data.employee_name?.split(' ').slice(1).join(' ') || '',
      department_name: data.employee_department || '',
    }));
  }, [resolvedShiftsData]);

  // Calendar employee filter (client-side for search/department)
  const filteredCalendarEmployees = useMemo(() => {
    return calendarEmployees.filter(e => {
      const fullName = `${e.first_name} ${e.last_name || ''}`.toLowerCase();
      const matchesSearch = fullName.includes(filters.search.toLowerCase()) || 
                           e.department_name?.toLowerCase().includes(filters.search.toLowerCase());
      const matchesDepartment = !filters.department || e.department_name === filters.department;
      return matchesSearch && matchesDepartment;
    });
  }, [calendarEmployees, filters.search, filters.department]);

  // Departments from calendar data
  const calendarDepartments = useMemo(() => {
    const depts = new Set(calendarEmployees.map(e => e.department_name).filter((d): d is string => !!d));
    return Array.from(depts);
  }, [calendarEmployees]);

  // ─── LIST TAB DATA ────────────────────────────────────────────
  const listFilters = useMemo(() => {
    const params: Record<string, string> = {
      page: String(listPage),
      page_size: String(listPageSize),
      employment_status: "ACTIVE",
    };
    if (filters.department) params.department_id = filters.department;
    if (filters.designation) params.designation_id = filters.designation;
    if (filters.search) params.search = filters.search;
    return params;
  }, [filters, listPage]);

  const { data: listEmployees = [], totalCount: listTotalCount, isLoading: listLoading } = useEmployees(
    activeTab === "list" ? listFilters : undefined,
    { enabled: activeTab === "list" }
  );

  // Today's resolved shifts for list view
  const today = format(new Date(), "yyyy-MM-dd");
  const listEmployeeIds = useMemo(() => listEmployees.map(e => e.id), [listEmployees]);

  const { data: listResolvedShiftsData } = useResolvedShifts(
    activeTab === "list" ? listEmployeeIds : [],
    activeTab === "list" ? today : undefined
  );

  // ─── SHARED DATA ──────────────────────────────────────────────
  // Query shift overrides
  const { data: overrides = [], refetch: refetchOverrides } = useShiftOverrides(
    undefined,
    format(monthStart, "yyyy-MM-dd"),
    format(monthEnd, "yyyy-MM-dd")
  );
  
  // Query shift statistics
  const { data: statistics, refetch: refetchStatistics } = useShiftStatistics(format(new Date(), "yyyy-MM-dd"));
  
  // Query shift history
  const { 
    data: historyData, 
    isLoading: historyLoading,
    refetch: refetchHistory 
  } = useShiftHistory(
    selectedEmployeeForHistory?.id,
    50,
    historyPage * 50
  );
  
  // Mutations
  const createOverride = useCreateShiftOverride();
  const deleteOverride = useDeleteShiftOverride();
  const bulkAssign = useBulkShiftAssignment();
  const generateSchedule = useGenerateShiftSchedule();
  const updateEmployee = useUpdateEmployee();
  
  // Parse resolved shifts data (uses filterCalendarEmployees for calendar, listResolvedShiftsData for list)
  const resolvedShifts = useMemo(() => {
    const result: Record<string, Record<string, { template: ShiftTemplate | null; isOverride: boolean }>> = {};
    
    if (!resolvedShiftsData) return result;
    
    days.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      result[dateStr] = {};
      
      filteredCalendarEmployees.forEach(emp => {
        const empData = resolvedShiftsData[emp.id];
        
        if (empData && empData.shifts && empData.shifts[dateStr]) {
          const shiftData = empData.shifts[dateStr];
          const template = templates.find(t => t.id === shiftData.template_id);
          
          result[dateStr][emp.id] = {
            template: template || null,
            isOverride: shiftData.source_type !== 'DEFAULT'
          };
        } else {
          result[dateStr][emp.id] = { template: null, isOverride: false };
        }
      });
    });
    
    return result;
  }, [resolvedShiftsData, filteredCalendarEmployees, templates, days]);
  
  // Get employees for a specific shift on a date
  const getEmployeesForShift = useCallback((dateStr: string, templateId: string) => {
    if (!resolvedShifts[dateStr]) return [];
    
    return filteredCalendarEmployees.filter(emp => {
      const resolved = resolvedShifts[dateStr]?.[emp.id]?.template;
      return resolved?.id === templateId;
    });
  }, [resolvedShifts, filteredCalendarEmployees]);
  
  // Get shifts on a date
  const getShiftsOnDate = useCallback((dateStr: string) => {
    if (!resolvedShifts[dateStr]) return [];
    
    const shiftsMap = new Map<string, ShiftTemplate>();
    
    filteredCalendarEmployees.forEach(emp => {
      const resolved = resolvedShifts[dateStr]?.[emp.id]?.template;
      if (resolved && !shiftsMap.has(resolved.id)) {
        shiftsMap.set(resolved.id, resolved);
      }
    });
    
    return Array.from(shiftsMap.values());
  }, [resolvedShifts, filteredCalendarEmployees]);
  
  // Generate date range array helper
  const getDateRangeArray = (startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    let current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      dates.push(format(current, "yyyy-MM-dd"));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };
  
  // Handle schedule shift (single or date range)
  const handleScheduleShift = async () => {
    if (!scheduleFormData.template_id) {
      toast.error("Please select a shift template");
      return;
    }
    if (selectedEmployees.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }
    if (!scheduleFormData.date_range.start) {
      toast.error("Please select a start date");
      return;
    }
    
    const startDate = scheduleFormData.date_range.start;
    const endDate = scheduleFormData.date_range.end || scheduleFormData.date_range.start;
    const templateId = scheduleFormData.template_id;
    const template = templates.find(t => t.id === templateId);
    
    if (!template) return;
    
    try {
      if (scheduleFormData.assignment_type === "OVERRIDE") {
        const dates = getDateRangeArray(startDate, endDate);
        
        // Create overrides for each selected employee and each date
        for (const employeeId of selectedEmployees) {
          for (const dateStr of dates) {
            await createOverride.mutateAsync({
              employee_id: employeeId,
              template_id: templateId,
              date: dateStr,
              reason: scheduleFormData.reason
            });
          }
        }
        
      } else {
        // Create date range assignment
        await bulkAssign.mutateAsync({
          employee_ids: selectedEmployees,
          template_id: templateId,
          start_date: startDate,
          end_date: endDate,
          assignment_type: "DATE_RANGE",
          reason: scheduleFormData.reason
        });
      }
      
      // Refresh data
      refetchShifts();
      refetchOverrides();
      refetchStatistics();
      
      setShowScheduleModal(false);
      setScheduleFormData({ template_id: "", date_range: { start: "", end: "" }, reason: "", assignment_type: "OVERRIDE" });
      setSelectedEmployees([]);
    } catch (error: any) {
    }
  };
  
  // Handle delete override
  const handleDeleteAssignment = async (overrideId: string) => {
    if (!confirm("Remove this shift assignment?")) return;
    
    try {
      await deleteOverride.mutateAsync(overrideId);
      refetchShifts();
      refetchOverrides();
    } catch (error: any) {
    }
  };
  
  // Handle clear all assignments on a date
  const handleClearDateAssignments = async (dateStr: string, employeeId?: string) => {
    const overridesToDelete = overrides.filter(o => {
      if (employeeId) {
        return o.date === dateStr && o.employee_id === employeeId;
      }
      return o.date === dateStr;
    });
    
    if (overridesToDelete.length === 0) {
      toast.info("No assignments to remove");
      return;
    }
    
    if (!confirm(`Remove ${overridesToDelete.length} assignment(s) on ${dateStr}?`)) return;
    
    try {
      for (const override of overridesToDelete) {
        await deleteOverride.mutateAsync(override.id);
      }
      refetchShifts();
      refetchOverrides();
    } catch (error: any) {
    }
  };
  
  // Handle bulk generate schedule (for performance optimization)
  const handleGenerateSchedule = async () => {
    const startDate = format(monthStart, "yyyy-MM-dd");
    const endDate = format(monthEnd, "yyyy-MM-dd");
    
    try {
      await generateSchedule.mutateAsync({ start_date: startDate, end_date: endDate });
      refetchShifts();
    } catch (error: any) {
    }
  };
  
  // Handle set default shift
  const handleSetDefaultShift = async () => {
    if (!setDefaultModal) return;
    try {
      await updateEmployee.mutateAsync({
        id:setDefaultModal.employee.id,
        default_shift_id: setDefaultModal.templateId || undefined,
      });
      refetchShifts();
      setSetDefaultModal(null);
    } catch (error: any) {
    }
  };
  
  // Loading state
  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading shift data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Shift Management" 
        subtitle="Manage employee schedules, overrides, and track change history"
        actions={
          <div className="flex gap-2">
            {/* <Button 
              variant="outline"
              onClick={handleGenerateSchedule}
              disabled={generateSchedule.isPending}
            >
              {generateSchedule.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Generate Schedule
            </Button> */}
            <Button 
              variant="outline"
              onClick={() => {
                setSelectedEmployeeForHistory(null);
                setHistoryPage(0);
                setShowHistoryModal(true);
                refetchHistory();
              }}
            >
              <History className="w-4 h-4 mr-2" /> History
            </Button>
            {permissions.create && (
              <Button onClick={() => {
                setSelectedEmployees([]);
                setScheduleFormData({ template_id: "", date_range: { start: format(new Date(), "yyyy-MM-dd"), end: "" }, reason: "", assignment_type: "OVERRIDE" });
                setShowScheduleModal(true);
              }}>
                <CalendarRange className="w-4 h-4 mr-2" /> Schedule Shift
              </Button>
            )}
          </div>
        }
      />
      
      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-2xl font-bold">{statistics.total_employees}</p>
              </div>
              <UsersIcon className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">With Shift Today</p>
                <p className="text-2xl font-bold">{statistics.employees_with_shift || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overrides Today</p>
                <p className="text-2xl font-bold">{statistics.overrides_today || 0}</p>
              </div>
              <Calendar className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Templates</p>
                <p className="text-2xl font-bold">{templates.filter(t => t.is_active).length}</p>
              </div>
              <Settings className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </div>
        </div>
      )}
      
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
                options={calendarDepartments.map(d => ({value: d, label: d}))} 
                placeholder="All Departments"
                className="min-w-[150px]"
              />
              
              <SearchableSelect 
                value={filters.templateId} 
                onChange={(v) => setFilters({...filters, templateId: v})} 
                fetchOptions={fetchShiftTemplates}
                placeholder="Search shifts..."
                className="min-w-[150px]"
              />
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetchShifts()}
                disabled={shiftsLoading}
              >
                <RefreshCw className={`w-4 h-4 ${shiftsLoading ? 'animate-spin' : ''}`} />
              </Button>
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
                {filteredCalendarEmployees.length} employees • {templates.length} shift templates
              </div>
            </div>
            
            {shiftsLoading ? (
              <>
                <div className="grid grid-cols-7 bg-muted/20 rounded-t-xl">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                    <div key={day} className="py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 divide-x divide-border border-x border-b rounded-b-xl">
                  {days.map((_, i) => (
                    <div key={i} className="min-h-[140px] p-2">
                      <Skeleton className="w-6 h-6 rounded-full mb-2" />
                      <Skeleton className="h-5 w-full rounded mb-1" />
                      <Skeleton className="h-5 w-3/4 rounded" />
                      <Skeleton className="h-5 w-1/2 rounded mt-1" />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
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
                            assignment_type: "OVERRIDE"
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
                                style={{ backgroundColor: `#3b82f620`, borderLeft: `3px solid #3b82f6` }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowShiftDetailModal({ date: dayStr, template: tpl });
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium truncate">
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
              </>
            )}
          </div>
        </TabsContent>
        
        {/* EMPLOYEE LIST VIEW */}
        <TabsContent value="list" className="m-0 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  value={filters.search} 
                  onChange={(e) => { setFilters({...filters, search: e.target.value}); setListPage(1); }} 
                  placeholder="Search employees..." 
                  className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" 
                />
              </div>
              <SearchableSelect 
                value={filters.department || ""} 
                onChange={(v) => { setFilters({...filters, department: v, designation: ""}); setListPage(1); }} 
                fetchOptions={fetchDepartments}
                placeholder="All Departments"
                className="min-w-[150px]"
              />
              <SearchableSelect 
                value={filters.designation || ""} 
                onChange={(v) => { setFilters({...filters, designation: v}); setListPage(1); }} 
                fetchOptions={fetchDesignations}
                placeholder="All Designations"
                className="min-w-[150px]"
              />
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Employee</th>
                    <th className="text-left px-4 py-3">Department</th>
                    <th className="text-left px-4 py-3">Today's Shift</th>
                    <th className="text-left px-4 py-3">Effective From</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading ? (
                    <>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-5 w-28 rounded" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                          <td className="px-4 py-3 text-right"><Skeleton className="h-8 w-24 ml-auto rounded-md" /></td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    listEmployees.map(emp => {
                    const listResolved = listResolvedShiftsData?.[emp.id];
                    const resolved = listResolved ? { 
                      template: listResolved.shifts?.[today] ? templates.find(t => t.id === listResolved.shifts[today].template_id) || null : null,
                      isOverride: listResolved.shifts?.[today]?.source_type !== 'DEFAULT'
                    } : (resolvedShifts[today]?.[emp.id]);
                    const hasOverride = overrides.some(a => 
                      a.date === today && a.employee_id === emp.id
                    );
                    
                    return (
                      <tr key={emp.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">
                          {emp.first_name} {emp.last_name || ''}
                          {hasOverride && (
                            <span className="ml-2 text-[10px] bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded-full">Override Today</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{emp.department_name || "—"}</td>
                        <td className="px-4 py-3">
                          {resolved?.template ? (
                            <div className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs" style={{ backgroundColor: `#3b82f620` }}>
                              <Clock className="w-3 h-3" /> 
                              {resolved.template.name}
                              {resolved.isOverride && (
                                <span className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-1.5 rounded ml-1 text-[10px]">Override</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">No shift assigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {emp.default_shift_name ? "From hire date" : "—"}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSetDefaultModal({ employee: emp, templateId: emp.default_shift_id || "" });
                            }}
                          >
                            <Settings className="w-3.5 h-3.5 mr-1.5"/> Set Default
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedEmployees([emp.id]);
                              setScheduleFormData({
                                template_id: "",
                                date_range: { start: format(new Date(), "yyyy-MM-dd"), end: "" },
                                reason: "",
                                assignment_type: "OVERRIDE"
                              });
                              setShowScheduleModal(true);
                            }}
                          >
                            <Calendar className="w-3.5 h-3.5 mr-1.5"/> Schedule
                          </Button>
                          
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setSelectedEmployeeForHistory(emp);
                              setHistoryPage(0);
                              setShowHistoryModal(true);
                              refetchHistory();
                            }}
                          >
                            <History className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
              
              {!listLoading && listEmployees.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No employees found matching your filters</p>
                </div>
              )}
            </div>
            {(listTotalCount || 0) > listPageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
                <span>
                  {(listPage - 1) * listPageSize + 1}–{Math.min(listPage * listPageSize, listTotalCount || 0)} of {listTotalCount || 0}
                </span>
                <div className="flex items-center gap-2">
                  <span>Page {listPage} of {Math.max(1, Math.ceil((listTotalCount || 0) / listPageSize))}</span>
                  <button
                    onClick={() => setListPage(p => Math.max(1, p - 1))}
                    disabled={listPage <= 1}
                    className="p-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setListPage(p => p + 1)}
                    disabled={listPage >= Math.max(1, Math.ceil((listTotalCount || 0) / listPageSize))}
                    className="p-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* SCHEDULE MODAL */}
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
                  {(activeTab === "calendar" ? filteredCalendarEmployees : listEmployees).map(emp => (
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
                      <span className="text-sm">{emp.first_name} {emp.last_name || ''}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{emp.department_name}</span>
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
                  fetchOptions={fetchShiftTemplates}
                  placeholder="Search shift templates..."
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
                <span className="text-muted-foreground">Assignment Type</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      checked={scheduleFormData.assignment_type === "OVERRIDE"}
                      onChange={() => setScheduleFormData({...scheduleFormData, assignment_type: "OVERRIDE"})}
                      className="rounded border-border"
                    />
                    <span className="text-sm">Temporary Override</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      checked={scheduleFormData.assignment_type === "DATE_RANGE"}
                      onChange={() => setScheduleFormData({...scheduleFormData, assignment_type: "DATE_RANGE"})}
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
              <Button 
                onClick={handleScheduleShift} 
                disabled={createOverride.isPending || bulkAssign.isPending}
              >
                {(createOverride.isPending || bulkAssign.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
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
                <div className="w-3 h-3 rounded-full bg-primary" />
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
                  {permissions.delete && (
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
                  )}
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {getEmployeesForShift(showShiftDetailModal.date, showShiftDetailModal.template.id).map(emp => {
                    const isOverride = resolvedShifts[showShiftDetailModal.date]?.[emp.id]?.isOverride;
                    const overrideRecord = overrides.find(o => 
                      o.date === showShiftDetailModal.date && 
                      o.employee_id === emp.id
                    );
                    
                    return (
                      <div key={emp.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                        <div>
                          <div className="font-medium text-sm">
                            {emp.first_name} {emp.last_name || ''}
                          </div>
                          <div className="text-xs text-muted-foreground">{emp.department_name}</div>
                        </div>
                        <div className="flex gap-1">
                          {isOverride && (
                            <span className="text-[10px] bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded-full">Override</span>
                          )}
                          {permissions.delete && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`Remove ${emp.first_name} ${emp.last_name} from this shift?`)) {
                                  if (overrideRecord) {
                                    handleDeleteAssignment(overrideRecord.id);
                                  } else {
                                    handleClearDateAssignments(showShiftDetailModal.date, emp.id);
                                  }
                                  setShowShiftDetailModal(null);
                                }
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
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
              {permissions.create && (
                <Button 
                  onClick={() => {
                    setShowShiftDetailModal(null);
                    setSelectedEmployees([]);
                    setScheduleFormData({
                      template_id: showShiftDetailModal.template.id,
                      date_range: { start: showShiftDetailModal.date, end: "" },
                      reason: "",
                      assignment_type: "OVERRIDE"
                    });
                    setShowScheduleModal(true);
                  }}
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Employees
                </Button>
              )}
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
                <History className="w-4 h-4 text-primary"/> Shift History
                {selectedEmployeeForHistory && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {selectedEmployeeForHistory.first_name} {selectedEmployeeForHistory.last_name || ''}
                  </span>
                )}
              </h2>
              <button onClick={() => setShowHistoryModal(false)} className="p-1.5 hover:bg-muted rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : !historyData?.data?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No shift history found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData.data.map((history: ShiftChangeHistory) => (
                    <div 
                      key={history.id} 
                      className="bg-muted/20 rounded-lg p-3 border-l-4" 
                      style={{ 
                        borderLeftColor: history.change_type === "DEFAULT_CHANGE" 
                          ? "#3b82f6" 
                          : history.change_type === "TEMPORARY_OVERRIDE" 
                            ? "#f59e0b" 
                            : "#10b981" 
                      }}
                    >
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
              
              {historyData?.pagination && historyData.pagination.has_more && (
                <div className="flex justify-center mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setHistoryPage(historyPage + 1);
                      refetchHistory();
                    }}
                    disabled={historyLoading}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-border flex justify-end">
              <Button onClick={() => setShowHistoryModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
      {/* SET DEFAULT SHIFT MODAL */}
      {setDefaultModal && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-md">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="font-semibold flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> Set Default Shift
              </h2>
              <button onClick={() => setSetDefaultModal(null)} className="p-1.5 hover:bg-muted rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="bg-muted/40 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Employee</div>
                <div className="font-medium">
                  {setDefaultModal.employee.first_name} {setDefaultModal.employee.last_name || ''}
                </div>
                <div className="text-xs text-muted-foreground">{setDefaultModal.employee.department_name}</div>
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Select Default Shift Template</label>
                <SearchableSelect 
                  value={setDefaultModal.templateId} 
                  onChange={(v) => setSetDefaultModal({ ...setDefaultModal, templateId: v })} 
                  fetchOptions={fetchShiftTemplates}
                  placeholder="Search shift templates..."
                />
              </div>
              
              <p className="text-xs text-muted-foreground">
                This will set the employee's permanent default shift. Existing overrides for today are not affected.
              </p>
            </div>
            
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSetDefaultModal(null)}>Cancel</Button>
              <Button 
                onClick={handleSetDefaultShift}
                disabled={updateEmployee.isPending}
              >
                {updateEmployee.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Default
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}