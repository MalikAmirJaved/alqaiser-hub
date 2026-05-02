// src/components/ui/date-picker.tsx
"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
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
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", className }: DatePickerProps) {
  // Force local time interpretation by appending T00:00:00
  const [date, setDate] = React.useState<Date | undefined>(
    value ? parseISO(`${value}T00:00:00`) : undefined
  );
  const [view, setView] = React.useState<"date" | "month" | "year">("date");
  const [tempDate, setTempDate] = React.useState<Date | undefined>(date);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (value) setDate(parseISO(`${value}T00:00:00`));
  }, [value]);

  const handleSelect = (selected: Date | undefined) => {
    setDate(selected);
    if (onChange) {
      onChange(selected ? format(selected, "yyyy-MM-dd") : undefined);
    }
    setOpen(false); // Close popover after selection
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDate(undefined);
    if (onChange) {
      onChange(undefined);
    }
  };

  const handleMonthSelect = (month: number) => {
    const newDate = tempDate ? new Date(tempDate) : new Date();
    newDate.setMonth(month);
    setTempDate(newDate);
    setView("date");
  };

  const handleYearSelect = (year: number) => {
    const newDate = tempDate ? new Date(tempDate) : new Date();
    newDate.setFullYear(year);
    setTempDate(newDate);
    setView("month");
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = tempDate ? new Date(tempDate) : new Date();
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setTempDate(newDate);
  };

  const getYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 100; i <= currentYear + 10; i++) {
      years.push(i);
    }
    return years;
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const isSelectedYear = (year: number) => {
    return tempDate && tempDate.getFullYear() === year;
  };

  const isSelectedMonth = (monthIndex: number) => {
    return tempDate && tempDate.getMonth() === monthIndex;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal transition-all duration-200",
            "hover:bg-accent hover:text-accent-foreground",
            !date && "text-muted-foreground",
            open && "ring-2 ring-ring ring-offset-2",
            className
          )}
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
        <div className="bg-popover rounded-lg overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b bg-muted/30">
            <div className="flex justify-between items-center gap-2">
              {view !== "date" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView("date")}
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
                  onClick={() => setView("month")}
                  className={cn(
                    "h-8 px-3 transition-all hover:scale-105",
                    view === "month" && "bg-accent text-accent-foreground"
                  )}
                >
                  {tempDate ? format(tempDate, "MMMM") : format(new Date(), "MMMM")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView("year")}
                  className={cn(
                    "h-8 px-3 transition-all hover:scale-105",
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
                    onClick={() => navigateMonth('prev')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 transition-all hover:scale-105"
                    onClick={() => navigateMonth('next')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Content with animations */}
          <div className="relative">
            {view === "date" && (
              <div className="animate-in slide-in-from-left-5 duration-200">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleSelect}
                  month={tempDate}
                  onMonthChange={setTempDate}
                  initialFocus
                  className="rounded-md border-0"
                  classNames={{
                    day: "hover:scale-105 transition-all",
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground",
                  }}
                />
              </div>
            )}

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

          {/* Footer with quick actions */}
          {date && (
            <div className="p-2 border-t bg-muted/30">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs transition-all hover:scale-[0.98]"
                onClick={() => {
                  setDate(undefined);
                  onChange?.(undefined);
                  setOpen(false);
                }}
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

// Add this to your global CSS file for custom scrollbar
// .custom-scrollbar::-webkit-scrollbar {
//   width: 6px;
// }
// .custom-scrollbar::-webkit-scrollbar-track {
//   background: hsl(var(--muted));
//   border-radius: 10px;
// }
// .custom-scrollbar::-webkit-scrollbar-thumb {
//   background: hsl(var(--muted-foreground)/0.3);
//   border-radius: 10px;
// }
// .custom-scrollbar::-webkit-scrollbar-thumb:hover {
//   background: hsl(var(--muted-foreground)/0.5);
// }