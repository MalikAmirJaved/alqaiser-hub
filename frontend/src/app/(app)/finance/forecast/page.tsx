"use client";

import { useMemo, useState } from "react";
import {
  Loader2, RefreshCw, TrendingUp, Sparkles, Target, Package, ArrowUpRight, ArrowDownRight, Calendar, Layers,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend, ComposedChart,
} from "recharts";
import { PageHeader, Card, CardHeader, StatusBadge, ToolbarButton } from "@/components/finance/ui";
import {
  useSalesForecast,
  useStockForecast,
  useSalesForecastAnalytics,
  useStockForecastSummary,
  useRegenerateSalesForecast,
  useRegenerateStockForecast,
  type SalesForecast,
  type StockForecast,
} from "@/hooks/finance/useForecast";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

// ------------------------------------------------------------
// Chart palette + tooltip styling
// ------------------------------------------------------------
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
  sub,
  delta,
  accent = "primary",
}: {
  label: string;
  value: string;
  sub?: string;
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
          {delta !== undefined && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium num ${up ? "text-success" : "text-destructive"}`}>
              {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="mt-2 text-2xl font-semibold num tracking-tight">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        <div className="mt-3 h-1 rounded-full bg-border overflow-hidden">
          <div className={`h-full ${up ? "bg-success" : "bg-destructive"}`} style={{ width: `${Math.min(100, 40 + (delta ? Math.abs(delta) * 3 : 0))}%` }} />
        </div>
      </div>
    </Card>
  );
}

function MethodBadge({ method }: { method: string }) {
  const map: Record<string, string> = {
    MOVING_AVERAGE: "bg-info/15 text-info border-info/30",
    EXPONENTIAL_SMOOTHING: "bg-primary/15 text-primary border-primary/30",
    LINEAR_REGRESSION: "bg-warning/15 text-warning border-warning/30",
  };
  const cls = map[method] ?? "bg-muted text-muted-foreground border-border";
  const label = method.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function confidenceTone(c: number) {
  if (c >= 0.8) return "text-success";
  if (c >= 0.5) return "text-warning";
  return "text-destructive";
}

// ------------------------------------------------------------
// Main page
// ------------------------------------------------------------
type Tab = "sales" | "stock";
type Granularity = "daily" | "weekly" | "monthly";

export default function SalesForecastPage() {
  const queryClient = useQueryClient();
  const permissions = useFeaturePermissions("INVENTORY", "forecast");

  const [tab, setTab] = useState<Tab>("sales");
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const {
    data: salesForecasts,
    isLoading: salesLoading,
  } = useSalesForecast();
  const {
    data: stockForecasts,
    isLoading: stockLoading,
  } = useStockForecast();
  const {
    data: analytics,
    isLoading: analyticsLoading,
  } = useSalesForecastAnalytics({ granularity, top_n: 8 });
  const {
    data: stockSummary,
    isLoading: stockSummaryLoading,
  } = useStockForecastSummary();

  const regenSales = useRegenerateSalesForecast();
  const regenStock = useRegenerateStockForecast();

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["sales-forecast"] });
    queryClient.invalidateQueries({ queryKey: ["sales-forecast-analytics"] });
    queryClient.invalidateQueries({ queryKey: ["stock-forecast"] });
    queryClient.invalidateQueries({ queryKey: ["stock-forecast-summary"] });
  };

  // ---- derived KPIs ---------------------------------------------------
  const totals = analytics?.totals;
  const stockTotals = stockSummary?.totals;

  // Approximate "horizon growth" delta for the time-series: last bucket vs first
  const horizonDelta = useMemo(() => {
    const series = analytics?.timeline ?? [];
    if (series.length < 2) return undefined;
    const first = series[0].predicted;
    const last = series[series.length - 1].predicted;
    if (!first) return undefined;
    return ((last - first) / first) * 100;
  }, [analytics?.timeline]);

  const kpis = [
    {
      label: "Total Predicted Units",
      value: (totals?.predicted_total ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      sub: `${totals?.records ?? 0} forecast records`,
      accent: "primary" as const,
      delta: horizonDelta,
    },
    {
      label: "Avg. Confidence",
      value: `${((totals?.confidence_avg ?? 0) * 100).toFixed(0)}%`,
      sub: `${totals?.skus ?? 0} variants`,
      accent: "info" as const,
    },
    {
      label: "Reorder Required",
      value: (stockTotals?.reorder_total ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      sub: `${stockTotals?.warehouses ?? 0} warehouses`,
      accent: "warning" as const,
    },
    {
      label: "Projected Closing Stock",
      value: (stockTotals?.projected_total ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      sub: `${stockTotals?.items ?? 0} entries`,
      accent: "success" as const,
    },
  ];

  const isLoading = salesLoading || stockLoading || analyticsLoading || stockSummaryLoading;

  return (
    <>
      <PageHeader
        breadcrumbs={["Finance", "Forecast"]}
        title="Sales & Stock Forecast"
        description="Predicted demand, confidence ranges, and stock projections for the next horizon."
        actions={
          <>
            <ToolbarButton
              icon={RefreshCw}
              variant="ghost"
              onClick={() => regenSales.mutate()}
              disabled={regenSales.isPending || !permissions.update}
              title="Recompute sales forecasts"
            >
              {regenSales.isPending ? "Recomputing…" : "Recompute Sales"}
            </ToolbarButton>
            <ToolbarButton
              icon={RefreshCw}
              variant="ghost"
              onClick={() => regenStock.mutate()}
              disabled={regenStock.isPending || !permissions.update}
              title="Recompute stock forecasts"
            >
              {regenStock.isPending ? "Recomputing…" : "Recompute Stock"}
            </ToolbarButton>
            <button
              onClick={refreshAll}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-accent transition"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </>
        }
      />

      <div className="pt-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-[40vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpis.map((k) => (
                <Kpi key={k.label} {...k} />
              ))}
            </div>

            {/* Charts row 1 */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {/* Forecast timeline (area with confidence band) */}
              <Card className="xl:col-span-2">
                <CardHeader
                  title="Predicted Demand Over Time"
                  subtitle={`${granularity[0].toUpperCase() + granularity.slice(1)} · ${totals?.date_start ?? "—"} → ${totals?.date_end ?? "—"}`}
                  action={
                    <div className="flex gap-1 rounded-md border border-border p-0.5 text-xs">
                      {(["daily", "weekly", "monthly"] as Granularity[]).map((g) => (
                        <button
                          key={g}
                          onClick={() => setGranularity(g)}
                          className={`px-2 py-1 rounded ${granularity === g
                            ? "bg-surface-2 text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          {g[0].toUpperCase() + g.slice(1)}
                        </button>
                      ))}
                    </div>
                  }
                />
                <div className="p-4 h-[320px]">
                  {(analytics?.timeline ?? []).length === 0 ? (
                    <EmptyChart label="No forecast data for the selected period" />
                  ) : (
                    <ResponsiveContainer>
                      <AreaChart
                        data={analytics!.timeline}
                        margin={{ top: 10, right: 16, left: -10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="gPred" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.55} />
                            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke="var(--color-muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip {...tooltipStyle()} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area
                          type="monotone"
                          dataKey="upper"
                          name="Upper bound"
                          stroke="var(--color-chart-3)"
                          strokeDasharray="4 4"
                          fill="url(#gBand)"
                          strokeWidth={1.5}
                        />
                        <Area
                          type="monotone"
                          dataKey="lower"
                          name="Lower bound"
                          stroke="var(--color-chart-3)"
                          strokeDasharray="4 4"
                          fill="transparent"
                          strokeWidth={1.5}
                        />
                        <Area
                          type="monotone"
                          dataKey="predicted"
                          name="Predicted"
                          stroke="var(--color-chart-1)"
                          fill="url(#gPred)"
                          strokeWidth={2.5}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              {/* Method mix pie */}
              <Card>
                <CardHeader
                  title="Forecast Method Mix"
                  subtitle="Distribution by volume"
                />
                <div className="p-4 h-[220px]">
                  {(analytics?.method_mix ?? []).length === 0 ? (
                    <EmptyChart label="No data" />
                  ) : (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={analytics!.method_mix}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={85}
                          paddingAngle={2}
                        >
                          {(analytics!.method_mix).map((_, i) => (
                            <Cell
                              key={i}
                              fill={CHART_COLORS[i % CHART_COLORS.length]}
                              stroke="var(--color-background)"
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                        <Tooltip {...tooltipStyle()} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="px-5 pb-4 grid grid-cols-1 gap-1.5 text-xs">
                  {(analytics?.method_mix ?? []).map((m, i) => (
                    <div key={m.name} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="text-muted-foreground flex-1 truncate">{m.name.replace(/_/g, " ")}</span>
                      <span className="num font-medium">{m.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Charts row 2 */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {/* Top SKUs bar */}
              <Card className="xl:col-span-2">
                <CardHeader
                  title="Top Variants by Predicted Volume"
                  subtitle="Largest contributors to the forecast"
                />
                <div className="p-4 h-[300px]">
                  {(analytics?.top_skus ?? []).length === 0 ? (
                    <EmptyChart label="No SKU breakdown available" />
                  ) : (
                    <ResponsiveContainer>
                      <BarChart
                        data={analytics!.top_skus}
                        layout="vertical"
                        margin={{ top: 5, right: 16, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis
                          dataKey="sku"
                          type="category"
                          stroke="var(--color-muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={120}
                        />
                        <Tooltip
                          {...tooltipStyle()}
                          formatter={(v: any, n: any) => [Number(v).toLocaleString(), n]}
                        />
                        <Bar
                          dataKey="predicted"
                          name="Predicted units"
                          fill="var(--color-chart-1)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              {/* Confidence distribution */}
              <Card>
                <CardHeader
                  title="Confidence Distribution"
                  subtitle="Bands across all forecasts"
                />
                <div className="p-4 h-[300px]">
                  {(analytics?.confidence ?? []).every((b) => b.count === 0) ? (
                    <EmptyChart label="No confidence data" />
                  ) : (
                    <ResponsiveContainer>
                      <BarChart
                        data={analytics!.confidence}
                        margin={{ top: 10, right: 8, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="bucket"
                          stroke="var(--color-muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="var(--color-muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip {...tooltipStyle()} />
                        <Bar dataKey="count" name="Forecasts" radius={[4, 4, 0, 0]}>
                          {analytics!.confidence.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>

            {/* Charts row 3 — Stock projections */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card className="xl:col-span-2">
                <CardHeader
                  title="Projected Stock vs Reorder by Warehouse"
                  subtitle="Stock-on-hand coverage across the network"
                />
                <div className="p-4 h-[300px]">
                  {(stockSummary?.by_warehouse ?? []).length === 0 ? (
                    <EmptyChart label="No stock forecast data" />
                  ) : (
                    <ResponsiveContainer>
                      <ComposedChart
                        data={stockSummary!.by_warehouse}
                        margin={{ top: 10, right: 16, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          stroke="var(--color-muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="var(--color-muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip {...tooltipStyle()} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar
                          dataKey="projected"
                          name="Projected closing"
                          fill="var(--color-chart-1)"
                          radius={[4, 4, 0, 0]}
                        />
                        <Line
                          type="monotone"
                          dataKey="reorder"
                          name="Reorder qty"
                          stroke="var(--color-warning)"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Top Reorder Items"
                  subtitle="SKUs that need replenishment"
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">SKU</th>
                        <th className="px-4 py-2 text-left font-medium">Warehouse</th>
                        <th className="px-4 py-2 text-right font-medium">Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stockSummary?.top_reorder ?? []).slice(0, 8).map((r) => (
                        <tr key={`${r.sku}-${r.warehouse}`} className="border-b border-border/60">
                          <td className="px-4 py-2 font-mono text-xs text-primary">{r.sku}</td>
                          <td className="px-4 py-2 text-muted-foreground truncate max-w-[160px]">{r.warehouse}</td>
                          <td className="px-4 py-2 text-right num font-medium text-warning">
                            {r.required.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                      {(stockSummary?.top_reorder ?? []).length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center py-6 text-muted-foreground">
                            No reorder items detected.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Tables row — tabs for sales / stock */}
            <Card>
              <div className="flex items-center justify-between px-5 pt-4 border-b border-border">
                <div className="flex gap-1">
                  {([
                    { key: "sales", label: "Sales Forecast", icon: TrendingUp },
                    { key: "stock", label: "Stock Forecast", icon: Package },
                  ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`px-3 py-2 text-sm font-medium inline-flex items-center gap-2 border-b-2 -mb-px transition-colors ${
                        tab === key
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground pb-2">
                  {tab === "sales"
                    ? `${salesForecasts?.length ?? 0} sales records`
                    : `${stockForecasts?.length ?? 0} stock records`}
                </div>
              </div>

              {tab === "sales" ? (
                <SalesTable data={salesForecasts ?? []} />
              ) : (
                <StockTable data={stockForecasts ?? []} />
              )}
            </Card>

            {/* Insight callouts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InsightCard
                icon={Target}
                title="Most accurate method"
                value={
                  analytics?.method_mix && analytics.method_mix.length > 0
                    ? analytics.method_mix[0].name.replace(/_/g, " ")
                    : "—"
                }
                sub="Highest cumulative predicted volume"
              />
              <InsightCard
                icon={Sparkles}
                title="Top variant"
                value={analytics?.top_skus?.[0]?.sku ?? "—"}
                sub={
                  analytics?.top_skus?.[0]
                    ? `${analytics.top_skus[0].predicted.toLocaleString()} units · ${(analytics.top_skus[0].share).toFixed(1)}% share`
                    : "—"
                }
              />
              <InsightCard
                icon={Layers}
                title="Forecast window"
                value={`${totals?.date_start ?? "—"} → ${totals?.date_end ?? "—"}`}
                sub={`${totals?.records ?? 0} records across ${totals?.skus ?? 0} variants`}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------
function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function InsightCard({
  icon: Icon, title, value, sub,
}: { icon: any; title: string; value: string; sub: string }) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <div className="mt-1 text-lg font-semibold truncate">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </Card>
  );
}

function SalesTable({ data }: { data: SalesForecast[] }) {
  const [sortKey, setSortKey] = useState<string | null>("forecast_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
          <tr>
            {[
              { key: "forecast_date", label: "Date" },
              { key: "variant_sku", label: "SKU" },
              { key: "predicted_quantity", label: "Predicted Qty", align: "right" },
              { key: "confidence", label: "Confidence", align: "right" },
              { key: "method_used", label: "Method" },
            ].map((c) => (
              <th
                key={c.key}
                onClick={() => handleSort(c.key)}
                className={`px-4 py-2.5 font-medium cursor-pointer select-none hover:text-foreground ${c.align === "right" ? "text-right" : "text-left"}`}
              >
                {c.label}{sortKey === c.key && (sortDir === "asc" ? " ↑" : " ↓")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">No sales forecast records.</td></tr>
          ) : (
            sorted.slice(0, 200).map((f) => (
              <tr key={f.id} className="border-b border-border/60 hover:bg-surface-2/50">
                <td className="px-4 py-2.5 text-muted-foreground num">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 opacity-50" /> {f.forecast_date}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-primary">{f.variant_sku}</td>
                <td className="px-4 py-2.5 text-right num font-medium">
                  {parseFloat(f.predicted_quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className={`px-4 py-2.5 text-right num font-medium ${confidenceTone(f.confidence)}`}>
                  {(f.confidence * 100).toFixed(0)}%
                </td>
                <td className="px-4 py-2.5"><MethodBadge method={f.method_used} /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function StockTable({ data }: { data: StockForecast[] }) {
  const [sortKey, setSortKey] = useState<string | null>("required_purchase_qty");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = parseFloat((a as any)[sortKey] || "0");
      const bv = parseFloat((b as any)[sortKey] || "0");
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [data, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
          <tr>
            {[
              { key: "forecast_date", label: "Date" },
              { key: "variant_sku", label: "SKU" },
              { key: "warehouse_name", label: "Warehouse" },
              { key: "projected_closing_stock", label: "Projected Stock", align: "right" },
              { key: "required_purchase_qty", label: "Reorder Qty", align: "right" },
            ].map((c) => (
              <th
                key={c.key}
                onClick={() => handleSort(c.key)}
                className={`px-4 py-2.5 font-medium cursor-pointer select-none hover:text-foreground ${c.align === "right" ? "text-right" : "text-left"}`}
              >
                {c.label}{sortKey === c.key && (sortDir === "asc" ? " ↑" : " ↓")}
              </th>
            ))}
            <th className="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No stock forecast records.</td></tr>
          ) : (
            sorted.slice(0, 200).map((f) => {
              const required = parseFloat(f.required_purchase_qty);
              const projected = parseFloat(f.projected_closing_stock);
              const status = required > 0 ? "Pending" : projected < 0 ? "Overdue" : "Open";
              return (
                <tr key={f.id} className="border-b border-border/60 hover:bg-surface-2/50">
                  <td className="px-4 py-2.5 text-muted-foreground num">{f.forecast_date}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">{f.variant_sku}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{f.warehouse_name ?? f.warehouse}</td>
                  <td className={`px-4 py-2.5 text-right num font-medium ${projected < 0 ? "text-destructive" : "text-foreground"}`}>
                    {projected.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-2.5 text-right num font-medium ${required > 0 ? "text-warning" : "text-muted-foreground"}`}>
                    {required.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={status} /></td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
