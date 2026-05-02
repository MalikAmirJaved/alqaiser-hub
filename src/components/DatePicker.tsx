// src/components/ui/date-picker.tsx
"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
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

  React.useEffect(() => {
    if (value) setDate(parseISO(`${value}T00:00:00`));
  }, [value]);

  const handleSelect = (selected: Date | undefined) => {
    setDate(selected);
    if (onChange) {
      onChange(selected ? format(selected, "yyyy-MM-dd") : undefined);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          initialFocus
          className="rounded-md border"
        />
      </PopoverContent>
    </Popover>
  );
}