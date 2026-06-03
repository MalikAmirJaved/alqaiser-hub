"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { PageHeader, Card, CardHeader, StatusBadge, ToolbarButton } from "@/components/finance/ui";
import { ApprovalTimeline, ActivityFeed, AttachmentList, AuditTrail, CommentsThread } from "./workflow";
import { Printer, Download, Share2, MoreHorizontal, Pencil, Send } from "lucide-react";

export type DetailTab = { id: string; label: string; count?: number; render: () => ReactNode };

export function DetailLayout({
  breadcrumbs,
  entityId,
  title,
  status,
  subtitle,
  meta,
  summary,
  tabs,
  sidebar,
  primaryAction = "Submit",
  onEdit,
}: {
  breadcrumbs: string[];
  entityId: string;
  title: string;
  status: string;
  subtitle?: string;
  meta?: { label: string; value: string }[];
  summary?: { label: string; value: string; sub?: string; tone?: "success" | "warning" | "destructive" | "info" }[];
  tabs: DetailTab[];
  sidebar?: ReactNode;
  primaryAction?: string;
  onEdit?: () => void;
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  return (
    <>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        description={subtitle}
        actions={
          <>
            <ToolbarButton variant="ghost" icon={Printer}>Print</ToolbarButton>
            <ToolbarButton variant="ghost" icon={Download}>PDF</ToolbarButton>
            <ToolbarButton variant="ghost" icon={Share2}>Share</ToolbarButton>
            <ToolbarButton variant="ghost" icon={Pencil}>Edit</ToolbarButton>
            <ToolbarButton variant="ghost" icon={MoreHorizontal}>More</ToolbarButton>
            <ToolbarButton variant="primary" icon={Send}>{primaryAction}</ToolbarButton>
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
                    <div className="text-sm text-foreground mt-0.5">{m.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summary.map((s) => {
              const tone = s.tone === "success" ? "text-success" : s.tone === "warning" ? "text-warning"
                : s.tone === "destructive" ? "text-destructive" : s.tone === "info" ? "text-info" : "text-foreground";
              return (
                <Card key={s.label} className="px-5 py-4">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{s.label}</div>
                  <div className={`text-2xl font-semibold num tracking-tight mt-1 ${tone}`}>{s.value}</div>
                  {s.sub && <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>}
                </Card>
              );
            })}
          </div>
        )}

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
              <div className="p-5">{tabs.find((t) => t.id === active)?.render()}</div>
            </Card>
          </div>
          <div className="space-y-4">{sidebar}</div>
        </div>
      </div>
    </>
  );
}

export function StandardSidebar({ approvers, activity }: { approvers?: ReactNode; activity?: ReactNode } = {}) {
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
          {[
            { l: "Duplicate check", v: "Clear", t: "text-success" },
            { l: "Threshold breach", v: "Within limit", t: "text-success" },
            { l: "FX exposure", v: "Medium", t: "text-warning" },
            { l: "Segregation of duties", v: "Compliant", t: "text-success" },
          ].map((r) => (
            <div key={r.l} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{r.l}</span>
              <span className={`font-medium ${r.t}`}>● {r.v}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="System Metadata" />
        <div className="p-5 grid grid-cols-2 gap-3 text-xs">
          {[
            ["Created", "2026-06-02 14:22"],
            ["Created by", "Sara Romero"],
            ["Modified", "2026-06-02 16:08"],
            ["Modified by", "M. Hughes"],
            ["Source", "Manual"],
            ["Version", "v3"],
          ].map(([l, v]) => (
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

export { ApprovalTimeline, ActivityFeed, AttachmentList, AuditTrail, CommentsThread };
