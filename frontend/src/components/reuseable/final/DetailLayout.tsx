"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { PageHeader, Card, CardHeader, StatusBadge, ToolbarButton } from "@/components/finance/ui";
import { Printer, Download, Share2, MoreHorizontal, Pencil, Send } from "lucide-react";

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
  value: number;
  sub?: string;
  tone?: "success" | "warning" | "destructive" | "info";
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
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onEdit?: () => void;
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
  primaryActionLabel = "Submit",
  onPrimaryAction,
  onEdit,
  onPrint,
  onExport,
  onShare,
  permissions: propPermissions,
  currencyFormatter = (val) => `$${val.toLocaleString()}`,
}: DetailLayoutProps<T>) {
  const [active, setActive] = useState(tabs[0]?.id);

  const formatValue = (val: any): string => {
    if (typeof val === "number") return currencyFormatter(val);
    if (typeof val === "string") return val;
    return String(val ?? "");
  };

  const renderedSummary = summary?.map((s) => ({
    ...s,
    value: formatValue(s.value),
  }));

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
            <ToolbarButton variant="ghost" icon={MoreHorizontal}>
              More
            </ToolbarButton>
            {propPermissions?.submit && onPrimaryAction && (
              <ToolbarButton variant="primary" icon={Send} onClick={onPrimaryAction}>
                {primaryActionLabel}
              </ToolbarButton>
            )}
          </>
        }
      />
      <div className="p-6 space-y-6">
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
        {renderedSummary && renderedSummary.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {renderedSummary.map((s) => {
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
              return (
                <Card key={s.label} className="px-5 py-4">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{s.label}</div>
                  <div className={`text-2xl font-semibold num tracking-tight mt-1 ${toneColor}`}>{s.value}</div>
                  {s.sub && <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>}
                </Card>
              );
            })}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
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
          </div>
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
  const defaultRisk = [
    { label: "Duplicate check", value: "Clear", tone: "success" as const },
    { label: "Threshold breach", value: "Within limit", tone: "success" as const },
    { label: "FX exposure", value: "Medium", tone: "warning" as const },
    { label: "Segregation of duties", value: "Compliant", tone: "success" as const },
  ];
  const defaultMeta = [
    ["Created", "2026-06-02 14:22"],
    ["Created by", "Sara Romero"],
    ["Modified", "2026-06-02 16:08"],
    ["Modified by", "M. Hughes"],
    ["Source", "Manual"],
    ["Version", "v3"],
  ];
  const riskItems = riskIndicators || defaultRisk;
  const metaItems = metadata || defaultMeta;

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