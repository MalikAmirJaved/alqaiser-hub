// src/components/reuseable/StepBar.tsx
"use client";

import { Check } from "lucide-react";

interface StepBarProps {
  steps: string[];
  current: number;
}

export default function StepBar({ steps, current }: StepBarProps) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
              i < current
                ? "bg-primary text-primary-foreground"
                : i === current
                  ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span
            className={`text-sm font-medium ${i === current ? "text-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`flex-1 h-px mx-4 transition-colors ${i < current ? "bg-primary" : "bg-border"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
