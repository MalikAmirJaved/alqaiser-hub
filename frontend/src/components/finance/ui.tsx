import type { ReactNode, ButtonHTMLAttributes } from "react";
import { ChevronRight, Download, Plus, Filter, MoreHorizontal } from "lucide-react";

export function PageHeader({
  breadcrumbs,
  title,
  description,
  actions,
}: {
  breadcrumbs: string[];
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-border ">
      <div className="pb-5">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className={i === breadcrumbs.length - 1 ? "text-foreground font-medium" : ""}>{b}</span>
              {i < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
            </span>
          ))}
        </nav>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      </div>
    </div>
  );
}

export function ToolbarButton({
  children,
  variant = "default",
  icon: Icon,
  onClick,
  disabled,
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "default" | "primary" | "ghost";
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const baseClass =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
      : variant === "ghost"
        ? "bg-transparent text-foreground hover:bg-surface-2 border-transparent"
        : "bg-surface text-foreground hover:bg-surface-2 border-border";
  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${baseClass} ${disabledClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Paid: "bg-success/15 text-success border-success/30",
    Posted: "bg-success/15 text-success border-success/30",
    Approved: "bg-success/15 text-success border-success/30",
    Cleared: "bg-success/15 text-success border-success/30",
    Open: "bg-success/15 text-success border-success/30",
    Sent: "bg-info/15 text-info border-info/30",
    Pending: "bg-warning/15 text-warning border-warning/30",
    Partial: "bg-warning/15 text-warning border-warning/30",
    DRAFT: "bg-muted text-muted-foreground border-border",
    UNPAID: "bg-warning/15 text-warning border-warning/30",
    PARTIAL: "bg-warning/15 text-warning border-warning/30",
    PAID: "bg-success/15 text-success border-success/30",
    PENDING: "bg-warning/15 text-warning border-warning/30",
    CANCELLED: "bg-destructive/15 text-destructive border-destructive/30",
    Overdue: "bg-destructive/15 text-destructive border-destructive/30",
    Closed: "bg-muted text-muted-foreground border-border",
    Rejected: "bg-destructive/15 text-destructive border-destructive/30",
    NEW: "bg-info/15 text-info border-info/30",
    CONTACTED: "bg-warning/15 text-warning border-warning/30",
    QUALIFIED: "bg-primary/15 text-primary border-primary/30",
    WON: "bg-success/15 text-success border-success/30",
    LOST: "bg-destructive/15 text-destructive border-destructive/30",
    ACCEPTED: "bg-success/15 text-success border-success/30",
    DECLINED: "bg-destructive/15 text-destructive border-destructive/30",
    EXPIRED: "bg-muted text-muted-foreground border-border",
    REJECTED: "bg-destructive/15 text-destructive border-destructive/30",
    SENT: "bg-info/15 text-info border-info/30",
  };
  const styles = map[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${styles}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function TableToolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface/40">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input
          placeholder="Filter…"
          className="w-64 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary/60"
        />
        <ToolbarButton icon={Filter} variant="ghost">Filters</ToolbarButton>
      </div>
      <div className="flex items-center gap-2">
        {children}
        <ToolbarButton icon={Download} variant="ghost">Export</ToolbarButton>
        <ToolbarButton variant="ghost" icon={MoreHorizontal}><span className="sr-only">More</span></ToolbarButton>
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card ${className}`}>{children}</div>;
}

export function CardHeader({ title, action, subtitle }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between px-5 py-4 border-b border-border">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export { Plus };