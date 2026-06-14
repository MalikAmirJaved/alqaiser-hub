"use client";

import { Loader2, RefreshCw, ArrowUpRight, ArrowDownRight, MoreHorizontal } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { PageHeader, Card, CardHeader, StatusBadge, ToolbarButton } from "@/components/finance/ui";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import {
  useFinanceDashboardSummary,
  useFinanceCashflow,
  useFinanceExpenseBreakdown,
  useFinanceBankBalances,
  useFinanceRecentPayments,
  useFinanceRevenueTrend,
} from "@/hooks/finance/useFinanceDashboard";

// ------------------------------------------------------------
// Chart colors (same as old version)
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

// ------------------------------------------------------------
// KPI component with delta (hidden when delta not available)
// ------------------------------------------------------------
function Kpi({
  label,
  value,
  delta,
  accent = "primary",
}: {
  label: string;
  value: string;
  delta?: number;
  accent?: "primary" | "info" | "warning" | "destructive";
}) {
  const up = delta !== undefined ? delta >= 0 : false;
  const accentBg: Record<string, string> = {
    primary: "from-primary/20 to-transparent",
    info: "from-info/20 to-transparent",
    warning: "from-warning/20 to-transparent",
    destructive: "from-destructive/20 to-transparent",
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

// ------------------------------------------------------------
// Main Dashboard Component
// ------------------------------------------------------------
export default function FinanceDashboardPage() {
  const formatCurrency = useFormatCurrency();
  const queryClient = useQueryClient();
  const t = tooltipStyle();

  // Data hooks
  const { data: summary, isLoading: summaryLoading } = useFinanceDashboardSummary();
  const { data: cashflow, isLoading: cashflowLoading } = useFinanceCashflow();
  const { data: expenseBreakdown, isLoading: expenseLoading } = useFinanceExpenseBreakdown();
  const { data: bankBalances, isLoading: bankLoading } = useFinanceBankBalances();
  const { data: recentPayments, isLoading: paymentsLoading } = useFinanceRecentPayments();
  const { data: revenueTrend, isLoading: trendLoading } = useFinanceRevenueTrend();

  const isLoading = summaryLoading || cashflowLoading || expenseLoading || bankLoading || paymentsLoading || trendLoading;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["finance_dashboard_summary"] });
    queryClient.invalidateQueries({ queryKey: ["finance_dashboard_cashflow"] });
    queryClient.invalidateQueries({ queryKey: ["finance_dashboard_expense_breakdown"] });
    queryClient.invalidateQueries({ queryKey: ["finance_dashboard_bank_balances"] });
    queryClient.invalidateQueries({ queryKey: ["finance_dashboard_recent_payments"] });
    queryClient.invalidateQueries({ queryKey: ["finance_dashboard_revenue_trend"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const kpis = summary?.kpis;
  const revenueTrendData = (revenueTrend?.data ?? []).map((item) => ({
    m: item.month,
    rev: item.revenue,
    exp: item.expense,
  }));

  // Map recent payments to old transaction table format
  const recentTransactions = (recentPayments?.data ?? []).map((p: any) => ({
    id: p.reference_number || p.id,
    date: p.payment_date,
    account: p.payable_label || p.payable_type || "Payment",
    desc: p.notes || `${p.payment_type} - ${p.payment_method}`,
    debit: p.payment_type === "PAYMENT" ? Number(p.amount) : 0,
    credit: p.payment_type === "RECEIPT" ? Number(p.amount) : 0,
    status: p.status?.toLowerCase() || "confirmed",
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={["Finance", "Dashboard"]}
        title="Finance Dashboard"
        description="Real-time view of revenue, cash, AR/AP, and approvals."
        actions={
          <>
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
        {/* KPIs row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi
            label="Total Revenue"
            value={formatCurrency(Number(kpis?.revenue_mtd ?? 0))}
            delta={undefined}  // No delta from API – can compute later
            accent="primary"
          />
          <Kpi
            label="Total Expenses"
            value={formatCurrency(Number(kpis?.expenses_mtd ?? 0))}
            delta={undefined}
            accent="warning"
          />
          <Kpi
            label="Net Profit"
            value={formatCurrency(Number(kpis?.net_profit_mtd ?? 0))}
            delta={undefined}
            accent="info"
          />
          <Kpi
            label="Cash Position"
            value={formatCurrency(Number(kpis?.cash_position ?? 0))}
            delta={undefined}
            accent="destructive"
          />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Revenue vs Expense"
              subtitle="Trailing 12 months · USD thousands"
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
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...t} />
                  <Area type="monotone" dataKey="rev" name="Revenue" stroke="var(--color-chart-1)" fill="url(#gRev)" strokeWidth={2} />
                  <Area type="monotone" dataKey="exp" name="Expense" stroke="var(--color-chart-3)" fill="url(#gExp)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Expense Breakdown" subtitle="By category · YTD" />
            <div className="p-4 h-[300px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={expenseBreakdown?.data ?? []}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {(expenseBreakdown?.data ?? []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--color-background)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip {...t} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="px-5 pb-4 grid grid-cols-2 gap-2 text-xs">
              {(expenseBreakdown?.data ?? []).map((e, i) => (
                <div key={e.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-muted-foreground flex-1 truncate">{e.name}</span>
                  <span className="num font-medium">{formatCurrency(e.value)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Cash Flow" subtitle="Inflows vs Outflows · 6 months" />
            <div className="p-4 h-[260px]">
              <ResponsiveContainer>
                <BarChart data={cashflow?.data ?? []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...t} />
                  <Bar dataKey="inflow" name="Inflow" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflow" name="Outflow" fill="var(--color-chart-5)" radius={[0, 0, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Budget vs Actual" subtitle="By department · YTD" />
            <div className="p-5 flex items-center justify-center h-[260px] text-muted-foreground text-sm">
              Budget tracking will appear once budget data is configured.
            </div>
          </Card>

          <Card>
            <CardHeader title="Forecast vs Actual" subtitle="Net income · 12M" />
            <div className="p-4 h-[260px]">
              <ResponsiveContainer>
                <LineChart data={revenueTrendData.map(d => ({ m: d.m, actual: d.rev - d.exp }))}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...t} />
                  <Line type="monotone" dataKey="actual" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} name="Net Income" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Tables row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Recent Transactions"
              subtitle="From confirmed payments"
              action={<button className="text-xs text-primary font-medium hover:underline">View all →</button>}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr className="text-left">
                    <th className="font-medium px-4 py-2">Ref</th>
                    <th className="font-medium px-4 py-2">Date</th>
                    <th className="font-medium px-4 py-2">Account / Description</th>
                    <th className="font-medium px-4 py-2 text-right">Debit</th>
                    <th className="font-medium px-4 py-2 text-right">Credit</th>
                    <th className="font-medium px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-border/60 hover:bg-surface-2/60 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-primary">{tx.id}</td>
                      <td className="px-4 py-2.5 text-muted-foreground num">{tx.date}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">{tx.account}</div>
                        <div className="text-xs text-muted-foreground">{tx.desc}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right num">{tx.debit ? formatCurrency(tx.debit) : "—"}</td>
                      <td className="px-4 py-2.5 text-right num">{tx.credit ? formatCurrency(tx.credit) : "—"}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={tx.status} /></td>
                    </tr>
                  ))}
                  {recentTransactions.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No recent payments found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Pending Approvals"
                subtitle="Awaiting review"
              />
              <div className="p-5 text-sm text-muted-foreground text-center">
                Pending approvals will appear once the approval workflow is configured.
              </div>
            </Card>
          </div>
        </div>

        {/* Bank balances + Aging */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Bank Balances" subtitle="Across treasury accounts" />
            <div className="divide-y divide-border">
              {(bankBalances?.data ?? []).map((b) => (
                <div key={b.name} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm font-medium">{b.name}</div>
                    <div className="text-xs text-muted-foreground">{b.currency}</div>
                  </div>
                  <div className="text-sm font-semibold num">{formatCurrency(Number(b.balance), Number(b.currency))}</div>
                </div>
              ))}
              {(bankBalances?.data ?? []).length === 0 && (
                <div className="px-5 py-6 text-sm text-muted-foreground">No bank accounts configured.</div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Receivables Aging" subtitle={`Total ${formatCurrency(Number(kpis?.receivables ?? 0))}`} />
            <div className="p-5 flex items-center justify-center h-[260px] text-sm text-muted-foreground">
              Aging distribution will appear once invoice data is configured.
            </div>
          </Card>

          <Card>
            <CardHeader title="Payables Aging" subtitle={`Total ${formatCurrency(Number(kpis?.payables ?? 0))}`} />
            <div className="p-5 flex items-center justify-center h-[260px] text-sm text-muted-foreground">
              Aging distribution will appear once bill data is configured.
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}