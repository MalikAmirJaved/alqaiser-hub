import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  indeterminate,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  indeterminate?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !!indeterminate;
    }
  }, [indeterminate]);

  return (
    <label
      className={cn(
        "flex items-start gap-3 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="peer sr-only"
        />

        <div
          className={cn(
            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
            "peer-focus:ring-2 peer-focus:ring-[var(--ring)]",
            checked || indeterminate
              ? "bg-[var(--primary)] border-[var(--primary)]"
              : "bg-[var(--input)] border-[var(--border)]"
          )}
        >
          {checked && !indeterminate && (
            <svg
              className="w-2.5 h-2.5 text-[var(--primary-foreground)]"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {indeterminate && (
            <span className="w-2 h-0.5 bg-[var(--primary-foreground)] rounded-full" />
          )}
        </div>
      </div>

      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <span className="text-sm font-medium text-[var(--foreground)]">
              {label}
            </span>
          )}

          {description && (
            <span className="text-xs text-[var(--muted-foreground)]">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
}