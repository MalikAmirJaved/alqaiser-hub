// src/app/(app)/hr/payroll/page.tsx
"use client";

import { useState } from "react";
import {  X,  } from "lucide-react";

// ============================================
// MONTH SELECTOR MODAL
// ============================================
export default function MonthSelectorModal({
    formatCurrency,
  isOpen,
  onClose,
  selectedMonth,
  selectedYear,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: number;
  selectedYear: number;
  onSelect: (month: number, year: number) => void;
}) {
  const [tempMonth, setTempMonth] = useState(selectedMonth);
  const [tempYear, setTempYear] = useState(selectedYear);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = [2024, 2025, 2026, 2027];

  const handleSelect = () => {
    onSelect(tempMonth, tempYear);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Select Month</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-2">Year</label>
            <div className="grid grid-cols-3 gap-2">
              {years.map((year) => (
                <button
                  key={year}
                  onClick={() => setTempYear(year)}
                  className={`py-2 rounded-md text-sm transition-colors ${tempYear === year
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 hover:bg-muted"
                    }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-2">Month</label>
            <div className="grid grid-cols-3 gap-2">
              {months.map((month, index) => (
                <button
                  key={month}
                  onClick={() => setTempMonth(index + 1)}
                  className={`py-2 rounded-md text-sm transition-colors ${tempMonth === index + 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 hover:bg-muted"
                    }`}
                >
                  {month.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSelect} className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}