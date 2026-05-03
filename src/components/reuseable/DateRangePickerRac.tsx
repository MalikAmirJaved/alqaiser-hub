// src/components/reuseable/DateRangePickerRac.tsx
"use client";

import * as React from "react";
import { format, parseISO, setMonth, setYear } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RangeCalendar } from "@/components/ui/calendar-rac";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDate, DateRange as AriaDateRange } from "@internationalized/date";

interface DateRangePickerRacProps {
  startDate?: string;
  endDate?: string;
  onChange?: (start: string | undefined, end: string | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  minDate?: string;
  maxDate?: string;
}

type ViewMode = "date" | "month" | "year";

const parseDate = (val?: string): CalendarDate | undefined => {
  if (!val) return undefined;
  const [y, m, d] = val.split("-").map(Number);
  return new CalendarDate(y, m, d);
};

const formatDate = (date?: CalendarDate): string | undefined => {
  if (!date) return undefined;
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
};

export function DateRangePickerRac({
  startDate,
  endDate,
  onChange,
  placeholder = "Select date range",
  className,
  disabled,
  required,
  minDate,
  maxDate,
}: DateRangePickerRacProps) {
  const [view, setView] = React.useState<ViewMode>("date");
  
  // KEY FIX: Use CalendarDate for placeholder sync with RangeCalendar
  const [calendarPlaceholder, setCalendarPlaceholder] = React.useState<CalendarDate | undefined>(
    startDate ? parseDate(startDate) : undefined
  );
  
  // tempDate for header navigation (JS Date for setMonth/setYear)
  const [tempDate, setTempDate] = React.useState<Date | undefined>(
    startDate ? parseISO(`${startDate}T00:00:00`) : undefined
  );
  
  const [open, setOpen] = React.useState(false);

  const rangeValue = React.useMemo((): AriaDateRange | null => {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start) return null;
    return { start, end: end || start };
  }, [startDate, endDate]);



  // Sync when external dates change
  React.useEffect(() => {
    if (startDate) {
      const parsed = parseDate(startDate);
      setCalendarPlaceholder(parsed);
      setTempDate(parsed ? new Date(parsed.year, parsed.month - 1, 1) : undefined);
    }
  }, [startDate]);

  const handleSelect = (range: AriaDateRange | null) => {
    if (!range) {
      onChange?.(undefined, undefined);
      return;
    }
    onChange?.(
      formatDate(range.start),
      range.end ? formatDate(range.end) : undefined,
    );
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(undefined, undefined);
  };

  // Reset view when popover opens
  React.useEffect(() => {
    if (open) {
      setView("date");
      const initDate = startDate ? parseISO(`${startDate}T00:00:00`) : new Date();
      setTempDate(initDate);
      setCalendarPlaceholder(parseDate(startDate) ?? new CalendarDate(initDate.getFullYear(), initDate.getMonth() + 1, 1));
    }
  }, [open, startDate]);

  // Month selection
// In handleMonthSelect
// Month selection
const handleMonthSelect = (monthIndex: number) => {
  const newDate = tempDate ? setMonth(tempDate, monthIndex) : setMonth(new Date(), monthIndex);
  setTempDate(newDate);
  // 🐛 FIX: Directly update calendarPlaceholder to ensure calendar updates
  setCalendarPlaceholder(new CalendarDate(newDate.getFullYear(), monthIndex + 1, 1));
  setView("date");
};

// Year selection  
const handleYearSelect = (year: number) => {
  const newDate = tempDate ? setYear(tempDate, year) : setYear(new Date(), year);
  const currentMonth = tempDate ? tempDate.getMonth() : 0;
  setTempDate(newDate);
  // 🐛 FIX: Directly update calendarPlaceholder to ensure calendar updates
  setCalendarPlaceholder(new CalendarDate(year, currentMonth + 1, 1));
  setView("month");
};

  // Navigate months in date view
const navigateMonth = (direction: "prev" | "next") => {
  const newDate = tempDate ? new Date(tempDate) : new Date();
  newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
  setTempDate(newDate);
  setCalendarPlaceholder(new CalendarDate(      // 👈 ADD THIS
    newDate.getFullYear(),
    newDate.getMonth() + 1,
    1
  ));
};

  // Navigate years in month/year view
  const navigateYear = (direction: "prev" | "next") => {
    const newDate = tempDate ? new Date(tempDate) : new Date();
    newDate.setFullYear(newDate.getFullYear() + (direction === "next" ? 1 : -10));
    setTempDate(newDate);
  };

