interface AdSlotProps {
  /** Where this placement sits, e.g. "below-hero". Useful when wiring real ad units. */
  id: string;
  label?: string;
  format?: "leaderboard" | "rectangle" | "sidebar" | "in-article";
  className?: string;
}

const HEIGHTS: Record<NonNullable<AdSlotProps["format"]>, string> = {
  leaderboard: "min-h-[72px] md:min-h-[110px]",
  rectangle: "min-h-[200px] sm:min-h-[250px]",
  sidebar: "min-h-[280px] lg:min-h-[600px]",
  "in-article": "min-h-[120px] sm:min-h-[140px]",
};

/**
 * Empty "Advertisement" placeholders hurt AdSense review.
 * Keep this false until real ad units are approved and live.
 * Set NEXT_PUBLIC_SHOW_AD_SLOTS=true only when serving actual ads.
 */
const SHOW_AD_SLOTS = process.env.NEXT_PUBLIC_SHOW_AD_SLOTS === "true";

/**
 * Reserved advertising space. Renders nothing by default so review crawlers
 * never see empty ad boxes mixed into navigation or template grids.
 */
export function AdSlot({
  id,
  label = "Advertisement",
  format = "leaderboard",
  className = "",
}: AdSlotProps) {
  if (!SHOW_AD_SLOTS) return null;

  return (
    <aside
      aria-label={label}
      data-ad-slot={id}
      className={`flex ${HEIGHTS[format]} w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 ${className}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
    </aside>
  );
}
