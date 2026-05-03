"use client";
import { useState, useEffect, useMemo } from "react";
import { ls, uid } from "@/services/localStorageService";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CalendarDays, ListFilter, Search, Settings, UserPlus, X, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isToday } from "date-fns";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { DateRangePickerRac } from "@/components/reuseable/DateRangePickerRac";
import { resolveShiftForDate, ShiftTemplate, ShiftAssignment, EmployeeDefaultShift } from "@/lib/shiftResolver";

export default function ShiftsManagementPage() {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [defaultShifts, setDefaultShifts] = useState<EmployeeDefaultShift[]>([]);
  const [employees, setEmployees] = useState<{id:string, first_name:string, last_name:string, department:string}[]>([]);
  const [activeTab, setActiveTab] = useState("list");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filters, setFilters] = useState({ search: "", templateId: "", dateRange: { start: undefined as string|undefined, end: undefined as string|undefined } });
  const [showDefaultModal, setShowDefaultModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [defaultFormData, setDefaultFormData] = useState({ template_id: "", effective_from: "", effective_to: "" });

  useEffect(() => {
    setTemplates(ls.get("shifts_templates", []));
    setAssignments(ls.get("shifts_assignments", []));
    setDefaultShifts(ls.get("employee_default_shifts", []));
    setEmployees(ls.get("employees", []).filter((e: any) => e.employment_status === "ACTIVE").map((e: any) => ({ id: e.id, first_name: e.first_name, last_name: e.last_name, department: e.department })));
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const resolvedShifts = useMemo(() => {
    const result: Record<string, Record<string, { template: ShiftTemplate | null; isOverride: boolean }>> = {};
    days.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      result[dateStr] = {};
      employees.forEach(emp => {
        result[dateStr][emp.id] = resolveShiftForDate(emp.id, dateStr, assignments, defaultShifts, templates);
      });
    });
    return result;
  }, [days, employees, assignments, defaultShifts, templates]);

  const filteredEmployees = employees.filter(e => {
    const matchSearch = `${e.first_name} ${e.last_name}`.toLowerCase().includes(filters.search.toLowerCase()) || e.department?.toLowerCase().includes(filters.search.toLowerCase());
    return matchSearch;
  });

  const getEmployeesForShift = (dateStr: string, templateId: string) => {
    return employees.filter(emp => {
      const resolved = resolvedShifts[dateStr]?.[emp.id]?.template;
      const templateMatch = filters.templateId ? resolved?.id === filters.templateId : true;
      return resolved?.id === templateId && templateMatch;
    });
  };

  const handleSaveDefaultShift = () => {
    if (!selectedEmployee || !defaultFormData.template_id || !defaultFormData.effective_from) return alert("Template & Start Date required");
    
    // Close previous open-ended default for this employee
    const updated = defaultShifts.map(d => 
      d.employee_id === selectedEmployee.id && d.effective_to === null 
        ? { ...d, effective_to: defaultFormData.effective_from === d.effective_from ? null : new Date(new Date(defaultFormData.effective_from).getTime() - 86400000).toISOString().split("T")[0] } 
        : d
    );

    updated.push({
      id: uid("eds"),
      employee_id: selectedEmployee.id,
      template_id: defaultFormData.template_id,
      effective_from: defaultFormData.effective_from,
      effective_to: defaultFormData.effective_to || null
    });
    setDefaultShifts(updated);
    ls.set("employee_default_shifts", updated);
    setShowDefaultModal(false);
  };

  return (
    <div>
      <PageHeader title="Shift Management" subtitle="Manage employee schedules, defaults & calendar overrides" />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/40 mb-4">
          <TabsTrigger value="list"><ListFilter className="w-4 h-4 mr-2"/> List View</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarDays className="w-4 h-4 mr-2"/> Calendar View</TabsTrigger>
        </TabsList>

        {/* LIST VIEW */}
        <TabsContent value="list" className="m-0 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} placeholder="Search employees..." className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" />
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
                    const activeDefault = defaultShifts.find(d => d.employee_id === emp.id && d.effective_to === null);
                    return (
                      <tr key={emp.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{emp.first_name} {emp.last_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{emp.department}</td>
                        <td className="px-4 py-3">
                          {resolved?.template ? (
                            <span className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs" style={{ backgroundColor: `${resolved.template.color}20`, color: resolved.template.color }}>
                              <Clock className="w-3 h-3" /> {resolved.template.name} {resolved.isOverride && <span className="bg-warning/20 text-warning px-1.5 rounded ml-1">Override</span>}
                            </span>
                          ) : <span className="text-muted-foreground italic">No shift assigned</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">{activeDefault?.effective_from || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedEmployee(emp); setDefaultFormData({ template_id: activeDefault?.template_id || "", effective_from: activeDefault?.effective_from || format(new Date(), "yyyy-MM-dd"), effective_to: "" }); setShowDefaultModal(true); }}>
                            <Settings className="w-3.5 h-3.5 mr-1.5"/> Set Default
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* CALENDAR VIEW */}
        <TabsContent value="calendar" className="m-0 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} placeholder="Filter employees..." className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <SearchableSelect 
                value={filters.templateId} 
                onChange={(v) => setFilters({...filters, templateId: v})} 
                options={templates.map(t => ({value: t.id, label: t.name}))} 
                placeholder="Filter by Shift Template"
              />
              <DateRangePickerRac 
                startDate={filters.dateRange.start} 
                endDate={filters.dateRange.end} 
                onChange={(s, e) => setFilters({...filters, dateRange: { start: s, end: e }})} 
                placeholder="Date Range"
              />
            </div>

            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-lg capitalize">{format(currentMonth, "MMMM yyyy")}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="w-4 h-4"/></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="w-4 h-4"/></Button>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 bg-muted/20 rounded-t-xl">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 divide-x divide-border border-x border-b rounded-b-xl">
              {days.map((day, i) => {
                const dayStr = format(day, "yyyy-MM-dd");
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isTod = isToday(day);
                
                return (
                  <div key={i} className={`min-h-[140px] p-2 ${!isCurrentMonth ? "bg-muted/10" : isTod ? "bg-primary/5" : ""}`}>
                    <div className={`text-xs font-medium mb-2 ${isTod ? "bg-primary text-primary-foreground w-6 h-6 rounded-full grid place-items-center" : "text-muted-foreground"}`}>{format(day, "d")}</div>
                    <div className="space-y-1.5">
                      {templates.filter(t => getEmployeesForShift(dayStr, t.id).length > 0).map(tpl => {
                        const emps = getEmployeesForShift(dayStr, tpl.id);
                        const matchSearch = emps.some(e => `${e.first_name} ${e.last_name}`.toLowerCase().includes(filters.search.toLowerCase()));
                        if (filters.search && !matchSearch) return null;
                        return (
                          <div key={tpl.id} className="text-[10px] px-1.5 py-1 rounded truncate text-white shadow-sm" style={{ backgroundColor: tpl.color }}>
                            {tpl.name} • {emps.length} emp
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
      </Tabs>

      {/* Default Shift Modal */}
      {showDefaultModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-md">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="font-semibold flex items-center gap-2"><Settings className="w-4 h-4 text-primary"/> Set Default Shift</h2>
              <button onClick={() => setShowDefaultModal(false)} className="p-1.5 hover:bg-muted rounded"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-muted/40 rounded-lg p-3 text-sm">
                <div className="text-xs text-muted-foreground">Employee</div>
                <div className="font-medium">{selectedEmployee.first_name} {selectedEmployee.last_name}</div>
              </div>
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground">Shift Template *</span><SearchableSelect value={defaultFormData.template_id} onChange={(v) => setDefaultFormData({...defaultFormData, template_id: v})} options={templates.filter(t=>t.is_active).map(t => ({value: t.id, label: `${t.name} (${t.startTime}-${t.endTime})`}))} placeholder="Select shift template"/></label>
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground">Effective From *</span><input type="date" value={defaultFormData.effective_from} onChange={(e) => setDefaultFormData({...defaultFormData, effective_from: e.target.value})} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" /></label>
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground">Effective To (Optional)</span><input type="date" value={defaultFormData.effective_to} onChange={(e) => setDefaultFormData({...defaultFormData, effective_to: e.target.value || ""})} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" /></label>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDefaultModal(false)}>Cancel</Button>
              <Button onClick={handleSaveDefaultShift}>Save Default</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}