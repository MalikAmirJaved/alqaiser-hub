"use client";

// ============================================================
// COMPONENT LIBRARY — Deep Navy ERP Design System
// Matches styles.css color scheme (oklch dark-navy palette)
// Next.js + TypeScript + Tailwind CSS
// ============================================================

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  Fragment,
} from "react";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type StatusVariant =
  | "active"
  | "inactive"
  | "pending"
  | "success"
  | "warning"
  | "danger";
export type SizeVariant = "sm" | "md" | "lg";
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export interface Column<T = Record<string, unknown>> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface NavItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: string | number;
  active?: boolean;
  children?: NavItem[];
}

export interface FormField {
  name: string;
  label: string;
  type:
  | "text"
  | "email"
  | "password"
  | "number"
  | "textarea"
  | "select"
  | "date"
  | "daterange"
  | "toggle"
  | "checkbox"
  | "radio";
  placeholder?: string;
  required?: boolean;
  options?: SelectOption[];
  defaultValue?: unknown;
  description?: string;
  validation?: (value: unknown) => string | undefined;
}

export interface StatCard {
  title: string;
  value: string | number;
  change?: { value: number; label?: string };
  icon?: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS (CSS variable references as Tailwind classes)
// ─────────────────────────────────────────────────────────────

const token = {
  bg: "bg-[var(--background)]",
  card: "bg-[var(--card)]",
  border: "border-[var(--border)]",
  text: "text-[var(--foreground)]",
  textMuted: "text-[var(--muted-foreground)]",
  primary: "bg-[var(--primary)] text-[var(--primary-foreground)]",
  secondary: "bg-[var(--secondary)] text-[var(--secondary-foreground)]",
  muted: "bg-[var(--muted)]",
  accent: "bg-[var(--accent)] text-[var(--accent-foreground)]",
  ring: "ring-[var(--ring)]",
  sidebar: "bg-[var(--sidebar)]",
  input: "bg-[var(--input)]",
} as const;

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ─────────────────────────────────────────────────────────────
// 1. BADGE
// ─────────────────────────────────────────────────────────────

const statusStyles: Record<StatusVariant, string> = {
  active: "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30",
  inactive: "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]",
  pending: "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/30",
  success: "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30",
  warning: "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/30",
  danger: "bg-[var(--destructive)]/15 text-[var(--destructive)] border-[var(--destructive)]/30",
};

export function Badge({
  status,
  label,
  dot = true,
}: {
  status: StatusVariant;
  label: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        statusStyles[status]
      )}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      )}
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. BUTTON
// ─────────────────────────────────────────────────────────────

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 shadow-sm",
  secondary:
    "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)] border border-[var(--border)]",
  ghost:
    "bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
  destructive:
    "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive)]/90",
};

