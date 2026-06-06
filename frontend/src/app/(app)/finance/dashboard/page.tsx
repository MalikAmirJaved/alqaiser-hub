"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { PageHeader, Card, CardHeader } from "@/components/finance/ui";
import { formatCurrency } from "@/lib/currency";
import {
  useFinanceDashboardSummary,
  useFinanceCashflow,
  useFinanceExpenseBreakdown,
  useFinanceBankBalances,
  useFinanceRecentPayments,
  useFinanceRevenueTrend,
} from "@/hooks/finance/useFinanceDashboard";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
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

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
      <div className="mt-2 text-2xl font-semibold num tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

export default function FinanceDashboardPage() {
  const queryClient = useQueryClient();
  const t = tooltipStyle();

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

  return (
    <>
      <PageHeader
        breadcrumbs={["Finance", "Dashboard"]}
        title="Finance Dashboard"
        description="Live view of revenue, cash, receivables, payables, and payroll."
        actions={
          <button
            onClick={refreshAll}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-accent transition"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      <div className="pt-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Revenue (MTD)" value={formatCurrency(Number(kpis?.revenue_mtd ?? 0))} />
          <KpiCard label="Expenses (MTD)" value={formatCurrency(Number(kpis?.expenses_mtd ?? 0))} />
          <KpiCard label="Net Profit (MTD)" value={formatCurrency(Number(kpis?.net_profit_mtd ?? 0))} />
          <KpiCard label="Cash Position" value={formatCurrency(Number(kpis?.cash_position ?? 0))} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Receivables" value={formatCurrency(Number(kpis?.receivables ?? 0))} sub={`${kpis?.unpaid_invoices ?? 0} unpaid invoices`} />
          <KpiCard label="Payables" value={formatCurrency(Number(kpis?.payables ?? 0))} sub={`${kpis?.unpaid_bills ?? 0} unpaid bills`} />
          <KpiCard label="Payroll Records" value={String(kpis?.payroll_records ?? 0)} sub="Active this period" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader title="Revenue vs Expense" subtitle="Monthly from journal entries" />
            <div className="p-4 h-[280px]">
              <ResponsiveContainer>
                <AreaChart data={revenueTrend?.data ?? []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...t} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.2} strokeWidth={2} />
                  <Area type="monotone" dataKey="expense" stroke="var(--color-chart-3)" fill="var(--color-chart-3)" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Expense Breakdown" subtitle="By category · YTD" />
            <div className="p-4 h-[280px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={expenseBreakdown?.data ?? []} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {(expenseBreakdown?.data ?? []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--color-background)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip {...t} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Cash Flow" subtitle="Confirmed payments · 6 months" />
            <div className="p-4 h-[260px]">
              <ResponsiveContainer>
                <BarChart data={cashflow?.data ?? []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...t} />
                  <Bar dataKey="inflow" name="Inflow" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflow" name="Outflow" fill="var(--color-chart-5)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Bank Balances" subtitle="Treasury accounts" />
            <div className="divide-y divide-border">
              {(bankBalances?.data ?? []).map((b) => (
                <div key={b.name} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm font-medium">{b.name}</div>
                    <div className="text-xs text-muted-foreground">{b.currency}</div>
                  </div>
                  <div className="text-sm font-semibold num">{formatCurrency(Number(b.balance), b.currency)}</div>
                </div>
              ))}
              {(bankBalances?.data ?? []).length === 0 && (
                <div className="px-5 py-6 text-sm text-muted-foreground">No bank accounts configured.</div>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Recent Payments" subtitle="Last 10 confirmed" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr className="text-left">
                  <th className="font-medium px-4 py-2">Type</th>
                  <th className="font-medium px-4 py-2">Payable</th>
                  <th className="font-medium px-4 py-2">Date</th>
                  <th className="font-medium px-4 py-2 text-right">Amount</th>
                  <th className="font-medium px-4 py-2">Method</th>
                </tr>
              </thead>
              <tbody>
                {(recentPayments?.data ?? []).map((p: any) => (
                  <tr key={p.id} className="border-b border-border/60 hover:bg-surface-2/60">
                    <td className="px-4 py-2.5">{p.payment_type}</td>
                    <td className="px-4 py-2.5">{p.payable_label || p.payable_type}</td>
                    <td className="px-4 py-2.5 text-muted-foreground num">{p.payment_date}</td>
                    <td className="px-4 py-2.5 text-right num">{formatCurrency(Number(p.amount))}</td>
                    <td className="px-4 py-2.5">{p.payment_method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
