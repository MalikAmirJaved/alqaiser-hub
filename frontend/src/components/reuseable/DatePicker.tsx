// src/components/reuseable/DatePicker.tsx
"use client";

import * as React from "react";
import { format, parseISO, setMonth, setYear } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
  value?: string; // Expects "YYYY-MM-DD"
  onChange?: (val: string | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
}

type ViewMode = "date" | "month" | "year";

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled,
  minDate,
  maxDate,
}: DatePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(
    value ? parseISO(`${value}T00:00:00`) : undefined
  );
  const [view, setView] = React.useState<ViewMode>("date");
  const [tempDate, setTempDate] = React.useState<Date | undefined>(date);
  const [open, setOpen] = React.useState(false);

  // Sync internal state when external value changes
  React.useEffect(() => {
    if (value) {
      const parsed = parseISO(`${value}T00:00:00`);
      setDate(parsed);
      setTempDate(parsed);
    }
  }, [value]);

  // Reset view when popover opens
  React.useEffect(() => {
    if (open) {
      setView("date");
      setTempDate(date);
    }
  }, [open, date]);

  const handleSelect = (selected: Date | undefined) => {
    setDate(selected);
    if (onChange) {
      onChange(selected ? format(selected, "yyyy-MM-dd") : undefined);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDate(undefined);
    if (onChange) onChange(undefined);
  };

  // Month selection
  const handleMonthSelect = (monthIndex: number) => {
    const newDate = tempDate ? setMonth(tempDate, monthIndex) : setMonth(new Date(), monthIndex);
    setTempDate(newDate);
    setView("date");
  };

  // Year selection
  const handleYearSelect = (year: number) => {
    const newDate = tempDate ? setYear(tempDate, year) : setYear(new Date(), year);
    setTempDate(newDate);
    setView("month");
  };

  // Navigate months in date view
  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = tempDate ? new Date(tempDate) : new Date();
    newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    setTempDate(newDate);
  };

  // Navigate years in month/year view
  const navigateYear = (direction: "prev" | "next") => {
    const newDate = tempDate ? new Date(tempDate) : new Date();
    newDate.setFullYear(newDate.getFullYear() + (direction === "next" ? 1 : -10));
    setTempDate(newDate);
  };

  // Generate year range for year picker (100 years before to 10 after current)
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal transition-all duration-200 cursor-pointer",
            "hover:bg-accent hover:text-accent-foreground",
            !date && "text-muted-foreground",
            open && "ring-2 ring-ring ring-offset-2",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">
            {date ? format(date, "PPP") : <span>{placeholder}</span>}
          </span>
          {date && (
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
        <div className="bg-popover rounded-lg overflow-hidden min-w-[280px]">
          
          {/* ===== HEADER ===== */}
          <div className="p-3 border-b bg-muted/30">
            <div className="flex justify-between items-center gap-2">
              
              {/* Back button (only in month/year view) */}
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
              
              {/* Center: Clickable Month/Year buttons */}
              <div className="flex gap-1 mx-auto">
                {/* Month button - shows month picker */}
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
                
                {/* Year button - shows year picker */}
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

              {/* Navigation arrows (only in date view) */}
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

              {/* Year navigation (in month/year view) */}
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
            
            {/* DATE VIEW */}
            {view === "date" && (
              <div className="animate-in slide-in-from-left-5 duration-200">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleSelect}
                  month={tempDate}
                  onMonthChange={setTempDate}
                  disabled={isDateDisabled}
                  initialFocus
                  className="rounded-md border-0 p-3"
                  classNames={{
                    day: "hover:scale-105 transition-all",
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground",
                    day_disabled: "opacity-40 cursor-not-allowed",
                  }}
                />
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
          {date && view === "date" && (
            <div className="p-2 border-t bg-muted/30">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs transition-all hover:scale-[0.98]"
                onClick={handleClear}
              >
                Clear date
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}