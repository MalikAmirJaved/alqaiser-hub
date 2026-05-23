"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line,
} from "recharts";

/* ────────────────────────────────────────────────────────────── *
 *  Curated colour palettes
 * ────────────────────────────────────────────────────────────── */
const PALETTE = {
  blue:    "hsl(217, 91%, 60%)",
  indigo:  "hsl(245, 58%, 51%)",
  emerald: "hsl(160, 84%, 39%)",
  amber:   "hsl(38, 92%, 50%)",
  rose:    "hsl(350, 89%, 60%)",
  sky:     "hsl(199, 89%, 48%)",
  violet:  "hsl(263, 70%, 50%)",
  teal:    "hsl(174, 72%, 46%)",
};
const PIE_COLORS = [PALETTE.blue, PALETTE.emerald, PALETTE.amber, PALETTE.rose, PALETTE.violet, PALETTE.sky, PALETTE.teal, PALETTE.indigo];

const CHART_GRADIENT_ID = "chartGradient";
const CHART_GRADIENT_PURCHASE = "chartGradientPurchase";

/* ────────────────────────────────────────────────────────────── *
 *  Stock Movement Area Chart
 * ────────────────────────────────────────────────────────────── */
interface MovementChartProps {
  data: { period: string; transaction_type: string; total_quantity: number; transaction_count: number }[];
  loading?: boolean;
}

export function StockMovementChart({ data, loading = false }: MovementChartProps) {
  // Pivot data: group by period with columns per transaction_type
  const pivoted = React.useMemo(() => {
    const map: Record<string, any> = {};
    data?.forEach((d) => {
      if (!map[d.period]) map[d.period] = { period: d.period };
      map[d.period][d.transaction_type] = (map[d.period][d.transaction_type] || 0) + d.total_quantity;
    });
    return Object.values(map);
  }, [data]);

  const types = React.useMemo(() => {
    const s = new Set<string>();
    data?.forEach((d) => s.add(d.transaction_type));
    return Array.from(s);
  }, [data]);

  return (
    <Card className="border bg-card/65 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Stock Movement Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-72 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : pivoted.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
            No movement data available for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={pivoted} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{ borderRadius: "0.5rem", backdropFilter: "blur(8px)", background: "var(--card)", border: "1px solid var(--border)" }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {types.map((type, idx) => (
                <Bar
                  key={type}
                  dataKey={type}
                  stackId="stack"
                  fill={PIE_COLORS[idx % PIE_COLORS.length]}
                  radius={[idx === types.length - 1 ? 4 : 0, idx === types.length - 1 ? 4 : 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────── *
 *  Sales vs Purchase Composed Chart
 * ────────────────────────────────────────────────────────────── */
interface SalesVsPurchaseChartProps {
  data: { period: string; sales_amount: number; purchase_amount: number }[];
  loading?: boolean; 
  currency?: string;
}

export function SalesVsPurchaseChart({ data, loading = false, currency="$" }: SalesVsPurchaseChartProps) {
  return (
    <Card className="border bg-card/65 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Sales vs Purchase Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-72 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
            No sales or purchase data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data}>
              <defs>
                <linearGradient id={CHART_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.blue} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={PALETTE.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={CHART_GRADIENT_PURCHASE} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.emerald} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={PALETTE.emerald} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{ borderRadius: "0.5rem", backdropFilter: "blur(8px)", background: "var(--card)", border: "1px solid var(--border)" }}
                labelStyle={{ fontWeight: 600 }}
                formatter={(value: number) => `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="sales_amount" name="Sales" stroke={PALETTE.blue} fill={`url(#${CHART_GRADIENT_ID})`} strokeWidth={2} />
              <Area type="monotone" dataKey="purchase_amount" name="Purchases" stroke={PALETTE.emerald} fill={`url(#${CHART_GRADIENT_PURCHASE})`} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────── *
 *  Profit & Loss Bar Chart
 * ────────────────────────────────────────────────────────────── */
interface ProfitLossChartProps {
  data: { product_name: string; variant_sku: string; sales_revenue: number; cogs: number; gross_profit: number; margin_percent: number }[];
  loading?: boolean;
  currency?: string;
}

export function ProfitLossChart({ data, loading = false, currency = "$"}: ProfitLossChartProps) {
  const chartData = React.useMemo(() => (data || []).slice(0, 15).map((d) => ({
    name: d.variant_sku.length > 12 ? d.variant_sku.substring(0, 12) + "…" : d.variant_sku,
    Revenue: Number(d.sales_revenue),
    COGS: Number(d.cogs),
    Profit: Number(d.gross_profit),
  })), [data]);

  return (
    <Card className="border bg-card/65 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Profit & Loss by Product (Top 15)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-72 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
            No profit and loss data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={chartData} barGap={0}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{ borderRadius: "0.5rem", backdropFilter: "blur(8px)", background: "var(--card)", border: "1px solid var(--border)" }}
                formatter={(value: number) => `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Revenue" fill={PALETTE.blue} radius={[3, 3, 0, 0]} barSize={16} />
              <Bar dataKey="COGS" fill={PALETTE.rose} radius={[3, 3, 0, 0]} barSize={16} />
              <Line type="monotone" dataKey="Profit" stroke={PALETTE.emerald} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────── *
 *  Supplier Score Pie + Bar Combo
 * ────────────────────────────────────────────────────────────── */
interface SupplierChartProps {
  data: { supplier_name: string; performance_score: number; fulfillment_rate: number; orders_count: number }[];
  loading?: boolean;
}

export function SupplierPerformanceChart({ data, loading = false }: SupplierChartProps) {
  const pieData = React.useMemo(() => (data || []).slice(0, 8).map((d) => ({
    name: d.supplier_name,
    value: Number(d.performance_score),
  })), [data]);

  return (
    <Card className="border bg-card/65 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Supplier Performance Scores
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-72 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : pieData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
            No supplier data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={120}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {pieData.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: "0.5rem", backdropFilter: "blur(8px)", background: "var(--card)", border: "1px solid var(--border)" }}
                formatter={(value: number) => `${value.toFixed(1)} pts`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────── *
 *  Slow-moving Donut Breakdown
 * ────────────────────────────────────────────────────────────── */
interface SlowMovingChartProps {
  data: { status: string; quantity_on_hand: number }[];
  loading?: boolean;
}

export function SlowMovingChart({ data, loading = false }: SlowMovingChartProps) {
  const grouped = React.useMemo(() => {
    const map: Record<string, number> = { HEALTHY: 0, SLOW_MOVING: 0, OBSOLETE: 0 };
    data?.forEach((d) => {
      if (map[d.status] !== undefined) map[d.status] += 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [data]);

  const STATUS_COLORS: Record<string, string> = {
    HEALTHY: PALETTE.emerald,
    SLOW_MOVING: PALETTE.amber,
    OBSOLETE: PALETTE.rose,
  };

  return (
    <Card className="border bg-card/65 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Stock Health Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-72 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={grouped}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {grouped.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || PALETTE.sky} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: "0.5rem", backdropFilter: "blur(8px)", background: "var(--card)", border: "1px solid var(--border)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
