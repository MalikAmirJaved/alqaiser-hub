"use client";

import { Loader2, RefreshCw, Target, FileText, Users, Receipt } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/cards/StatCard";
import { StatusBadge } from "@/components/finance/ui";
import { formatCurrency } from "@/lib/currency";
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
];

export default function SalesDashboardPage() {
  const queryClient = useQueryClient();
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

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Sales Dashboard" subtitle="Live pipeline, quotes, and revenue overview" />
        <button
          onClick={refreshAll}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-accent transition"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Leads" value={kpis?.total_leads ?? 0} icon={Target} accent="primary" />
        <StatCard label="Quotes" value={kpis?.total_quotes ?? 0} icon={FileText} accent="info" />
        <StatCard label="Customers" value={kpis?.total_customers ?? 0} icon={Users} accent="success" />
        <StatCard label="Conversion" value={`${kpis?.conversion_rate ?? 0}%`} icon={Receipt} accent="warning" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Quote Value" value={formatCurrency(Number(kpis?.quote_value ?? 0))} icon={FileText} accent="info" />
        <StatCard label="Invoice Total" value={formatCurrency(Number(kpis?.invoice_total ?? 0))} icon={Receipt} accent="primary" />
        <StatCard label="Outstanding" value={formatCurrency(Number(kpis?.outstanding ?? 0))} icon={Receipt} accent="warning" />
        <StatCard label="New Leads (MTD)" value={kpis?.new_leads_mtd ?? 0} icon={Target} accent="success" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-4">Lead Pipeline</h3>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={pipeline?.data ?? []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="stage" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    color: "var(--color-popover-foreground)",
                  }}
                />
                <Bar dataKey="count" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-4">Quotes by Status</h3>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={(summary?.quotes_by_status ?? []).map((q) => ({ name: q.status, value: q.count }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {(summary?.quotes_by_status ?? []).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--color-background)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    color: "var(--color-popover-foreground)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Recent Leads</h3>
          <div className="space-y-2">
            {(activity?.leads ?? []).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.source} · {new Date(lead.created_at).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={lead.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Recent Quotes</h3>
          <div className="space-y-2">
            {(activity?.quotes ?? []).map((quote) => (
              <div key={quote.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{quote.quote_number}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(Number(quote.total_amount))}</p>
                </div>
                <StatusBadge status={quote.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
