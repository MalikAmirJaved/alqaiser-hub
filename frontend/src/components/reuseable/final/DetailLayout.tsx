"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { PageHeader, Card, CardHeader, StatusBadge, ToolbarButton } from "@/components/finance/ui";
import { Printer, Download, Share2, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

// Import workflow components
import {
  ApprovalTimeline,
  ApprovalMatrix,
  ActivityFeed,
  AttachmentList,
  AuditTrail,
  CommentsThread,
  RelatedRecords,
  RiskBanner,
  Clock,
  ArrowUpRight,
} from "./workflow";

// ============================================
// Types
// ============================================
export type DetailTab = {
  id: string;
  label: string;
  count?: number;
  render: (data: any) => ReactNode;
};

export interface DetailMeta {
  label: string;
  value: string;
}

export interface DetailSummary {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "success" | "warning" | "destructive" | "info";
  isCurrency?: boolean;
}

export interface ChartConfig {
  id: string;
  title: string;
  subtitle?: string;
  type: "area" | "bar" | "pie" | "line";
  data: any[];
  dataKeys: {
    x?: string;
    y?: string | string[];
    name?: string;
    value?: string;
  };
  colors?: string[];
  height?: number;
  tooltipFormatter?: (value: number, name: string) => string;
}

export interface DetailLayoutProps<T = any> {
  breadcrumbs: string[];
  entityId: string;
  title: string;
  status: string;
  subtitle?: string;
  data: T;
  meta?: DetailMeta[];
  summary?: DetailSummary[];
  tabs: DetailTab[];
  sidebar?: ReactNode;
  charts?: ChartConfig[];  // Charts will be displayed in the left column (above tabs)
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  onPrint?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  permissions?: {
    edit?: boolean;
    delete?: boolean;
    view?: boolean;
    submit?: boolean;
  };
  currencyFormatter?: (value: number) => string;
}

// Default chart colors
const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-info)",
];

function tooltipStyle(formatter?: (value: number, name: string) => string) {
  return {
    contentStyle: {
      background: "var(--color-popover)",
      border: "1px solid var(--color-border)",
      borderRadius: 8,
      fontSize: 12,
      color: "var(--color-popover-foreground)",
    } as React.CSSProperties,
    labelStyle: { color: "var(--color-muted-foreground)" } as React.CSSProperties,
    formatter: formatter,
  };
}

