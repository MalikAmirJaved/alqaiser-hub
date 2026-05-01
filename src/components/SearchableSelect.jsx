// ============================================
// FILE: src/components/SearchableSelect.jsx
// ============================================

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, ChevronUp, Search, X, Check } from "lucide-react";

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
  value,
  onChange,
  options = [],
  required = false,
  placeholder = "Select...",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Sync input text when value changes or dropdown opens
  useEffect(() => {
    const selectedOption = options.find((opt) => opt.value === value);
    setQuery(selectedOption ? selectedOption.label : "");
  }, [value, options, isOpen]);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (option) => {
    onChange(option.value);
    setQuery(option.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      if (filteredOptions.length === 0) return;

      setHighlightedIndex((prev) => {
        if (e.key === "ArrowDown") return prev < filteredOptions.length - 1 ? prev + 1 : 0;
        return prev > 0 ? prev - 1 : filteredOptions.length - 1;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Close dropdown on outside click & restore query if closed without selecting
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        const selectedOption = options.find((opt) => opt.value === value);
        setQuery(selectedOption ? selectedOption.label : "");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [options, value]);

  // Scroll highlighted item into view automatically
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0) {
      const activeOption = containerRef.current?.querySelector(`[data-index="${highlightedIndex}"]`);
      activeOption?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onClick={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="w-full bg-muted/40 border border-border rounded-md h-9 px-3 pr-8 outline-none focus:ring-2 focus:ring-ring text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="absolute right-2 flex items-center pointer-events-none">
          {query ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setQuery("");
                onChange("");
                setIsOpen(true);
                inputRef.current?.focus();
              }}
              className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground pointer-events-auto"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          )}
        </div>
      </div>

      {isOpen && (
        <ul
          className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto py-1"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No results found.</li>
          ) : (
            filteredOptions.map((option, index) => {
              const isSelected = value === option.value;
              const isHighlighted = highlightedIndex === index;
              return (
                <li
                  key={option.value}
                  data-index={index}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`
                    px-3 py-2 text-sm cursor-pointer flex items-center justify-between transition-colors
                    ${isHighlighted ? "bg-muted/60 text-foreground" : "text-foreground"}
                    ${isSelected ? "font-semibold text-primary" : ""}
                  `}
                >
                  {option.label}
                  {isSelected && <Check className="w-4 h-4 text-primary" />}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}