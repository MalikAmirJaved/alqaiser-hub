
// src/components/payroll/MonthSelectorModal.tsx
"use client";

import { useEffect, useState } from "react";
import { X, Calendar } from "lucide-react";

interface MonthSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: number;
  selectedYear: number;
  onSelect: (month: number, year: number) => void;
  formatCurrency: (amount: number) => string;
}

export default function MonthSelectorModal({ 
  isOpen, 
  onClose, 
  selectedMonth, 
  selectedYear, 
  onSelect,
  formatCurrency 
}: MonthSelectorModalProps) {
  const [tempMonth, setTempMonth] = useState(selectedMonth);
  const [tempYear, setTempYear] = useState(selectedYear);

  // IMPORTANT: Reset temp values when modal opens or when selectedMonth/Year change
  useEffect(() => {
    if (isOpen) {
      setTempMonth(selectedMonth);
      setTempYear(selectedYear);
    }
  }, [isOpen, selectedMonth, selectedYear]);

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  const handleConfirm = () => {
    onSelect(tempMonth, tempYear);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Select Payroll Period
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          {/* Month Selector */}
          <div>
            <label className="block text-sm font-medium mb-2">Month</label>
            <div className="grid grid-cols-3 gap-2">
              {monthNames.map((month, index) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => setTempMonth(index + 1)}
                  className={`px-3 py-2 rounded-md text-sm transition ${
                    tempMonth === index + 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 hover:bg-muted border border-border"
                  }`}
                >
                  {month.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Year Selector */}
          <div>
            <label className="block text-sm font-medium mb-2">Year</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTempYear(tempYear - 1)}
                className="px-4 py-2 rounded-md bg-muted/40 border border-border hover:bg-muted"
              >
                -
              </button>
              <div className="flex-1 text-center py-2 font-semibold">
                {tempYear}
              </div>
              <button
                type="button"
                onClick={() => setTempYear(tempYear + 1)}
                className="px-4 py-2 rounded-md bg-muted/40 border border-border hover:bg-muted"
              >
                +
              </button>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Selected: {monthNames[tempMonth - 1]}, {tempYear}
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleConfirm} className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
