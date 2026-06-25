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
  onOptionSelect?: (option: SearchableSelectOption) => void;
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
  onOptionSelect,
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
  // Whether the dropdown should open upward (flip) instead of downward
  const [dropUp, setDropUp] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const isAsync = typeof fetchOptions === "function";

  const fetchOptionsRef = useRef(fetchOptions);
  fetchOptionsRef.current = fetchOptions;

  // Async state
  const [asyncOptions, setAsyncOptions] = useState<SearchableSelectOption[]>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [asyncPage, setAsyncPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [asyncSearch, setAsyncSearch] = useState("");
  const loadingMoreRef = useRef(false);

  // Cache the last explicitly selected option so it survives page/search resets
  const [cachedSelectedOption, setCachedSelectedOption] =
    useState<SearchableSelectOption | null>(null);

  const asyncPageRef = useRef(asyncPage);
  const hasMoreRef = useRef(hasMore);
  const asyncOptionsRef = useRef(asyncOptions);
  const initialLoadDoneRef = useRef(false);
  const prevValueRef = useRef(value);
  asyncPageRef.current = asyncPage;
  hasMoreRef.current = hasMore;
  asyncOptionsRef.current = asyncOptions;

  // Reset initialLoadDone when value changes (for edit forms where value changes after mount)
  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      if (value) {
        initialLoadDoneRef.current = false;
      }
    }
  }, [value]);

  // Seed the cache from displayLabel when value is pre-populated (edit forms)
  // so the label shows correctly before the user ever opens the dropdown
  useEffect(() => {
    if (value && displayLabel && cachedSelectedOption?.value !== value) {
      setCachedSelectedOption({ value, label: displayLabel });
    }
  }, [value, displayLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear the cache when value is cleared externally
  useEffect(() => {
    if (!value) {
      setCachedSelectedOption(null);
    }
  }, [value]);

  const selectedOption = useMemo(() => {
    if (isAsync) {
      // Prefer the live list (most up-to-date label)
      const found = asyncOptions.find((opt) => opt.value === value);
      if (found) return found;
      // Fall back to the cached option so the display doesn't go blank
      // after a search/scroll refreshes asyncOptions
      if (cachedSelectedOption?.value === value) return cachedSelectedOption;
      return undefined;
    }
    return staticOptions?.find((opt) => opt.value === value);
  }, [isAsync, asyncOptions, staticOptions, value, cachedSelectedOption]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
    } else {
      setQuery(selectedOption ? selectedOption.label : displayLabel || "");
    }
  }, [isOpen, selectedOption, displayLabel]);

  const doFetch = useCallback(
    async (search: string, page: number, append: boolean) => {
      const fn = fetchOptionsRef.current;
      if (!fn) return;
      setAsyncLoading(true);
      try {
        const result = await fn({ search, page, pageSize });
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
    [pageSize]
  );

  const debouncedFetch = useMemo(
    () =>
      debounce((search: string) => {
        setAsyncPage(1);
        doFetch(search, 1, false);
      }, searchDebounceMs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchDebounceMs]
  );

  // Load initial options when async and a value is set (e.g. edit form)
  useEffect(() => {
    if (isAsync && value && !initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      doFetch("", 1, false);
    }
  }, [isAsync, value, doFetch]);

  // Fetch on dropdown open
  useEffect(() => {
    if (isOpen && isAsync) {
      setAsyncPage(1);
      setAsyncSearch("");
      doFetch("", 1, false);
    }
    return () => {
      debouncedFetch.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isAsync]);

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
    // Cache the selected option so it survives asyncOptions being refreshed
    // (e.g. user searched or scrolled to find this item, then the list resets)
    setCachedSelectedOption(option);
    if (onOptionSelect) {
      onOptionSelect(option);
    }
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

  // Trap wheel scroll inside the dropdown so it doesn't bubble to the page/modal
  useEffect(() => {
    const list = listRef.current;
    if (!list || !isOpen) return;

    const onWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = list;
      const atTop = scrollTop === 0 && e.deltaY < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight && e.deltaY > 0;
      // Stop propagation whenever the list is scrollable so the parent never moves
      if (scrollHeight > clientHeight && !atTop && !atBottom) {
        e.stopPropagation();
      } else if (scrollHeight > clientHeight) {
        // At a boundary — still stop so the parent form doesn't jump
        e.stopPropagation();
      }
    };

    list.addEventListener("wheel", onWheel, { passive: false });
    return () => list.removeEventListener("wheel", onWheel);
  }, [isOpen]);

  // Detect available space below/above and flip the dropdown upward if needed
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const DROPDOWN_HEIGHT = 260; // matches max-h-60 (240px) + border/padding buffer
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    setDropUp(spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow);
  }, [isOpen]);

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

    const nearBottom =
      list.scrollTop + list.clientHeight >= list.scrollHeight - 40;
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
                setCachedSelectedOption(null);
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

      {/* DROPDOWN — flips upward when near bottom of viewport */}
      {isOpen && (
        <div className={`absolute z-50 w-full bg-card border border-border rounded-md shadow-lg overflow-hidden ${dropUp ? "bottom-full mb-1" : "top-full mt-1"}`}>
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
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
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