const buttonSizes: Record<SizeVariant, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-10 px-5 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  onClick,
  disabled,
  type = "button",
  className,
  loading,
}: {
  variant?: ButtonVariant;
  size?: SizeVariant;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1",
        "disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. INPUT
// ─────────────────────────────────────────────────────────────

export function Input({
  label,
  description,
  error,
  placeholder,
  value,
  onChange,
  type = "text",
  required,
  disabled,
  className,
  prefix,
  suffix,
}: {
  label?: string;
  description?: string;
  error?: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-sm font-medium text-[var(--foreground)]">
          {label}
          {required && <span className="text-[var(--destructive)] ml-1">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-[var(--muted-foreground)] text-sm flex items-center">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={cn(
            "w-full h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--input)]",
            "text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
            "px-3 py-2 transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-[var(--destructive)] focus:ring-[var(--destructive)]",
            prefix && "pl-9",
            suffix && "pr-9"
          )}
        />
        {suffix && (
          <span className="absolute right-3 text-[var(--muted-foreground)] text-sm flex items-center">
            {suffix}
          </span>
        )}
      </div>
      {description && !error && (
        <p className="text-xs text-[var(--muted-foreground)]">{description}</p>
      )}
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. TEXTAREA
// ─────────────────────────────────────────────────────────────

export function Textarea({
  label,
  description,
  error,
  placeholder,
  value,
  onChange,
  rows = 3,
  required,
  disabled,
  className,
}: {
  label?: string;
  description?: string;
  error?: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-sm font-medium text-[var(--foreground)]">
          {label}
          {required && <span className="text-[var(--destructive)] ml-1">*</span>}
        </label>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        required={required}
        className={cn(
          "w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--input)]",
          "text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
          "px-3 py-2 resize-y transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-[var(--destructive)] focus:ring-[var(--destructive)]",
          className
        )}
      />
      {description && !error && (
        <p className="text-xs text-[var(--muted-foreground)]">{description}</p>
      )}
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. TOGGLE
// ─────────────────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: SizeVariant;
}) {
  const sizeMap = {
    sm: { track: "w-8 h-4", thumb: "w-3 h-3", translate: "translate-x-4" },
    md: { track: "w-11 h-6", thumb: "w-5 h-5", translate: "translate-x-5" },
    lg: { track: "w-14 h-7", thumb: "w-6 h-6", translate: "translate-x-7" },
  };
  const s = sizeMap[size];

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent",
          "transition-colors duration-200 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          s.track,
          checked ? "bg-[var(--primary)]" : "bg-[var(--muted)]"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block rounded-full bg-white shadow-sm",
            "transform transition duration-200 ease-in-out",
            s.thumb,
            checked ? s.translate : "translate-x-0"
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <span className="text-sm font-medium text-[var(--foreground)] leading-none">
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. CHECKBOX
// ─────────────────────────────────────────────────────────────

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
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  return (
    <label className={cn("flex items-start gap-3 cursor-pointer", disabled && "opacity-50 cursor-not-allowed")}>
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div
          onClick={() => !disabled && onChange(!checked)}
          className={cn(
            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
            "focus-within:ring-2 focus-within:ring-[var(--ring)]",
            checked || indeterminate
              ? "bg-[var(--primary)] border-[var(--primary)]"
              : "bg-[var(--input)] border-[var(--border)]"
          )}
        >
          {checked && !indeterminate && (
            <svg className="w-2.5 h-2.5 text-[var(--primary-foreground)]" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {indeterminate && (
            <span className="w-2 h-0.5 bg-[var(--primary-foreground)] rounded-full" />
          )}
        </div>
      </div>
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>}
          {description && <span className="text-xs text-[var(--muted-foreground)]">{description}</span>}
        </div>
      )}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. DROPDOWN FIELD
// ─────────────────────────────────────────────────────────────

export function Dropdown({
  label,
  description,
  error,
  options,
  value,
  onChange,
  placeholder = "Select option",
  required,
  disabled,
  className,
}: {
  label?: string;
  description?: string;
  error?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={cn("relative flex flex-col gap-1.5", className)} ref={ref}>
      {label && (
        <label className="text-sm font-medium text-[var(--foreground)]">
          {label}
          {required && <span className="text-[var(--destructive)] ml-1">*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center justify-between w-full h-9 px-3 rounded-[var(--radius-md)]",
          "border border-[var(--border)] bg-[var(--input)] text-sm",
          "focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
          "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
          error && "border-[var(--destructive)]",
          open && "ring-2 ring-[var(--ring)] border-transparent"
        )}
      >
        <span className={selected ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-full left-0 z-50 mt-1 w-full min-w-[180px]",
            "rounded-[var(--radius-md)] border border-[var(--border)]",
            "bg-[var(--popover)] shadow-xl py-1",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onClick={() => { onChange?.(opt.value); setOpen(false); }}
              className={cn(
                "w-full flex flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors",
                "hover:bg-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed",
                opt.value === value && "text-[var(--primary)] bg-[var(--accent)]"
              )}
            >
              <span>{opt.label}</span>
              {opt.description && (
                <span className="text-xs text-[var(--muted-foreground)]">{opt.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {description && !error && <p className="text-xs text-[var(--muted-foreground)]">{description}</p>}
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 8. DROPDOWN WITH CREATE BUTTON
// ─────────────────────────────────────────────────────────────

export function DropdownWithCreate({
  label,
  options,
  value,
  onChange,
  onCreateNew,
  createLabel = "Create new",
  placeholder = "Select option",
  required,
  disabled,
  className,
}: {
  label?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (v: string) => void;
  onCreateNew?: () => void;
  createLabel?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={cn("flex flex-col gap-1.5", className)} ref={ref}>
      {label && (
        <label className="text-sm font-medium text-[var(--foreground)]">
          {label}
          {required && <span className="text-[var(--destructive)] ml-1">*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center justify-between w-full h-9 px-3 rounded-[var(--radius-md)]",
          "border border-[var(--border)] bg-[var(--input)] text-sm",
          "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          open && "ring-2 ring-[var(--ring)] border-transparent"
        )}
      >
        <span className={selected ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--popover)] shadow-xl overflow-hidden"
          style={{ position: "relative" }}
        >
          <div className="py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange?.(opt.value); setOpen(false); }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-[var(--accent)] transition-colors",
                  opt.value === value && "text-[var(--primary)] bg-[var(--accent)]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="border-t border-[var(--border)] p-1.5">
            <button
              type="button"
              onClick={() => { onCreateNew?.(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--primary)] hover:bg-[var(--accent)] rounded-[var(--radius-sm)] transition-colors"
            >
              <PlusIcon />
              {createLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 9. SEARCHABLE DROPDOWN
// ─────────────────────────────────────────────────────────────

export function SearchableDropdown({
  label,
  description,
  error,
  options,
  value,
  onChange,
  placeholder = "Search...",
  required,
  disabled,
  className,
}: {
  label?: string;
  description?: string;
  error?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={cn("flex flex-col gap-1.5", className)} ref={ref}>
      {label && (
        <label className="text-sm font-medium text-[var(--foreground)]">
          {label}
          {required && <span className="text-[var(--destructive)] ml-1">*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 10); }}
        className={cn(
          "flex items-center justify-between w-full h-9 px-3 rounded-[var(--radius-md)]",
          "border border-[var(--border)] bg-[var(--input)] text-sm",
          "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors",
          error && "border-[var(--destructive)]",
          open && "ring-2 ring-[var(--ring)] border-transparent"
        )}
      >
        <span className={selected ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange?.(""); }}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer p-0.5"
            >
              <XIcon />
            </span>
          )}
          <SearchIcon />
        </div>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--popover)] shadow-xl"
          style={{ position: "relative" }}
        >
          <div className="p-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 px-2 h-8 rounded-[var(--radius-sm)] bg-[var(--input)] border border-[var(--border)]">
              <SearchIcon />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-3">No results found</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange?.(opt.value); setOpen(false); setQuery(""); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--accent)] transition-colors",
                    opt.value === value && "text-[var(--primary)] bg-[var(--accent)]"
                  )}
                >
                  {opt.value === value && <CheckIcon />}
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {description && !error && <p className="text-xs text-[var(--muted-foreground)]">{description}</p>}
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 10. SEARCHABLE DROPDOWN WITH CREATE
// ─────────────────────────────────────────────────────────────

export function SearchableDropdownWithCreate({
  label,
  options,
  value,
  onChange,
  onCreateNew,
  createLabel = "Create new",
  placeholder = "Search...",
  required,
  className,
}: {
  label?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (v: string) => void;
  onCreateNew?: (query: string) => void;
  createLabel?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={cn("flex flex-col gap-1.5", className)} ref={ref}>
      {label && (
        <label className="text-sm font-medium text-[var(--foreground)]">
          {label}
          {required && <span className="text-[var(--destructive)] ml-1">*</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 10); }}
        className={cn(
          "flex items-center justify-between w-full h-9 px-3 rounded-[var(--radius-md)]",
          "border border-[var(--border)] bg-[var(--input)] text-sm",
          "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors",
          open && "ring-2 ring-[var(--ring)] border-transparent"
        )}
      >
        <span className={selected ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}>
          {selected ? selected.label : placeholder}
        </span>
        <SearchIcon />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--popover)] shadow-xl overflow-hidden"
          style={{ position: "relative" }}
        >
          <div className="p-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 px-2 h-8 rounded-[var(--radius-sm)] bg-[var(--input)] border border-[var(--border)]">
              <SearchIcon />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto py-1">
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange?.(opt.value); setOpen(false); setQuery(""); }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-[var(--accent)] transition-colors",
                  opt.value === value && "text-[var(--primary)]"
                )}
              >
                {opt.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-2">No results</p>
            )}
          </div>
          <div className="border-t border-[var(--border)] p-1.5">
            <button
              type="button"
              onClick={() => { onCreateNew?.(query); setOpen(false); setQuery(""); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--primary)] hover:bg-[var(--accent)] rounded-[var(--radius-sm)] transition-colors"
            >
              <PlusIcon />
              {query ? `Create "${query}"` : createLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 11. DATE PICKER
// ─────────────────────────────────────────────────────────────

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = "Pick a date",
  required,
  disabled,
  minDate,
  maxDate,
  className,
}: {
  label?: string;
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function selectDay(day: number) {
    const d = new Date(year, month, day);
    if (minDate && d < minDate) return;
    if (maxDate && d > maxDate) return;
    onChange?.(d);
    setOpen(false);
  }

  function isDisabledDay(day: number): boolean {
    const d = new Date(year, month, day);
    return !!(minDate && d < minDate) || !!(maxDate && d > maxDate);
  }

  function isSelectedDay(day: number): boolean {
    if (!value) return false;
    return (
      value.getFullYear() === year &&
      value.getMonth() === month &&
      value.getDate() === day
    );
  }

  function isToday(day: number): boolean {
    const t = new Date();
    return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)} ref={ref}>
      {label && (
        <label className="text-sm font-medium text-[var(--foreground)]">
          {label}
          {required && <span className="text-[var(--destructive)] ml-1">*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center justify-between w-full h-9 px-3 rounded-[var(--radius-md)]",
          "border border-[var(--border)] bg-[var(--input)] text-sm",
          "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors",
          open && "ring-2 ring-[var(--ring)] border-transparent"
        )}
      >
        <span className={value ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}>
          {value ? formatDate(value) : placeholder}
        </span>
        <CalendarIcon />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--popover)] shadow-xl p-3 w-72"
          style={{ position: "relative" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="p-1 rounded hover:bg-[var(--accent)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <ChevronLeftIcon />
            </button>
            <span className="text-sm font-medium text-[var(--foreground)]">
              {MONTHS[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="p-1 rounded hover:bg-[var(--accent)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <ChevronRightIcon />
            </button>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs text-[var(--muted-foreground)] font-medium py-1">
                {d}
              </div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => (
              <div key={i} className="aspect-square flex items-center justify-center">
                {day && (
                  <button
                    type="button"
                    onClick={() => selectDay(day)}
                    disabled={isDisabledDay(day)}
                    className={cn(
                      "w-8 h-8 rounded-[var(--radius-sm)] text-sm transition-colors",
                      "disabled:opacity-30 disabled:cursor-not-allowed",
                      isSelectedDay(day) && "bg-[var(--primary)] text-[var(--primary-foreground)] font-medium",
                      !isSelectedDay(day) && isToday(day) && "border border-[var(--primary)] text-[var(--primary)]",
                      !isSelectedDay(day) && !isDisabledDay(day) && "hover:bg-[var(--accent)]",
                      !isSelectedDay(day) && "text-[var(--foreground)]"
                    )}
                  >
                    {day}
                  </button>
                )}
              </div>
            ))}
          </div>
          {/* Clear */}
          {value && (
            <div className="border-t border-[var(--border)] mt-2 pt-2">
              <button
                type="button"
                onClick={() => { onChange?.(null); setOpen(false); }}
                className="w-full text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] py-1 transition-colors"
              >
                Clear date
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 12. DATE RANGE PICKER
// ─────────────────────────────────────────────────────────────

export function DateRangePicker({
  label,
  value,
  onChange,
  required,
  disabled,
  className,
}: {
  label?: string;
  value?: { from: Date | null; to: Date | null };
  onChange?: (range: { from: Date | null; to: Date | null }) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [viewDate, setViewDate] = useState(today);
  const [hoveredDay, setHoveredDay] = useState<Date | null>(null);
  const [selecting, setSelecting] = useState<"from" | "to">("from");
  const ref = useRef<HTMLDivElement>(null);

  const from = value?.from ?? null;
  const to = value?.to ?? null;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function selectDay(day: number) {
    const d = new Date(year, month, day);
    if (selecting === "from" || !from) {
      onChange?.({ from: d, to: null });
      setSelecting("to");
    } else {
      if (d < from) {
        onChange?.({ from: d, to: from });
      } else {
        onChange?.({ from, to: d });
      }
      setSelecting("from");
      setOpen(false);
    }
  }

  function isInRange(day: number): boolean {
    const d = new Date(year, month, day);
    const end = to ?? hoveredDay;
    if (!from || !end) return false;
    const lo = from < end ? from : end;
    const hi = from < end ? end : from;
    return d > lo && d < hi;
  }

  function isStart(day: number) {
    const d = new Date(year, month, day);
    return from?.toDateString() === d.toDateString();
  }
  function isEnd(day: number) {
    const d = new Date(year, month, day);
    return to?.toDateString() === d.toDateString();
  }

  const displayText =
    from && to
      ? `${formatDate(from)} – ${formatDate(to)}`
      : from
        ? `${formatDate(from)} – ...`
        : "Select date range";

  return (
    <div className={cn("flex flex-col gap-1.5", className)} ref={ref}>
      {label && (
        <label className="text-sm font-medium text-[var(--foreground)]">
          {label}
          {required && <span className="text-[var(--destructive)] ml-1">*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center justify-between w-full h-9 px-3 rounded-[var(--radius-md)]",
          "border border-[var(--border)] bg-[var(--input)] text-sm",
          "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-colors",
          open && "ring-2 ring-[var(--ring)] border-transparent"
        )}
      >
        <span className={from ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}>
          {displayText}
        </span>
        <CalendarIcon />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--popover)] shadow-xl p-3 w-72"
          style={{ position: "relative" }}
        >
          <div className="flex items-center justify-between mb-3">
            <button type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
            >
              <ChevronLeftIcon />
            </button>
            <span className="text-sm font-medium text-[var(--foreground)]">
              {MONTHS[month]} {year}
            </span>
            <button type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)]"
            >
              <ChevronRightIcon />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs text-[var(--muted-foreground)] font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const inRange = isInRange(day);
              const start = isStart(day);
              const end = isEnd(day);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(day)}
                  onMouseEnter={() => selecting === "to" && setHoveredDay(new Date(year, month, day))}
                  onMouseLeave={() => setHoveredDay(null)}
                  className={cn(
                    "h-8 text-sm transition-colors text-[var(--foreground)] relative",
                    inRange && "bg-[var(--primary)]/15",
                    (start || end) && "bg-[var(--primary)] text-[var(--primary-foreground)] rounded-[var(--radius-sm)] font-medium",
                    !start && !end && !inRange && "hover:bg-[var(--accent)] rounded-[var(--radius-sm)]"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="border-t border-[var(--border)] mt-2 pt-2 text-xs text-[var(--muted-foreground)] text-center">
            {selecting === "from" ? "Select start date" : "Select end date"}
          </div>
        </div>
      )}
    </div>
  );
}



// ─────────────────────────────────────────────────────────────
// 14. HEADER CARD (Stats / Summary Cards)
// ─────────────────────────────────────────────────────────────

export function HeaderCard({
  title,
  value,
  change,
  icon,
  description,
  loading,
  className,
}: {
  title: string;
  value: string | number;
  change?: { value: number; label?: string };
  icon?: React.ReactNode;
  description?: string;
  loading?: boolean;
  className?: string;
}) {
  const isPositive = (change?.value ?? 0) >= 0;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5",
        "flex flex-col gap-3 transition-all hover:border-[var(--primary)]/30 hover:shadow-lg hover:shadow-[var(--primary)]/5",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-[var(--muted-foreground)]">{title}</p>
        {icon && (
          <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
            {icon}
          </div>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-24 rounded-[var(--radius-sm)] bg-[var(--muted)] animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-[var(--foreground)] tracking-tight">{value}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {change !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full",
              isPositive
                ? "bg-[var(--success)]/15 text-[var(--success)]"
                : "bg-[var(--destructive)]/15 text-[var(--destructive)]"
            )}
          >
            {isPositive ? "↑" : "↓"} {Math.abs(change.value)}%
          </span>
        )}
        {description && (
          <span className="text-xs text-[var(--muted-foreground)]">{description}</span>
        )}
      </div>
    </div>
  );
}

export function HeaderCards({
  cards,
  columns = 4,
  className,
}: {
  cards: Array<{
    title: string;
    value: string | number;
    change?: { value: number; label?: string };
    icon?: React.ReactNode;
    description?: string;
  }>;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const colClass: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  };
  return (
    <div className={cn("grid gap-4", colClass[columns], className)}>
      {cards.map((c, i) => <HeaderCard key={i} {...c} />)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 15. TABLE VIEW
// ─────────────────────────────────────────────────────────────

export function TableView<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  selectedRows,
  onRowSelect,
  onRowClick,
  actions,
  emptyMessage = "No data found",
  className,
  stickyHeader = true,
}: {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  selectedRows?: Set<number>;
  onRowSelect?: (idx: number, checked: boolean) => void;
  onRowClick?: (row: T, idx: number) => void;
  actions?: (row: T, idx: number) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
  stickyHeader?: boolean;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey], bv = b[sortKey];
    if (av === bv) return 0;
    const cmp = av! < bv! ? -1 : 1;
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className={cn("rounded-[var(--radius-xl)] border border-[var(--border)] overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={cn(
            "bg-[var(--muted)]/50 border-b border-[var(--border)]",
            stickyHeader && "sticky top-0 z-10"
          )}>
            <tr>
              {onRowSelect && (
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={selectedRows?.size === data.length && data.length > 0}
                    indeterminate={!!selectedRows?.size && selectedRows.size < data.length}
                    onChange={(v) => data.forEach((_, i) => onRowSelect(i, v))}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(
                    "px-4 py-3 text-left font-medium text-[var(--muted-foreground)] whitespace-nowrap",
                    col.sortable && "cursor-pointer select-none hover:text-[var(--foreground)] transition-colors"
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && (
                      <span className={cn("opacity-40", sortKey === col.key && "opacity-100 text-[var(--primary)]")}>
                        {sortKey === col.key && sortDir === "desc" ? "↓" : "↑"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-right text-[var(--muted-foreground)]">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="bg-[var(--card)]">
                  {onRowSelect && <td className="px-4 py-3"><div className="w-4 h-4 rounded bg-[var(--muted)] animate-pulse" /></td>}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 rounded bg-[var(--muted)] animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                  {actions && <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-[var(--muted)] animate-pulse ml-auto" /></td>}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onRowSelect ? 1 : 0) + (actions ? 1 : 0)} className="px-4 py-12 text-center text-[var(--muted-foreground)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row, i)}
                  className={cn(
                    "bg-[var(--card)] transition-colors",
                    onRowClick && "cursor-pointer hover:bg-[var(--accent)]",
                    selectedRows?.has(i) && "bg-[var(--primary)]/5"
                  )}
                >
                  {onRowSelect && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedRows?.has(i) ?? false}
                        onChange={(v) => onRowSelect(i, v)}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-[var(--foreground)] whitespace-nowrap">
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "")}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {actions(row, i)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 16. GRID VIEW (Card grid)
// ─────────────────────────────────────────────────────────────

export function GridView<T extends Record<string, unknown>>({
  data,
  renderCard,
  loading,
  emptyMessage = "No items found",
  columns = 3,
  gap = 4,
  className,
}: {
  data: T[];
  renderCard: (item: T, idx: number) => React.ReactNode;
  loading?: boolean;
  emptyMessage?: string;
  columns?: 2 | 3 | 4 | 5 | 6;
  gap?: number;
  className?: string;
}) {
  const colClass: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
  };

  if (loading) {
    return (
      <div className={cn("grid", colClass[columns], `gap-${gap}`, className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-3">
            <div className="h-32 rounded-[var(--radius-lg)] bg-[var(--muted)] animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-[var(--muted)] animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-[var(--muted)] animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--muted-foreground)]">
        <div className="w-12 h-12 rounded-full bg-[var(--muted)] flex items-center justify-center">
          <InboxIcon />
        </div>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("grid", colClass[columns], `gap-${gap}`, className)}>
      {data.map((item, i) => renderCard(item, i))}
    </div>
  );
}

// Item card for GridView
export function GridCard({
  title,
  subtitle,
  description,
  badge,
  image,
  footer,
  onClick,
  selected,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: { label: string; status: StatusVariant };
  image?: string;
  footer?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative rounded-[var(--radius-xl)] border bg-[var(--card)] overflow-hidden transition-all duration-200",
        "hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5",
        onClick && "cursor-pointer",
        selected ? "border-[var(--primary)] ring-1 ring-[var(--ring)]" : "border-[var(--border)] hover:border-[var(--primary)]/40",
        className
      )}
    >
      {image && (
        <div className="aspect-video w-full overflow-hidden bg-[var(--muted)]">
          <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      )}
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{subtitle}</p>}
          </div>
          {badge && <Badge status={badge.status} label={badge.label} />}
        </div>
        {description && (
          <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">{description}</p>
        )}
        {(footer || actions) && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border)] mt-1">
            <div className="flex-1 min-w-0">{footer}</div>
            {actions && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {actions}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 17. FULL FORM
// ─────────────────────────────────────────────────────────────

export function FullForm({
  title,
  description,
  fields,
  onSubmit,
  submitLabel = "Save Changes",
  cancelLabel = "Cancel",
  onCancel,
  loading,
  sections,
  className,
}: {
  title?: string;
  description?: string;
  fields?: FormField[];
  onSubmit: (data: Record<string, unknown>) => void;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  loading?: boolean;
  sections?: Array<{
    title: string;
    description?: string;
    fields: FormField[];
  }>;
  className?: string;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, Date | null>>({});
  const [ranges, setRanges] = useState<Record<string, { from: Date | null; to: Date | null }>>({});

  const allFields = sections ? sections.flatMap((s) => s.fields) : fields ?? [];

  function setValue(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    allFields.forEach((f) => {
      if (f.required && !values[f.name]) errs[f.name] = `${f.label} is required`;
      if (f.validation) {
        const err = f.validation(values[f.name]);
        if (err) errs[f.name] = err;
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) onSubmit(values);
  }

  function renderField(field: FormField) {
    switch (field.type) {
      case "textarea":
        return (
          <Textarea key={field.name} label={field.label} placeholder={field.placeholder}
            value={String(values[field.name] ?? "")} onChange={(v) => setValue(field.name, v)}
            required={field.required} error={errors[field.name]} description={field.description}
          />
        );
      case "select":
        return (
          <Dropdown key={field.name} label={field.label} options={field.options ?? []}
            value={String(values[field.name] ?? "")} onChange={(v) => setValue(field.name, v)}
            required={field.required} error={errors[field.name]} description={field.description}
            placeholder={field.placeholder}
          />
        );
      case "toggle":
        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <Toggle checked={Boolean(values[field.name])} onChange={(v) => setValue(field.name, v)}
              label={field.label} description={field.description}
            />
          </div>
        );
      case "checkbox":
        return (
          <Checkbox key={field.name} checked={Boolean(values[field.name])} onChange={(v) => setValue(field.name, v)}
            label={field.label} description={field.description}
          />
        );
      case "date":
        return (
          <DatePicker key={field.name} label={field.label} value={dates[field.name] ?? null}
            onChange={(d) => { setDates((p) => ({ ...p, [field.name]: d })); setValue(field.name, d); }}
            placeholder={field.placeholder} required={field.required}
          />
        );
      case "daterange":
        return (
          <DateRangePicker key={field.name} label={field.label}
            value={ranges[field.name] ?? { from: null, to: null }}
            onChange={(r) => { setRanges((p) => ({ ...p, [field.name]: r })); setValue(field.name, r); }}
            required={field.required}
          />
        );
      default:
        return (
          <Input key={field.name} label={field.label} type={field.type} placeholder={field.placeholder}
            value={String(values[field.name] ?? "")} onChange={(v) => setValue(field.name, v)}
            required={field.required} error={errors[field.name]} description={field.description}
          />
        );
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-6", className)}>
      {(title || description) && (
        <div>
          {title && <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>}
          {description && <p className="text-sm text-[var(--muted-foreground)] mt-1">{description}</p>}
        </div>
      )}

      {sections ? (
        sections.map((section, si) => (
          <div key={si} className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">{section.title}</h3>
              {section.description && (
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{section.description}</p>
              )}
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {section.fields.map(renderField)}
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {allFields.map(renderField)}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// 18. LITTLE FORM (Inline / Compact form)
// ─────────────────────────────────────────────────────────────

export function LittleForm({
  title,
  fields,
  onSubmit,
  submitLabel = "Save",
  onCancel,
  loading,
  className,
  inline = false,
}: {
  title?: string;
  fields: FormField[];
  onSubmit: (data: Record<string, unknown>) => void;
  submitLabel?: string;
  onCancel?: () => void;
  loading?: boolean;
  className?: string;
  inline?: boolean;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-4",
        className
      )}
    >
      {title && (
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">{title}</h3>
      )}
      <div className={cn(
        inline
          ? "flex flex-wrap items-end gap-3"
          : "flex flex-col gap-3"
      )}>
        {fields.map((field) => (
          <div key={field.name} className={cn(inline && "flex-1 min-w-[160px]")}>
            {field.type === "select" ? (
              <Dropdown label={field.label} options={field.options ?? []}
                value={String(values[field.name] ?? "")}
                onChange={(v) => setValues((p) => ({ ...p, [field.name]: v }))}
                placeholder={field.placeholder}
              />
            ) : field.type === "toggle" ? (
              <Toggle checked={Boolean(values[field.name])} label={field.label}
                onChange={(v) => setValues((p) => ({ ...p, [field.name]: v }))}
              />
            ) : (
              <Input label={field.label} type={field.type}
                placeholder={field.placeholder}
                value={String(values[field.name] ?? "")}
                onChange={(v) => setValues((p) => ({ ...p, [field.name]: v }))}
                required={field.required}
              />
            )}
          </div>
        ))}
        <div className={cn("flex items-center gap-2", inline ? "pb-0" : "justify-end pt-1")}>
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" loading={loading}>{submitLabel}</Button>
        </div>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// 19. TOGGLE STATUS MODAL
// ─────────────────────────────────────────────────────────────

export function ToggleStatusModal({
  open,
  onClose,
  onConfirm,
  currentStatus,
  targetStatus,
  itemName,
  description,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentStatus: StatusVariant;
  targetStatus: StatusVariant;
  itemName: string;
  description?: string;
  loading?: boolean;
}) {
  const isActivating = targetStatus === "active" || targetStatus === "success";
  const isDeactivating = targetStatus === "inactive";
  const isDangerous = targetStatus === "danger";

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="relative w-full max-w-md rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--card)] shadow-2xl p-6 flex flex-col gap-5 animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Icon */}
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center mx-auto",
          isActivating && "bg-[var(--success)]/15",
          isDeactivating && "bg-[var(--muted)]",
          isDangerous && "bg-[var(--destructive)]/15"
        )}>
          <span className={cn(
            "text-xl",
            isActivating && "text-[var(--success)]",
            isDeactivating && "text-[var(--muted-foreground)]",
            isDangerous && "text-[var(--destructive)]"
          )}>
            {isActivating ? "✓" : isDeactivating ? "○" : "⚠"}
          </span>
        </div>

        <div className="text-center">
          <h3 className="text-base font-semibold text-[var(--foreground)]">
            {isActivating ? "Activate" : isDeactivating ? "Deactivate" : "Update Status"} {itemName}?
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-1.5">
            {description ?? `Are you sure you want to change the status from `}
            {!description && (
              <>
                <Badge status={currentStatus} label={currentStatus} dot={false} />
                {" to "}
                <Badge status={targetStatus} label={targetStatus} dot={false} />
                {" ?"}
              </>
            )}
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={isDangerous ? "destructive" : "primary"}
            className="flex-1"
            onClick={onConfirm}
            loading={loading}
          >
            {isActivating ? "Activate" : isDeactivating ? "Deactivate" : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 20. DETAIL PANEL (Right side panel)
// ─────────────────────────────────────────────────────────────

export function DetailPanel({
  open,
  onClose,
  title,
  subtitle,
  badge,
  children,
  actions,
  width = "md",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: { label: string; status: StatusVariant };
  children: React.ReactNode;
  actions?: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const widthMap = { sm: "w-80", md: "w-96", lg: "w-[480px]", xl: "w-[600px]" };

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}
      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex flex-col border-l border-[var(--border)] bg-[var(--card)]",
          "transition-transform duration-300 ease-out",
          widthMap[width],
          open ? "translate-x-0" : "translate-x-full",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[var(--border)] gap-4 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-[var(--foreground)] truncate">{title}</h2>
              {badge && <Badge status={badge.status} label={badge.label} />}
            </div>
            {subtitle && <p className="text-sm text-[var(--muted-foreground)] mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0"
          >
            <XIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {/* Footer */}
        {actions && (
          <div className="p-4 border-t border-[var(--border)] flex items-center gap-2 flex-shrink-0 bg-[var(--card)]">
            {actions}
          </div>
        )}
      </div>
    </>
  );
}

// Detail row (for use inside DetailPanel)
export function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[var(--border)] last:border-0">
      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] flex-shrink-0 min-w-[100px]">
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div className="text-sm text-[var(--foreground)] text-right">{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 21. TOOLBAR (View switcher + Search + Filters)
// ─────────────────────────────────────────────────────────────

export function Toolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  viewMode,
  onViewModeChange,
  actions,
  filters,
  className,
}: {
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  viewMode?: "table" | "grid";
  onViewModeChange?: (mode: "table" | "grid") => void;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        {onSearchChange !== undefined && (
          <div className="flex-1 min-w-[200px] max-w-sm">
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={onSearchChange}
              prefix={<SearchIcon />}
            />
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {filters}
          {actions}
          {onViewModeChange && (
            <div className="flex rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => onViewModeChange("table")}
                className={cn(
                  "px-2.5 py-1.5 text-sm transition-colors",
                  viewMode === "table"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                )}
                title="Table view"
              >
                <TableIcon />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("grid")}
                className={cn(
                  "px-2.5 py-1.5 text-sm transition-colors",
                  viewMode === "grid"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                )}
                title="Grid view"
              >
                <GridIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 22. PAGE HEADER
// ─────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  onTabChange,
  className,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  onTabChange?: (tab: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {breadcrumbs && (
        <nav className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          {breadcrumbs.map((crumb, i) => (
            <Fragment key={i}>
              {i > 0 && <span>/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-[var(--foreground)] transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className="text-[var(--foreground)]">{crumb.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] tracking-tight">{title}</h1>
          {description && <p className="text-sm text-[var(--muted-foreground)] mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 23. PAGINATION
// ─────────────────────────────────────────────────────────────

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}: {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}) {
  const pages = getPaginationRange(page, totalPages);

  return (
    <div className={cn("flex items-center justify-between gap-4 flex-wrap", className)}>
      {totalItems !== undefined && (
        <p className="text-sm text-[var(--muted-foreground)]">
          {totalItems} item{totalItems !== 1 ? "s" : ""}
        </p>
      )}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="px-2 py-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ←
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={i} className="px-2 py-1.5 text-sm text-[var(--muted-foreground)]">…</span>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => onPageChange(p as number)}
              className={cn(
                "px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors",
                p === page
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent)]"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-2 py-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          →
        </button>
      </div>
      {onPageSizeChange && pageSize && (
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <span>Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--input)] text-[var(--foreground)] text-sm px-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function getPaginationRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

// ─────────────────────────────────────────────────────────────
// 24. EMPTY STATE
// ─────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center gap-4", className)}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-[var(--muted)] flex items-center justify-center text-[var(--muted-foreground)]">
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
        {description && <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-sm">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// ICON PRIMITIVES
// ─────────────────────────────────────────────────────────────

function ChevronIcon({ open, size = "md" }: { open: boolean; size?: "sm" | "md" }) {
  const s = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  return (
    <svg className={cn(s, "text-[var(--muted-foreground)] transition-transform", open && "rotate-180")} viewBox="0 0 16 16" fill="none">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
      <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-[var(--primary)] flex-shrink-0" viewBox="0 0 14 14" fill="none">
      <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-4 h-4 text-[var(--muted-foreground)]" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 7h12M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.9 11.9l1.06 1.06M3.05 12.95l1.06-1.06M11.9 4.1l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
      <path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 6h12M2 10h12M6 2v12M10 2v12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <path d="M3 8l9 6 9-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// EXPORTS SUMMARY
// ─────────────────────────────────────────────────────────────
// Badge               — Status badge with dot indicator
// Button              — Primary/Secondary/Ghost/Destructive
// Input               — Text input with label/error/prefix/suffix
// Textarea            — Multi-line text with label/error
// Toggle              — Animated on/off switch
// Checkbox            — Checkbox with indeterminate state
// Dropdown            — Basic select dropdown
// DropdownWithCreate  — Dropdown + create new button
// SearchableDropdown  — Dropdown with search + clear
// SearchableDropdownWithCreate — Searchable dropdown + create
// DatePicker          — Calendar date picker
// DateRangePicker     — Range selector with hover preview
// Header              — App header with nav + user menu
// HeaderCard          — KPI stat card with change indicator
// HeaderCards         — Responsive grid of HeaderCard
// TableView           — Sortable table with selection + skeleton
// GridView            — Responsive card grid with skeleton
// GridCard            — Card for use in GridView
// FullForm            — Multi-section form with validation
// LittleForm          — Compact inline form
// ToggleStatusModal   — Confirm status change dialog
// DetailPanel         — Slide-in right-side detail panel
// DetailRow           — Label/value row for DetailPanel
// Toolbar             — Search + view toggle + actions
// PageHeader          — Title + breadcrumbs +  actions
// Pagination          — Page navigation with size selector
// EmptyState          — Empty placeholder with CTA
// Toast               — Notification toast (success/warning/danger/info)