// ============================================
// Main Component
// ============================================
export function DetailLayout<T>({
  breadcrumbs,
  entityId,
  title,
  status,
  subtitle,
  data,
  meta,
  summary,
  tabs,
  sidebar,
  charts,
  primaryActionLabel = "Submit",
  onPrimaryAction,
  onEdit,
  onDelete,
  deleteLabel = "Delete",
  onPrint,
  onExport,
  onShare,
  permissions: propPermissions,
  currencyFormatter = (val) => `$${val.toLocaleString()}`,
}: DetailLayoutProps<T>) {
  const [active, setActive] = useState(tabs[0]?.id);

  const formatValue = (val: any, isCurrency: boolean = false): string => {
    if (isCurrency) {
      const num = typeof val === "string" ? parseFloat(val) : val;
      if (isNaN(num)) return String(val);
      return currencyFormatter(num);
    }
    return String(val ?? "");
  };

  const renderChart = (chart: ChartConfig) => {
    const { type, data: chartData, dataKeys, colors, height = 260, tooltipFormatter: ttFormatter } = chart;
    const t = tooltipStyle(ttFormatter);
    const chartColors = colors || CHART_COLORS;

    switch (type) {
      case "area": {
        const yKeys = Array.isArray(dataKeys.y) ? dataKeys.y : [dataKeys.y];
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                {yKeys.filter((k): k is string => k !== undefined).map((key, idx) => (
                  <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors[idx % chartColors.length]} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={chartColors[idx % chartColors.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={dataKeys.x} stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip {...t} />
              {yKeys.filter((k): k is string => k !== undefined).map((key, idx) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key}
                  stroke={chartColors[idx % chartColors.length]}
                  fill={`url(#grad-${key})`}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );
      }

      case "bar": {
        const yKeys = Array.isArray(dataKeys.y) ? dataKeys.y : [dataKeys.y];
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={dataKeys.x} stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip {...t} />
              {yKeys.filter((k): k is string => k !== undefined).map((key, idx) => (
                <Bar key={key} dataKey={key} name={key} fill={chartColors[idx % chartColors.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      }

      case "pie": {
        const nameKey = dataKeys.name || "name";
        const valueKey = dataKeys.value || "value";
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey={valueKey}
                nameKey={nameKey}
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {chartData.map((_: any, idx: number) => (
                  <Cell key={idx} fill={chartColors[idx % chartColors.length]} stroke="var(--color-background)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip {...t} />
            </PieChart>
          </ResponsiveContainer>
        );
      }

      case "line": {
        const yKeys = Array.isArray(dataKeys.y) ? dataKeys.y : [dataKeys.y];
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={dataKeys.x} stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip {...t} />
              {yKeys.filter((k): k is string => k !== undefined).map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key}
                  stroke={chartColors[idx % chartColors.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      }

      default:
        return <div className="text-center text-muted-foreground">Unsupported chart type</div>;
    }
  };

  return (
    <>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        description={subtitle}
        actions={
          <>
            {onPrint && (
              <ToolbarButton variant="ghost" icon={Printer} onClick={onPrint}>
                Print
              </ToolbarButton>
            )}
            {onExport && (
              <ToolbarButton variant="ghost" icon={Download} onClick={onExport}>
                PDF
              </ToolbarButton>
            )}
            {onShare && (
              <ToolbarButton variant="ghost" icon={Share2} onClick={onShare}>
                Share
              </ToolbarButton>
            )}
            {propPermissions?.edit && onEdit && (
              <ToolbarButton variant="ghost" icon={Pencil} onClick={onEdit}>
                Edit
              </ToolbarButton>
            )}
            {onDelete && (
              <ToolbarButton variant="ghost" icon={Trash2} onClick={onDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                {deleteLabel}
              </ToolbarButton>
            )}
            {propPermissions?.submit && onPrimaryAction && (
              <ToolbarButton variant="primary" icon={Send} onClick={onPrimaryAction}>
                {primaryActionLabel}
              </ToolbarButton>
            )}
          </>
        }
      />
      <div className="pt-6 space-y-6">
        {/* Hero */}
        <Card className="px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-primary">{entityId}</span>
                <StatusBadge status={status} />
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            {meta && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 text-xs">
                {meta.map((m) => (
                  <div key={m.label}>
                    <div className="uppercase tracking-wide text-muted-foreground font-medium">{m.label}</div>
                    <div className="text-sm text-foreground mt-0.5">{formatValue(m.value)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Summary cards */}
        {summary && summary.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summary.map((s) => {
              const toneColor =
                s.tone === "success"
                  ? "text-success"
                  : s.tone === "warning"
                  ? "text-warning"
                  : s.tone === "destructive"
                  ? "text-destructive"
                  : s.tone === "info"
                  ? "text-info"
                  : "text-foreground";
              const formattedValue = s.isCurrency ? formatValue(s.value, true) : formatValue(s.value);
              return (
                <Card key={s.label} className="px-5 py-4">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{s.label}</div>
                  <div className={`text-2xl font-semibold num tracking-tight mt-1 ${toneColor}`}>
                    {formattedValue}
                  </div>
                  {s.sub && <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>}
                </Card>
              );
            })}
          </div>
        )}

        {/* Main Content - Left (Tabs + Charts) + Right (Sidebar) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* LEFT COLUMN (2/3) - Charts + Tabs */}
          <div className="xl:col-span-2 space-y-4">
            {/* Tabs section */}
            <Card>
              <div className="flex items-center gap-1 px-3 pt-3 border-b border-border overflow-x-auto">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActive(t.id)}
                    className={`px-3 py-2 text-sm rounded-t-md border-b-2 whitespace-nowrap transition-colors ${
                      active === t.id
                        ? "border-primary text-foreground font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                    {typeof t.count === "number" && (
                      <span className="ml-1.5 rounded-full bg-surface-2 text-[10px] num px-1.5 py-0.5">{t.count}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="p-5">{tabs.find((t) => t.id === active)?.render(data)}</div>
            </Card>
            {/* Charts section (inside left column) */}
            {charts && charts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {charts.map((chart) => (
                  <Card key={chart.id}>
                    <CardHeader title={chart.title} subtitle={chart.subtitle} />
                    <div className="p-4" style={{ height: `${chart.height || 260}px` }}>
                      {renderChart(chart)}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            
          </div>

          {/* RIGHT COLUMN (1/3) - Sidebar */}
          <div className="space-y-4">{sidebar}</div>
        </div>
      </div>
    </>
  );
}

// ============================================
// StandardSidebar Component
// ============================================
export function StandardSidebar({
  approvers,
  activity,
  riskIndicators,
  metadata,
}: {
  approvers?: ReactNode;
  activity?: ReactNode;
  riskIndicators?: { label: string; value: string; tone?: "success" | "warning" | "destructive" | "info" }[];
  metadata?: [string, string][];
}) {
  const riskItems = riskIndicators || [];
  const metaItems = metadata || [];

  return (
    <>
      <Card>
        <CardHeader title="Approval Status" />
        <div className="p-5">{approvers ?? <ApprovalTimeline />}</div>
      </Card>
      <Card>
        <CardHeader title="Recent Activity" />
        <div className="p-5">{activity ?? <ActivityFeed />}</div>
      </Card>
      <Card>
        <CardHeader title="Risk Indicators" />
        <div className="p-5 space-y-2 text-sm">
          {riskItems.map((r) => {
            const toneClass =
              r.tone === "success"
                ? "text-success"
                : r.tone === "warning"
                ? "text-warning"
                : r.tone === "destructive"
                ? "text-destructive"
                : "text-info";
            return (
              <div key={r.label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{r.label}</span>
                <span className={`font-medium ${toneClass}`}>● {r.value}</span>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <CardHeader title="System Metadata" />
        <div className="p-5 grid grid-cols-2 gap-3 text-xs">
          {metaItems.map(([l, v]) => (
            <div key={l}>
              <div className="uppercase tracking-wide text-muted-foreground font-medium">{l}</div>
              <div className="text-foreground mt-0.5">{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ============================================
// Re-export all workflow components
// ============================================
export {
  ApprovalTimeline,
  ApprovalMatrix,
  ActivityFeed,
  AttachmentList,
  AuditTrail,
  CommentsThread,
  RelatedRecords,
  RiskBanner,
  Clock,
  ArrowUpRight,
};