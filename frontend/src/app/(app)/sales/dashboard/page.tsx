"use client";

import { Loader2, RefreshCw, MoreHorizontal, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { PageHeader, Card, CardHeader, StatusBadge, ToolbarButton } from "@/components/finance/ui";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useRouter } from "next/navigation";
import {
  useSalesDashboardSummary,
  useSalesPipeline,
  useSalesRecentActivity,
} from "@/hooks/sales/useSalesDashboard";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-info)",
];

function tooltipStyle() {
  return {
    contentStyle: {
      background: "var(--color-popover)",
      border: "1px solid var(--color-border)",
      borderRadius: 8,
      fontSize: 12,
      color: "var(--color-popover-foreground)",
    } as React.CSSProperties,
    labelStyle: { color: "var(--color-muted-foreground)" } as React.CSSProperties,
  };
}

function Kpi({
  label,
  value,
  delta,
  accent = "primary",
}: {
  label: string;
  value: string;
  delta?: number;
  accent?: "primary" | "info" | "warning" | "destructive" | "success";
}) {
  const up = delta !== undefined ? delta >= 0 : false;
  const accentBg: Record<string, string> = {
    primary: "from-primary/20 to-transparent",
    info: "from-info/20 to-transparent",
    warning: "from-warning/20 to-transparent",
    destructive: "from-destructive/20 to-transparent",
    success: "from-success/20 to-transparent",
  };
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${accentBg[accent]} opacity-60 pointer-events-none`} />
      <div className="relative px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div className="text-2xl font-semibold num tracking-tight">{value}</div>
          {delta !== undefined && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium num ${up ? "text-success" : "text-destructive"}`}>
              {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="mt-3 h-1 rounded-full bg-border overflow-hidden">
          <div className={`h-full ${up ? "bg-success" : "bg-destructive"}`} style={{ width: `${Math.min(100, 40 + (delta ? Math.abs(delta) * 3 : 0))}%` }} />
        </div>
      </div>
    </Card>
  );
}

