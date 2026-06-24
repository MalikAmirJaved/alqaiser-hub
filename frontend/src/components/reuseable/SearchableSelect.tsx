"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, X, Check, Loader2 } from "lucide-react";
import { debounce } from "lodash";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: SearchableSelectOption[];
  fetchOptions?: (params: {
    search: string;
    page: number;
    pageSize: number;
  }) => Promise<{
    options: SearchableSelectOption[];
    hasMore: boolean;
    totalCount: number;
  }>;
  pageSize?: number;
  searchDebounceMs?: number;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onAddNew?: () => void;
  addNewLabel?: string;
  displayLabel?: string;
}

export default function SearchableSelect({
  value,
  onChange,
  options: staticOptions,
  fetchOptions,
  pageSize = 20,
  searchDebounceMs = 300,
  required = false,
  placeholder = "Select...",
  disabled = false,
  className = "",
  onAddNew,
  addNewLabel = "Add New",
  displayLabel,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const isAsync = typeof fetchOptions === "function";

  // Async state
  const [asyncOptions, setAsyncOptions] = useState<SearchableSelectOption[]>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [asyncPage, setAsyncPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [asyncSearch, setAsyncSearch] = useState("");
  const loadingMoreRef = useRef(false);

  const asyncPageRef = useRef(asyncPage);
  const hasMoreRef = useRef(hasMore);
  const asyncOptionsRef = useRef(asyncOptions);
  asyncPageRef.current = asyncPage;
  hasMoreRef.current = hasMore;
  asyncOptionsRef.current = asyncOptions;

  const selectedOption = useMemo(() => {
    if (isAsync) return asyncOptions.find((opt) => opt.value === value);
    return staticOptions?.find((opt) => opt.value === value);
  }, [isAsync, asyncOptions, staticOptions, value]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
    } else {
      setQuery(selectedOption ? selectedOption.label : displayLabel || "");
    }
  }, [isOpen, selectedOption, displayLabel]);

  const doFetch = useCallback(
    async (search: string, page: number, append: boolean) => {
      if (!fetchOptions) return;
      setAsyncLoading(true);
      try {
        const result = await fetchOptions({ search, page, pageSize });
        setAsyncOptions((prev) =>
          append ? [...prev, ...result.options] : result.options
        );
        setHasMore(result.hasMore);
      } catch {
        if (!append) setAsyncOptions([]);
        setHasMore(false);
      } finally {
        setAsyncLoading(false);
        loadingMoreRef.current = false;
      }
    },
    [fetchOptions, pageSize]
  );

  const debouncedFetch = useMemo(
    () =>
      debounce((search: string) => {
        setAsyncPage(1);
        doFetch(search, 1, false);
      }, searchDebounceMs),
    [doFetch, searchDebounceMs]
  );

  useEffect(() => {
    if (isOpen && isAsync) {
      setAsyncPage(1);
      setAsyncSearch("");
      doFetch("", 1, false);
    }
    return () => {
      if (isAsync) debouncedFetch.cancel();
    };
  }, [isOpen, isAsync, doFetch, debouncedFetch]);

  const filteredOptions = useMemo(() => {
    if (isAsync) return asyncOptions;
    return (
      staticOptions?.filter((opt) =>
        opt.label.toLowerCase().includes(query.toLowerCase())
      ) ?? []
    );
  }, [isAsync, asyncOptions, staticOptions, query]);

  const handleSelect = (option: SearchableSelectOption) => {
    onChange(option.value);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (val: string) => {
    setQuery(val);
    setHighlightedIndex(-1);
    if (isAsync) {
      setAsyncSearch(val);
      debouncedFetch(val);
    } else {
      setIsOpen(true);
    }
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0) {
      const el = listRef.current?.querySelector<HTMLLIElement>(
        `[data-index="${highlightedIndex}"]`
      );
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  const handleScroll = useCallback(() => {
    if (!isAsync || !hasMoreRef.current || loadingMoreRef.current) return;
    const list = listRef.current;
    if (!list) return;

    const nearBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 40;
    if (nearBottom) {
      loadingMoreRef.current = true;
      const nextPage = asyncPageRef.current + 1;
      asyncPageRef.current = nextPage;
      setAsyncPage(nextPage);
      doFetch(asyncSearch, nextPage, true);
    }
  }, [isAsync, doFetch, asyncSearch]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* INPUT */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : selectedOption?.label || displayLabel || ""}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          onChange={(e) => handleInputChange(e.target.value)}
          onClick={() => !disabled && setIsOpen(true)}
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
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg overflow-hidden">
          {/* Scrollable Options Area */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-60 overflow-y-auto py-1"
          >
            {filteredOptions.length === 0 && !asyncLoading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No results found
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = value === option.value;
                const isHighlighted = highlightedIndex === index;

                return (
                  <div
                    key={`${option.value}-${index}`}
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
                  </div>
                );
              })
            )}

            {asyncLoading && (
              <div className="px-3 py-2 text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading...
              </div>
            )}

            {!asyncLoading && isAsync && hasMore && (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                Scroll for more...
              </div>
            )}
          </div>

          {/* Fixed "Add New" Button at Bottom */}
          {onAddNew && (
            <div className="border-t border-border bg-card sticky bottom-0">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAddNew();
                }}
                className="w-full px-3 py-2.5 text-sm text-primary hover:bg-primary/5 font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {addNewLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}