  const getYears = () => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let i = currentYear - 100; i <= currentYear + 10; i++) {
      years.push(i);
    }
    return years;
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const isSelectedMonth = (monthIndex: number) =>
    tempDate?.getMonth() === monthIndex;

  const isSelectedYear = (year: number) =>
    tempDate?.getFullYear() === year;

  const isDateDisabled = (day: Date) => {
    if (minDate && day < parseISO(`${minDate}T00:00:00`)) return true;
    if (maxDate && day > parseISO(`${maxDate}T00:00:00`)) return true;
    return false;
  };

  const displayValue = React.useMemo(() => {
    if (!startDate) return placeholder;
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start) return placeholder;
    
    const formatDisplay = (d: CalendarDate) => 
      `${d.month}/${d.day}/${d.year}`;
    
    if (end) {
      return `${formatDisplay(start)} - ${formatDisplay(end)}`;
    }
    return formatDisplay(start);
  }, [startDate, endDate, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal transition-all duration-200 cursor-pointer",
            "hover:bg-accent hover:text-accent-foreground",
            !startDate && "text-muted-foreground",
            open && "ring-2 ring-ring ring-offset-2",
            disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{displayValue}</span>
          {(startDate || endDate) && (
            <X
              className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0 shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        align="start"
        sideOffset={8}
      >
        <div className="bg-popover rounded-lg overflow-hidden min-w-[320px]">
          
          {/* ===== HEADER ===== */}
          <div className="p-3 border-b bg-muted/30">
            <div className="flex justify-between items-center gap-2">
              
              {view !== "date" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView(view === "year" ? "month" : "date")}
                  className="h-8 px-2 transition-all hover:scale-105"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              
              <div className="flex gap-1 mx-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => view === "date" && setView("month")}
                  className={cn(
                    "h-8 px-3 transition-all hover:scale-105 font-medium",
                    view === "month" && "bg-accent text-accent-foreground"
                  )}
                  disabled={view === "year"}
                >
                  {tempDate ? format(tempDate, "MMMM") : format(new Date(), "MMMM")}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView("year")}
                  className={cn(
                    "h-8 px-3 transition-all hover:scale-105 font-medium",
                    view === "year" && "bg-accent text-accent-foreground"
                  )}
                >
                  {tempDate ? format(tempDate, "yyyy") : format(new Date(), "yyyy")}
                </Button>
              </div>

              {view === "date" && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 transition-all hover:scale-105"
                    onClick={() => navigateMonth("prev")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 transition-all hover:scale-105"
                    onClick={() => navigateMonth("next")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {view !== "date" && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 transition-all hover:scale-105"
                    onClick={() => navigateYear("prev")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 transition-all hover:scale-105"
                    onClick={() => navigateYear("next")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ===== CONTENT ===== */}
          <div className="relative">
            
{view === "date" && (
  <div className="animate-in slide-in-from-left-5 duration-200">
    <div className="p-2">
     <RangeCalendar
  key={`${calendarPlaceholder?.year}-${calendarPlaceholder?.month}`}
  value={rangeValue}
  onChange={handleSelect}
  placeholder={calendarPlaceholder}
  focusedValue={calendarPlaceholder}          
  onFocusChange={(focused) => {               
    setCalendarPlaceholder(focused);
    setTempDate(new Date(focused.year, focused.month - 1, 1));
  }}
  minValue={minDate ? parseDate(minDate) : new CalendarDate(1900, 1, 1)}
  maxValue={maxDate ? parseDate(maxDate) : new CalendarDate(2100, 12, 31)}
  visibleMonths={1}
/>
    </div>
  </div>
)}
            {/* MONTH VIEW */}
            {view === "month" && (
              <div className="p-4 animate-in slide-in-from-right-5 duration-200">
                <div className="grid grid-cols-3 gap-2">
                  {months.map((month, index) => (
                    <Button
                      key={month}
                      variant={isSelectedMonth(index) ? "default" : "outline"}
                      className={cn(
                        "h-12 transition-all hover:scale-105",
                        "hover:bg-primary/10",
                        isSelectedMonth(index) && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => handleMonthSelect(index)}
                    >
                      <span className="text-sm font-medium">{month.slice(0, 3)}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* YEAR VIEW */}
            {view === "year" && (
              <div className="p-4 animate-in slide-in-from-right-5 duration-200">
                <div className="h-[280px] overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-4 gap-2">
                    {getYears().map((year) => (
                      <Button
                        key={year}
                        variant={isSelectedYear(year) ? "default" : "outline"}
                        className={cn(
                          "h-12 transition-all hover:scale-105",
                          "hover:bg-primary/10",
                          isSelectedYear(year) && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => handleYearSelect(year)}
                      >
                        <span className="text-sm font-medium">{year}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ===== FOOTER ===== */}
          {(startDate || endDate) && view === "date" && (
            <div className="p-2 border-t bg-muted/30">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs transition-all hover:scale-[0.98]"
                onClick={handleClear}
              >
                Clear date range
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}