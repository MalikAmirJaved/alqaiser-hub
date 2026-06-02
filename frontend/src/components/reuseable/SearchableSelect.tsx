"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Check } from "lucide-react";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  required = false,
  placeholder = "Select...",
  disabled = false,
  className = "",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Get selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // 🔥 Sync input display based on open/close state
  useEffect(() => {
    if (isOpen) {
      setQuery(""); // always empty when opening dropdown
    } else {
      setQuery(selectedOption ? selectedOption.label : "");
    }
  }, [isOpen, selectedOption]);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (option: SearchableSelectOption) => {
    onChange(option.value);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();

      if (!isOpen) setIsOpen(true);
      if (filteredOptions.length === 0) return;

      setHighlightedIndex((prev) => {
        if (e.key === "ArrowDown") {
          return prev < filteredOptions.length - 1 ? prev + 1 : 0;
        }
        return prev > 0 ? prev - 1 : filteredOptions.length - 1;
      });
    }

    if (e.key === "Enter") {
      e.preventDefault();

      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
        return;
      }

      const selected = filteredOptions[highlightedIndex];
      if (selected) handleSelect(selected);
    }

    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // scroll active item
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0) {
      const el = containerRef.current?.querySelector<HTMLLIElement>(
        `[data-index="${highlightedIndex}"]`
      );
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* INPUT */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : (selectedOption?.label || "")}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onClick={() => {
            if (!disabled) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-muted/40 border border-border rounded-md h-9 px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="absolute right-2 flex items-center">
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setQuery("");
                setIsOpen(false);
              }}
              className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* DROPDOWN */}
      {isOpen && (
        <ul className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto py-1">
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              No results found
            </li>
          ) : (
            filteredOptions.map((option, index) => {
              const isSelected = value === option.value;
              const isHighlighted = highlightedIndex === index;

              return (
                <li
                  key={option.value}
                  data-index={index}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(option);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-3 py-2 text-sm cursor-pointer flex justify-between
                    ${isHighlighted ? "bg-muted/60" : ""}
                    ${isSelected ? "font-semibold text-primary" : ""}
                  `}
                >
                  {option.label}
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}