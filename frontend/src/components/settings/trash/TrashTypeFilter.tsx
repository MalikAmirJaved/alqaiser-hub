// frontend/src/components/settings/trash/TrashTypeFilter.tsx
"use client";

import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import type { TrashTypeCount } from "@/hooks/useTrash";

interface TrashTypeFilterProps {
  types: TrashTypeCount[];
  activeType: string;
  totalCount: number;
  expiredCount: number;
  onSelect: (type: string) => void;
  showExpiredOnly: boolean;
  onToggleExpired: () => void;
}

/**
 * Filter chips: "All" + one chip per trash type with a live count, plus a
 * toggle for items that have already passed the retention window.
 */
export default function TrashTypeFilter({
  types,
  activeType,
  totalCount,
  expiredCount,
  onSelect,
  showExpiredOnly,
  onToggleExpired,
}: TrashTypeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onSelect("")}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors",
          activeType === ""
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        All
        <span className="num text-[11px] opacity-70">{totalCount}</span>
      </button>

      {types.map((type) => {
        const active = activeType === type.key;
        return (
          <button
            key={type.key}
            type="button"
            onClick={() => onSelect(active ? "" : type.key)}
            title={type.group}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {type.label}
            <span className="num text-[11px] opacity-70">{type.count}</span>
            {type.expired > 0 && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-destructive"
                title={`${type.expired} expired`}
              />
            )}
          </button>
        );
      })}

      {expiredCount > 0 && (
        <button
          type="button"
          onClick={onToggleExpired}
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors ml-auto",
            showExpiredOnly
              ? "border-destructive bg-destructive/10 text-destructive"
              : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
          title="Show only items that have passed the retention window"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Expired only
          <span className="num text-[11px] opacity-70">{expiredCount}</span>
        </button>
      )}
    </div>
  );
}
