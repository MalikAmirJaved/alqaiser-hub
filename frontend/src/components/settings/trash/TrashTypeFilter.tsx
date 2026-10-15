// frontend/src/components/settings/trash/TrashTypeFilter.tsx
"use client";

import { cn } from "@/lib/utils";
import {
  Boxes,
  Building2,
  Landmark,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { TrashGroupCount } from "@/hooks/useTrash";

/** Icon per module group, falling back to a neutral box. */
const GROUP_ICONS: Record<string, LucideIcon> = {
  Settings: Building2,
  Inventory: Boxes,
  Finance: Landmark,
  Sales: TrendingUp,
  "Human Resources": Users,
};

interface TrashTypeFilterProps {
  groups: TrashGroupCount[];
  activeGroup: string;
  totalCount: number;
  onSelect: (group: string) => void;
}

/**
 * Module chips: "All" + one chip per module with its live total, so the page
 * can be narrowed to Inventory / Finance / HR / Sales / Settings at a glance.
 */
export default function TrashTypeFilter({
  groups,
  activeGroup,
  totalCount,
  onSelect,
}: TrashTypeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <GroupChip
        label="All modules"
        count={totalCount}
        active={activeGroup === ""}
        onClick={() => onSelect("")}
        icon={Boxes}
      />

      {groups.map((group) => {
        const active = activeGroup === group.group;
        return (
          <GroupChip
            key={group.group}
            label={group.group}
            count={group.count}
            active={active}
            onClick={() => onSelect(active ? "" : group.group)}
            icon={GROUP_ICONS[group.group] ?? Boxes}
          />
        );
      })}
    </div>
  );
}

function GroupChip({
  label,
  count,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="num text-[11px] opacity-70">{count}</span>
    </button>
  );
}
