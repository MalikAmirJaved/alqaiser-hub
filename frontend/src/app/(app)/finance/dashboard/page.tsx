"use client";

import { PageHeader, Card, CardHeader, StatusBadge, ToolbarButton } from "@/components/finance/ui";
import { Plus, Download, ArrowUpRight, ArrowDownRight, MoreHorizontal, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  kpis, fmtCurrency, revenueTrend, cashflowData, expenseBreakdown, departmentSpend,
  recentTransactions, pendingApprovals, bankBalances,
} from "@/staticdata/finance-data";

const CHART_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)", "var(--color-info)"];

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
  label, value, delta, accent,
}: { label: string; value: string; delta: number; accent?: "primary" | "info" | "warning" | "destructive" }) {
  const up = delta >= 0;
  const accentBg: Record<string, string> = {
    primary: "from-primary/20 to-transparent",
    info: "from-info/20 to-transparent",
    warning: "from-warning/20 to-transparent",
    destructive: "from-destructive/20 to-transparent",
  };
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${accentBg[accent ?? "primary"]} opacity-60 pointer-events-none`} />
      <div className="relative px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div className="text-2xl font-semibold num tracking-tight">{value}</div>
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium num ${up ? "text-success" : "text-destructive"}`}>
            {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        </div>
        <div className="mt-3 h-1 rounded-full bg-border overflow-hidden">
          <div className={`h-full ${up ? "bg-success" : "bg-destructive"}`} style={{ width: `${Math.min(100, 40 + Math.abs(delta) * 3)}%` }} />
        </div>
      </div>
    </Card>
  );
}

function Dashboard() {
  const t = tooltipStyle();
  return (
    <>
      <PageHeader
        breadcrumbs={["Finance", "Dashboard"]}
        title="Finance Dashboard"
        description="Real-time view of revenue, cash, AR/AP, and approvals across Acme Holdings."
        actions={
          <>
            <ToolbarButton icon={Download} variant="ghost">Export</ToolbarButton>
            <ToolbarButton icon={Plus} variant="primary">New Transaction</ToolbarButton>
          </>
        }
      />
      <div className="pt-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Total Revenue" value={fmtCurrency(kpis.revenue)} delta={kpis.revenueDelta} accent="primary" />
          <Kpi label="Total Expenses" value={fmtCurrency(kpis.expenses)} delta={kpis.expensesDelta} accent="warning" />
          <Kpi label="Net Profit" value={fmtCurrency(kpis.netProfit)} delta={kpis.netProfitDelta} accent="info" />
          <Kpi label="Cash Position" value={fmtCurrency(kpis.cash)} delta={kpis.cashDelta} accent="destructive" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Revenue vs Expense"
              subtitle="Trailing 12 months · USD thousands"
              action={
                <div className="flex gap-1 rounded-md border border-border p-0.5 text-xs">
                  {["12M", "YTD", "QTR", "MTD"].map((p, i) => (
                    <button key={p} className={`px-2 py-1 rounded ${i === 0 ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{p}</button>
                  ))}
                </div>
              }
            />
            <div className="p-4 h-[300px]">
              <ResponsiveContainer>
                <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                  <Pie data={expenseBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {expenseBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--color-background)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip {...t} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="px-5 pb-4 grid grid-cols-2 gap-2 text-xs">
              {expenseBreakdown.map((e, i) => (
                <div key={e.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-muted-foreground flex-1 truncate">{e.name}</span>
                  <span className="num font-medium">{fmtCurrency(e.value).replace("$", "$")}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Second row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Cash Flow" subtitle="Inflows vs Outflows · 6 months" />
            <div className="p-4 h-[260px]">
              <ResponsiveContainer>
                <BarChart data={cashflowData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
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
            <div className="p-4 h-[260px]">
              <ResponsiveContainer>
                <BarChart data={departmentSpend} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="dep" type="category" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={84} />
                  <Tooltip {...t} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="budget" name="Budget" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="actual" name="Actual" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Forecast vs Actual" subtitle="Net income · 12M" />
            <div className="p-4 h-[260px]">
              <ResponsiveContainer>
                <LineChart data={revenueTrend.map((d) => ({ m: d.m, actual: d.rev - d.exp, forecast: (d.rev - d.exp) * (0.95 + Math.random() * 0.15) }))}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...t} />
                  <Line type="monotone" dataKey="actual" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="forecast" stroke="var(--color-chart-4)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
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
              subtitle="Across all ledgers"
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
                      <td className="px-4 py-2.5 text-right num">{tx.debit ? fmtCurrency(tx.debit) : "—"}</td>
                      <td className="px-4 py-2.5 text-right num">{tx.credit ? fmtCurrency(tx.credit) : "—"}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={tx.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Pending Approvals"
                subtitle="12 items waiting"
                action={<span className="text-xs px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium">12</span>}
              />
              <div className="divide-y divide-border">
                {pendingApprovals.map((a) => (
                  <div key={a.id} className="px-5 py-3 flex items-start gap-3 hover:bg-surface-2/50">
                    <div className="h-8 w-8 rounded-md bg-surface-2 border border-border flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                      {a.type[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">{a.id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground">{a.type}</span>
                      </div>
                      <div className="text-sm font-medium truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.requester} · {a.age} ago</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold num">{fmtCurrency(a.amount)}</div>
                      <div className="flex gap-1 mt-1 justify-end">
                        <button className="h-6 w-6 rounded bg-success/15 text-success hover:bg-success/25 flex items-center justify-center"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                        <button className="h-6 w-6 rounded bg-destructive/15 text-destructive hover:bg-destructive/25 flex items-center justify-center"><AlertTriangle className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Bank balances + Aging */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Bank Balances" subtitle="Across treasury accounts" />
            <div className="divide-y divide-border">
              {bankBalances.map((b) => (
                <div key={b.name} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm font-medium">{b.name}</div>
                    <div className="text-xs text-muted-foreground">{b.currency}</div>
                  </div>
                  <div className="text-sm font-semibold num">{fmtCurrency(b.balance, b.currency)}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Receivables Aging" subtitle={`Total ${fmtCurrency(kpis.receivables)}`} />
            <div className="p-5 space-y-3">
              {[
                { l: "Current", v: 1_240_000, c: "var(--color-success)" },
                { l: "1–30 days", v: 480_000, c: "var(--color-info)" },
                { l: "31–60 days", v: 280_000, c: "var(--color-warning)" },
                { l: "61–90 days", v: 124_000, c: "var(--color-chart-5)" },
                { l: "90+ days", v: 60_500, c: "var(--color-destructive)" },
              ].map((b) => {
                const pct = (b.v / kpis.receivables) * 100;
                return (
                  <div key={b.l}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{b.l}</span>
                      <span className="num font-medium">{fmtCurrency(b.v)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-border overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: b.c }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="Payables Aging" subtitle={`Total ${fmtCurrency(kpis.payables)}`} />
            <div className="p-5 space-y-3">
              {[
                { l: "Current", v: 820_000, c: "var(--color-success)" },
                { l: "1–30 days", v: 320_000, c: "var(--color-info)" },
                { l: "31–60 days", v: 140_000, c: "var(--color-warning)" },
                { l: "61–90 days", v: 88_000, c: "var(--color-chart-5)" },
                { l: "90+ days", v: 34_700, c: "var(--color-destructive)" },
              ].map((b) => {
                const pct = (b.v / kpis.payables) * 100;
                return (
                  <div key={b.l}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{b.l}</span>
                      <span className="num font-medium">{fmtCurrency(b.v)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-border overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: b.c }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}


export default Dashboard;