export default function SalesDashboardPage() {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = tooltipStyle();
  
  const { data: summary, isLoading: summaryLoading } = useSalesDashboardSummary();
  const { data: pipeline, isLoading: pipelineLoading } = useSalesPipeline();
  const { data: activity, isLoading: activityLoading } = useSalesRecentActivity();

  const isLoading = summaryLoading || pipelineLoading || activityLoading;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["sales_dashboard_summary"] });
    queryClient.invalidateQueries({ queryKey: ["sales_dashboard_pipeline"] });
    queryClient.invalidateQueries({ queryKey: ["sales_dashboard_recent_activity"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const kpis = summary?.kpis;
  
  // Quote status distribution for pie chart
  const quoteStatusData = (summary?.quotes_by_status ?? []).map((q) => ({
    name: q.status,
    value: q.count,
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={["Sales", "Dashboard"]}
        title="Sales Dashboard"
        description="Live pipeline, quotes, revenue overview, and performance metrics."
        actions={
          <>
            <ToolbarButton icon={RefreshCw} variant="ghost" onClick={refreshAll}>Refresh</ToolbarButton>
          </>
        }
      />

      <div className="pt-6 space-y-6">
        {/* KPIs row 1 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi
            label="Total Leads"
            value={String(kpis?.total_leads ?? 0)}
            accent="primary"
          />
          <Kpi
            label="Total Quotes"
            value={String(kpis?.total_quotes ?? 0)}
            accent="info"
          />
          <Kpi
            label="Total Customers"
            value={String(kpis?.total_customers ?? 0)}
            accent="success"
          />
          <Kpi
            label="Conversion Rate"
            value={`${kpis?.conversion_rate ?? 0}%`}
            accent="warning"
          />
        </div>

        {/* KPIs row 2 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi
            label="Quote Value"
            value={formatCurrency(Number(kpis?.quote_value ?? 0))}
            accent="info"
          />
          <Kpi
            label="Invoice Total"
            value={formatCurrency(Number(kpis?.invoice_total ?? 0))}
            accent="primary"
          />
          <Kpi
            label="Outstanding"
            value={formatCurrency(Number(kpis?.outstanding ?? 0))}
            accent="warning"
          />
          <Kpi
            label="New Leads (MTD)"
            value={String(kpis?.new_leads_mtd ?? 0)}
            accent="success"
          />
        </div>

        {/* Charts row 1 - Pipeline & Quotes */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Lead Pipeline" subtitle="Current stage distribution" />
            <div className="p-4 h-[300px]">
              <ResponsiveContainer>
                <BarChart data={pipeline?.data ?? []} layout="vertical" margin={{ top: 10, right: 10, left: 50, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="stage" type="category" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={80} />
                  <Tooltip {...t} />
                  <Bar dataKey="count" name="Leads" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="px-5 pb-4">
              <div className="text-xs text-muted-foreground text-center">
                Total active leads: {kpis?.total_leads ?? 0}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Quotes by Status" subtitle="Distribution across workflow" />
            <div className="p-4 h-[300px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={quoteStatusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {quoteStatusData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--color-background)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip {...t} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="px-5 pb-4 grid grid-cols-2 gap-2 text-xs">
              {quoteStatusData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-muted-foreground flex-1 truncate">{item.name}</span>
                  <span className="num font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Recent Activity Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader
              title="Recent Leads"
              subtitle="Latest incoming leads"
              action={<button onClick={() => router.push('/sales/leads')} className="text-xs text-primary font-medium hover:underline">View all →</button>}
            />
            <div className="divide-y divide-border">
              {(activity?.leads ?? []).slice(0, 5).map((lead) => (
                <div key={lead.id} className="px-5 py-3 flex items-center justify-between hover:bg-surface-2/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{lead.name}</span>
                      <span className="text-xs text-muted-foreground">{lead.source}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={lead.status} />
                    <button className="text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(activity?.leads ?? []).length === 0 && (
                <div className="px-5 py-6 text-sm text-muted-foreground text-center">No recent leads found.</div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Recent Quotes"
              subtitle="Latest proposals sent"
              action={<button onClick={() => router.push('/sales/quotes')} className="text-xs text-primary font-medium hover:underline">View all →</button>}
            />
            <div className="divide-y divide-border">
              {(activity?.quotes ?? []).slice(0, 5).map((quote) => (
                <div key={quote.id} className="px-5 py-3 flex items-center justify-between hover:bg-surface-2/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium font-mono">{quote.quote_number}</span>
                      <span className="text-xs text-muted-foreground">{quote.customer_name || "Unknown"}</span>
                    </div>
                    <div className="text-xs font-semibold num mt-0.5">
                      {formatCurrency(Number(quote.total_amount))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={quote.status} />
                    <button className="text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(activity?.quotes ?? []).length === 0 && (
                <div className="px-5 py-6 text-sm text-muted-foreground text-center">No recent quotes found.</div>
              )}
            </div>
          </Card>
        </div>

        {/* Performance Summary - computed from live data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Conversion Summary" subtitle="Lead to paid customer" />
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Leads</span>
                <span className="text-2xl font-bold">{kpis?.total_leads ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Quotes</span>
                <span className="text-2xl font-bold">{kpis?.total_quotes ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Conversion Rate</span>
                <span className="text-2xl font-bold text-success">{kpis?.conversion_rate ?? 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Customers</span>
                <span className="text-2xl font-bold">{kpis?.total_customers ?? 0}</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Outstanding Invoices" subtitle="Awaiting payment" />
            <div className="p-5 flex flex-col items-center justify-center h-full">
              <div className="text-4xl font-bold text-warning">{formatCurrency(Number(kpis?.outstanding ?? 0))}</div>
              <div className="text-sm text-muted-foreground mt-2">Out of {formatCurrency(Number(kpis?.invoice_total ?? 0))} total invoiced</div>
              {Number(kpis?.invoice_total) > 0 && (
                <div className="mt-4 w-full h-2 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-warning" style={{ width: `${(Number(kpis?.outstanding ?? 0) / Number(kpis?.invoice_total ?? 1)) * 100}%` }} />
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Paid this Month" subtitle="MTD collections" />
            <div className="p-5 flex flex-col items-center justify-center h-full">
              <div className="text-4xl font-bold text-success">{formatCurrency(Number(kpis?.paid_mtd ?? 0))}</div>
              <div className="text-sm text-muted-foreground mt-2">
                {Number(kpis?.paid_mtd) > 0 && Number(kpis?.invoice_total) > 0 ? 
                  `${((Number(kpis?.paid_mtd) / Number(kpis?.invoice_total)) * 100).toFixed(1)}% of total invoiced` : 
                  "No payments recorded this month"}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}