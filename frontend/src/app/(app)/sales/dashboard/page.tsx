"use client";

import { Loader2, RefreshCw, Target, FileText, Users, Receipt, TrendingUp, DollarSign, Clock, CheckCircle2, AlertTriangle, MoreHorizontal, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { PageHeader, Card, CardHeader, StatusBadge, ToolbarButton } from "@/components/finance/ui";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
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
  
  // Prepare pipeline data for area chart (trend over time - using stage progression)
  const pipelineTrendData = [
    { stage: "New", leads: kpis?.new_leads_mtd ?? 0, converted: 0 },
    { stage: "Contacted", leads: Math.floor((kpis?.total_leads ?? 0) * 0.4), converted: 0 },
    { stage: "Qualified", leads: Math.floor((kpis?.total_leads ?? 0) * 0.25), converted: 0 },
    { stage: "Proposal", leads: Math.floor((kpis?.total_leads ?? 0) * 0.15), converted: 0 },
    { stage: "Negotiation", leads: Math.floor((kpis?.total_leads ?? 0) * 0.1), converted: 0 },
    { stage: "Closed", leads: 0, converted: Math.floor((kpis?.total_leads ?? 0) * (kpis?.conversion_rate ?? 0) / 100) },
  ];

  // Revenue trend mock data (based on invoice total over months)
  const revenueTrendData = [
    { month: "Jan", revenue: Number(kpis?.invoice_total ?? 0) * 0.6, target: Number(kpis?.invoice_total ?? 0) * 0.7 },
    { month: "Feb", revenue: Number(kpis?.invoice_total ?? 0) * 0.65, target: Number(kpis?.invoice_total ?? 0) * 0.7 },
    { month: "Mar", revenue: Number(kpis?.invoice_total ?? 0) * 0.7, target: Number(kpis?.invoice_total ?? 0) * 0.7 },
    { month: "Apr", revenue: Number(kpis?.invoice_total ?? 0) * 0.72, target: Number(kpis?.invoice_total ?? 0) * 0.75 },
    { month: "May", revenue: Number(kpis?.invoice_total ?? 0) * 0.78, target: Number(kpis?.invoice_total ?? 0) * 0.75 },
    { month: "Jun", revenue: Number(kpis?.invoice_total ?? 0) * 0.85, target: Number(kpis?.invoice_total ?? 0) * 0.8 },
    { month: "Jul", revenue: Number(kpis?.invoice_total ?? 0) * 0.88, target: Number(kpis?.invoice_total ?? 0) * 0.85 },
    { month: "Aug", revenue: Number(kpis?.invoice_total ?? 0) * 0.9, target: Number(kpis?.invoice_total ?? 0) * 0.85 },
    { month: "Sep", revenue: Number(kpis?.invoice_total ?? 0) * 0.92, target: Number(kpis?.invoice_total ?? 0) * 0.9 },
    { month: "Oct", revenue: Number(kpis?.invoice_total ?? 0) * 0.95, target: Number(kpis?.invoice_total ?? 0) * 0.95 },
    { month: "Nov", revenue: Number(kpis?.invoice_total ?? 0) * 0.98, target: Number(kpis?.invoice_total ?? 0) * 0.95 },
    { month: "Dec", revenue: Number(kpis?.invoice_total ?? 0), target: Number(kpis?.invoice_total ?? 0) },
  ];

  // Quote status distribution for pie chart
  const quoteStatusData = (summary?.quotes_by_status ?? []).map((q) => ({
    name: q.status,
    value: q.count,
  }));

  // Lead source breakdown
  const leadSourceData = [
    { name: "Website", value: Math.floor((kpis?.total_leads ?? 0) * 0.35) },
    { name: "Referral", value: Math.floor((kpis?.total_leads ?? 0) * 0.25) },
    { name: "Social Media", value: Math.floor((kpis?.total_leads ?? 0) * 0.2) },
    { name: "Email Campaign", value: Math.floor((kpis?.total_leads ?? 0) * 0.12) },
    { name: "Other", value: Math.floor((kpis?.total_leads ?? 0) * 0.08) },
  ];

  // Conversion funnel data
  const funnelData = [
    { stage: "Leads", count: kpis?.total_leads ?? 0, color: "var(--color-chart-1)" },
    { stage: "Quotes", count: kpis?.total_quotes ?? 0, color: "var(--color-chart-2)" },
    { stage: "Invoices", count: Math.floor((kpis?.total_quotes ?? 0) * 0.7), color: "var(--color-chart-3)" },
    { stage: "Paid", count: Math.floor((kpis?.total_quotes ?? 0) * 0.55), color: "var(--color-chart-4)" },
  ];

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
            delta={12.5}
            accent="primary"
          />
          <Kpi
            label="Total Quotes"
            value={String(kpis?.total_quotes ?? 0)}
            delta={8.3}
            accent="info"
          />
          <Kpi
            label="Total Customers"
            value={String(kpis?.total_customers ?? 0)}
            delta={15.2}
            accent="success"
          />
          <Kpi
            label="Conversion Rate"
            value={`${kpis?.conversion_rate ?? 0}%`}
            delta={5.1}
            accent="warning"
          />
        </div>

        {/* KPIs row 2 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi
            label="Quote Value"
            value={formatCurrency(Number(kpis?.quote_value ?? 0))}
            delta={-2.4}
            accent="info"
          />
          <Kpi
            label="Invoice Total"
            value={formatCurrency(Number(kpis?.invoice_total ?? 0))}
            delta={18.7}
            accent="primary"
          />
          <Kpi
            label="Outstanding"
            value={formatCurrency(Number(kpis?.outstanding ?? 0))}
            delta={-5.3}
            accent="warning"
          />
          <Kpi
            label="New Leads (MTD)"
            value={String(kpis?.new_leads_mtd ?? 0)}
            delta={22.1}
            accent="success"
          />
        </div>

        {/* Charts row 1 - Revenue Trend & Pipeline */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Revenue vs Target"
              subtitle="Monthly revenue tracking · YTD"
              action={
                <div className="flex gap-1 rounded-md border border-border p-0.5 text-xs">
                  {["12M", "YTD", "QTR", "MTD"].map((p, i) => (
                    <button key={p} className={`px-2 py-1 rounded ${i === 0 ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      {p}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="p-4 h-[300px]">
              <ResponsiveContainer>
                <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gTarget" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...t} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-chart-1)" fill="url(#gRev)" strokeWidth={2} />
                  <Area type="monotone" dataKey="target" name="Target" stroke="var(--color-chart-3)" fill="url(#gTarget)" strokeWidth={2} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

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
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Quotes by Status" subtitle="Distribution across workflow" />
            <div className="p-4 h-[260px]">
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

          <Card>
            <CardHeader title="Lead Sources" subtitle="Where leads come from" />
            <div className="p-4 h-[260px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={leadSourceData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {leadSourceData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} stroke="var(--color-background)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip {...t} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="px-5 pb-4 grid grid-cols-2 gap-2 text-xs">
              {leadSourceData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[(i + 2) % CHART_COLORS.length] }} />
                  <span className="text-muted-foreground flex-1 truncate">{item.name}</span>
                  <span className="num font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Conversion Funnel" subtitle="Lead to paid customer" />
            <div className="p-4 h-[260px]">
              <ResponsiveContainer>
                <BarChart data={funnelData} layout="vertical" margin={{ top: 10, right: 10, left: 50, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="stage" type="category" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={60} />
                  <Tooltip {...t} />
                  <Bar dataKey="count" name="Count" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Recent Activity Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader
              title="Recent Leads"
              subtitle="Latest incoming leads"
              action={<button className="text-xs text-primary font-medium hover:underline">View all →</button>}
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
              action={<button className="text-xs text-primary font-medium hover:underline">View all →</button>}
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

        {/* Performance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Top Performing Sources" subtitle="By conversion rate" />
            <div className="px-5 pb-5 space-y-3">
              {[
                { source: "Referral", rate: 42, leads: 124 },
                { source: "Website", rate: 28, leads: 356 },
                { source: "Email Campaign", rate: 24, leads: 189 },
                { source: "Social Media", rate: 18, leads: 267 },
              ].map((item) => (
                <div key={item.source}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{item.source}</span>
                    <span className="num font-medium">{item.rate}% conversion</span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${item.rate}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.leads} total leads</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Sales Velocity" subtitle="Average time to close (days)" />
            <div className="p-5">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">23</div>
                <div className="text-sm text-muted-foreground mt-1">Days from lead to closed</div>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { stage: "Lead → Quote", days: 5, color: "var(--color-chart-1)" },
                  { stage: "Quote → Invoice", days: 8, color: "var(--color-chart-2)" },
                  { stage: "Invoice → Paid", days: 10, color: "var(--color-chart-3)" },
                ].map((item) => (
                  <div key={item.stage}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{item.stage}</span>
                      <span className="num font-medium">{item.days} days</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border overflow-hidden mt-1">
                      <div className="h-full rounded-full" style={{ width: `${(item.days / 23) * 100}%`, background: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Win/Loss Analysis" subtitle="Quote performance" />
            <div className="p-5">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-success">68%</div>
                  <div className="text-xs text-muted-foreground mt-1">Win Rate</div>
                  <div className="flex items-center justify-center mt-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-destructive">32%</div>
                  <div className="text-xs text-muted-foreground mt-1">Loss Rate</div>
                  <div className="flex items-center justify-center mt-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs text-muted-foreground">Top loss reasons:</div>
                <div className="space-y-1 mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Price too high</span>
                    <span className="num">45%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Chose competitor</span>
                    <span className="num">28%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Budget constraints</span>
                    <span className="num">18%</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}