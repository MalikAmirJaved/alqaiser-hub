"use client";

import { Loader2, RefreshCw, ArrowUpRight, ArrowDownRight, MoreHorizontal, AlertTriangle, CheckCircle2, TrendingUp, DollarSign, Package, Users, ShoppingCart, CreditCard, Warehouse, Truck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, LineChart, Line, Legend,
} from "recharts";
import { PageHeader, Card, CardHeader, StatusBadge, ToolbarButton } from "@/components/finance/ui";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import {
  useOverallSummary,
  useOverallTrends,
  useOverallRecentActivity,
  useOverallAlerts,
} from "@/hooks/overall/useOverallDashboard";

// Chart colors (same as other dashboards)
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

export default function OverallDashboardPage() {
  const formatCurrency = useFormatCurrency();
  const queryClient = useQueryClient();
  const t = tooltipStyle();

  const { data: summary, isLoading: summaryLoading } = useOverallSummary();
  const { data: trends, isLoading: trendsLoading } = useOverallTrends();
  const { data: recentActivity, isLoading: recentLoading } = useOverallRecentActivity();
  const { data: alerts, isLoading: alertsLoading } = useOverallAlerts();

  const isLoading = summaryLoading || trendsLoading || recentLoading || alertsLoading;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["overall_dashboard_summary"] });
    queryClient.invalidateQueries({ queryKey: ["overall_dashboard_trends"] });
    queryClient.invalidateQueries({ queryKey: ["overall_dashboard_recent_activity"] });
    queryClient.invalidateQueries({ queryKey: ["overall_dashboard_alerts"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const finance = summary?.finance;
  const inventory = summary?.inventory;
  const sales = summary?.sales;

  // Prepare chart data
  const revenueExpenseData = trends?.revenue_expense ?? [];
  const salesPurchasesData = trends?.sales_purchases ?? [];
  const stockMovementData = trends?.stock_movement ?? [];

  return (
    <>
      <PageHeader
        breadcrumbs={["Dashboard", "Overview"]}
        title="Business Dashboard"
        description="Unified view of finance, inventory, and sales metrics."
        actions={
          <>
            <ToolbarButton icon={RefreshCw} variant="ghost" onClick={refreshAll}>Refresh</ToolbarButton>
          </>
        }
      />

      <div className="pt-6 space-y-6">
        {/* Section: Finance KPIs */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Finance
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Revenue (MTD)" value={formatCurrency(Number(finance?.revenue_mtd ?? 0))} accent="primary" />
            <Kpi label="Expenses (MTD)" value={formatCurrency(Number(finance?.expenses_mtd ?? 0))} accent="warning" />
            <Kpi label="Net Profit (MTD)" value={formatCurrency(Number(finance?.net_profit_mtd ?? 0))} accent="success" />
            <Kpi label="Cash Position" value={formatCurrency(Number(finance?.cash_position ?? 0))} accent="info" />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Kpi label="Receivables" value={formatCurrency(Number(finance?.receivables ?? 0))} accent="info" />
            <Kpi label="Payables" value={formatCurrency(Number(finance?.payables ?? 0))} accent="warning" />
          </div>
        </div>

        {/* Section: Inventory KPIs */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" /> Inventory
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Total Variants" value={String(inventory?.total_variants ?? 0)} accent="primary" />
            <Kpi label="Stock Value" value={formatCurrency(Number(inventory?.total_stock_value ?? 0))} accent="success" />
            <Kpi label="Low Stock Items" value={String(inventory?.low_stock_count ?? 0)} accent="warning" />
            <Kpi label="Sales YTD" value={formatCurrency(Number(inventory?.total_sales_amount_ytd ?? 0))} accent="primary" />
          </div>
          <div className="mt-4">
            <Kpi label="Purchases YTD" value={formatCurrency(Number(inventory?.total_purchase_amount_ytd ?? 0))} accent="info" />
          </div>
        </div>

        {/* Section: Sales KPIs */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Sales
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Total Leads" value={String(sales?.total_leads ?? 0)} accent="primary" />
            <Kpi label="New Leads (MTD)" value={String(sales?.new_leads_mtd ?? 0)} accent="success" />
            <Kpi label="Total Quotes" value={String(sales?.total_quotes ?? 0)} accent="info" />
            <Kpi label="Quote Value" value={formatCurrency(Number(sales?.quote_value ?? 0))} accent="primary" />
          </div>
          <div className="mt-4">
            <Kpi label="Conversion Rate" value={`${sales?.conversion_rate ?? 0}%`} accent="warning" />
          </div>
        </div>

        {/* Charts Row 1 - Revenue vs Expense & Sales vs Purchases */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Revenue vs Expense" subtitle="Trailing 12 months" />
            <div className="p-4 h-[300px]">
              <ResponsiveContainer>
                <AreaChart data={revenueExpenseData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...t} formatter={(v: any) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-chart-1)" fill="url(#gRev)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expense" name="Expense" stroke="var(--color-chart-3)" fill="url(#gExp)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Sales vs Purchases" subtitle="Monthly comparison" />
            <div className="p-4 h-[300px]">
              <ResponsiveContainer>
                <BarChart data={salesPurchasesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...t} formatter={(v: any) => formatCurrency(v)} />
                  <Bar dataKey="sales" name="Sales" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="purchases" name="Purchases" fill="var(--color-chart-5)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Charts Row 2 - Stock Movement */}
        <Card>
          <CardHeader title="Stock Movement" subtitle="Incoming vs Outgoing quantity (last 6 months)" />
          <div className="p-4 h-[300px]">
            <ResponsiveContainer>
              <AreaChart data={stockMovementData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...t} />
                <Area type="monotone" dataKey="incoming" name="Incoming" stroke="var(--color-chart-1)" fill="url(#gIn)" strokeWidth={2} />
                <Area type="monotone" dataKey="outgoing" name="Outgoing" stroke="var(--color-chart-3)" fill="url(#gOut)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent Activity Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Recent Payments" subtitle="Latest confirmed transactions" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left">Ref</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-left">Type</th>
                   </tr>
                </thead>
                <tbody>
                  {(recentActivity?.payments ?? []).map((p) => (
                    <tr key={p.id} className="border-b border-border/60">
                      <td className="px-4 py-2 font-mono text-xs">{p.reference || p.id.slice(-6)}</td>
                      <td className="px-4 py-2">{p.date}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(Number(p.amount))}</td>
                      <td className="px-4 py-2"><StatusBadge status={p.type.toLowerCase()} /></td>
                     </tr>
                  ))}
                  {(recentActivity?.payments ?? []).length === 0 && (
                    <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">No recent payments</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent Sales Orders" subtitle="Completed orders" />
            <div className="divide-y divide-border">
              {(recentActivity?.sales_orders ?? []).map((order) => (
                <div key={order.id} className="px-5 py-3 flex justify-between items-center">
                  <div>
                    <div className="font-mono text-sm">{order.number}</div>
                    <div className="text-xs text-muted-foreground">{order.customer || "Walk-in"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(Number(order.total))}</div>
                    <div className="text-xs text-muted-foreground">{order.date}</div>
                  </div>
                </div>
              ))}
              {(recentActivity?.sales_orders ?? []).length === 0 && (
                <div className="px-5 py-4 text-center text-muted-foreground">No recent sales orders</div>
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Recent Stock Movements" />
            <div className="divide-y divide-border">
              {(recentActivity?.stock_transactions ?? []).map((tx) => (
                <div key={tx.id} className="px-5 py-3 flex justify-between items-center">
                  <div>
                    <div className="font-mono text-sm">{tx.variant}</div>
                    <div className="text-xs text-muted-foreground">{tx.type}</div>
                  </div>
                  <div className={`text-right font-semibold ${tx.change > 0 ? "text-success" : "text-destructive"}`}>
                    {tx.change > 0 ? `+${tx.change}` : tx.change}
                    <div className="text-xs text-muted-foreground font-normal">{tx.date}</div>
                  </div>
                </div>
              ))}
              {(recentActivity?.stock_transactions ?? []).length === 0 && (
                <div className="px-5 py-4 text-center text-muted-foreground">No recent stock movements</div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent Leads & Quotes" />
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground px-5 pt-2">Leads</div>
                {recentActivity?.leads?.slice(0, 3).map((lead) => (
                  <div key={lead.id} className="px-5 py-2 flex justify-between items-center">
                    <span>{lead.name}</span>
                    <StatusBadge status={lead.status} />
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground px-5">Quotes</div>
                {recentActivity?.quotes?.slice(0, 3).map((quote) => (
                  <div key={quote.id} className="px-5 py-2 flex justify-between items-center">
                    <span className="font-mono text-sm">{quote.number}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatCurrency(Number(quote.total))}</span>
                      <StatusBadge status={quote.status} />
                    </div>
                  </div>
                ))}
              </div>
              {(!recentActivity?.leads?.length && !recentActivity?.quotes?.length) && (
                <div className="px-5 py-4 text-center text-muted-foreground">No recent leads or quotes</div>
              )}
            </div>
          </Card>
        </div>

        {/* Alerts Panel */}
        {alerts && alerts.length > 0 && (
          <Card>
            <CardHeader title="System Alerts" subtitle="Priority notifications" />
            <div className="divide-y divide-border">
              {alerts.map((alert, idx) => (
                <div key={idx} className="px-5 py-3 flex items-start gap-3">
                  <div className={`mt-0.5 w-2 h-2 rounded-full ${
                    alert.severity === "critical" ? "bg-destructive" :
                    alert.severity === "warning" ? "bg-warning" : "bg-info"
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{alert.title}</span>
                      <StatusBadge status={alert.severity} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}