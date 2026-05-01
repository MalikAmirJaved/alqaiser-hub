// ============================================
// FILE: src/components/SearchableSelect.jsx
// ============================================

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, ChevronUp, X, Search } from "lucide-react";

/**
 * SearchableSelect Component
 * A dropdown with search functionality and an arrow button to show/hide options
 * 
 * @param {string} value - Current selected value
 * @param {function} onChange - Callback when selection changes
 * @param {array} options - Array of options [{ value, label }] or string[]
 * @param {string} placeholder - Placeholder text
 * @param {boolean} required - Required field
 * @param {string} className - Additional CSS classes
 * @param {boolean} disabled - Disabled state
 * @param {string} label - Optional label for the field
 */
export default function SearchableSelect({ 
  value = "", 
  onChange, 
  options = [], 
  placeholder = "Select...", 
  required = false, 
  className = "", 
  disabled = false 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : (value || placeholder);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter((opt) =>
      opt.label?.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Explicit toggle handler that prevents event interference
  const handleToggle = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  }, [disabled]);

  const handleSelect = useCallback((val, label) => {
    onChange(val);
    setSearch("");
    setIsOpen(false); // Closes dropdown after selection
  }, [onChange]);

  const handleClear = useCallback((e) => {
    e.stopPropagation(); // Prevents dropdown toggle when clicking X
    setSearch("");
    setIsOpen(false);
  }, []);

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      {/* Trigger Area */}
      <div
        onClick={handleToggle}
        className={`
          w-full h-9 px-3 flex items-center justify-between rounded-md border border-border bg-muted/40 text-sm outline-none
          focus-within:ring-2 focus-within:ring-ring cursor-pointer select-none transition-colors
          ${disabled ? "opacity-50 pointer-events-none cursor-not-allowed" : "hover:bg-muted/60"}
        `}
        role="combobox"
        aria-expanded={isOpen}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(prev => !prev);
          }
        }}
      >
        <span className={`truncate ${value ? "text-foreground" : "text-muted-foreground"}`}>
          {displayValue}
        </span>
        <div className="flex items-center gap-1 ml-2">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-muted rounded"
              aria-label="Clear selection"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                autoFocus
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-7 pl-7 pr-2 text-xs rounded border border-border bg-muted/20 outline-none focus:ring-1 focus:ring-ring"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">No results found</div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value, opt.label)}
                  className={`
                    px-3 py-2 text-sm rounded cursor-pointer select-none flex items-center justify-between
                    ${opt.value === value ? "bg-primary/15 text-primary font-medium" : "hover:bg-muted/50"}
                  `}
                >
                  {opt.label}
                  {opt.value === value && <span className="text-xs text-primary">✓</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Hidden input for form validation */}
      {required && <input type="hidden" value={value} required />}
    </div>
  );
}

/**
 * SearchableSelectGroup - Combines multiple searchable selects for country/state/city
 */
export function LocationSearchableGroup({
  country,
  setCountry,
  state,
  setState,
  city,
  setCity,
  countries = [],
  states = [],
  cities = [],
  required = false,
}) {
  const handleCountryChange = (newCountry) => {
    setCountry(newCountry);
    setState("");
    setCity("");
  };

  const handleStateChange = (newState) => {
    setState(newState);
    setCity("");
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-muted-foreground text-xs block mb-1">
          Country {required && <span className="text-destructive">*</span>}
        </label>
        <SearchableSelect
          value={country}
          onChange={handleCountryChange}
          options={countries}
          placeholder="Select Country"
        />
      </div>
      <div>
        <label className="text-muted-foreground text-xs block mb-1">State/Region</label>
        <SearchableSelect
          value={state}
          onChange={handleStateChange}
          options={states}
          placeholder="Select State"
          disabled={!country}
        />
      </div>
      <div>
        <label className="text-muted-foreground text-xs block mb-1">City</label>
        <SearchableSelect
          value={city}
          onChange={setCity}
          options={cities}
          placeholder="Select City"
          disabled={!country || !state}
        />
      </div>
    </div>
  );
}