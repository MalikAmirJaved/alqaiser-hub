// components/ui/date-range-picker.tsx
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import { CalendarIcon } from "lucide-react";

export function DateRangePicker({ value, onChange }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value.from ? (
            value.to ? `${format(value.from, "LLL dd, y")} – ${format(value.to, "LLL dd, y")}` : format(value.from, "LLL dd, y")
          ) : <span>Pick a date range</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DayPicker mode="range" selected={value} onSelect={onChange} numberOfMonths={2} />
      </PopoverContent>
    </Popover>
  );
}